import { Prisma } from '@prisma/client';

import { prisma, TRANSACTION_OPTIONS } from '../../lib/prisma.js';
import { toSkipTake, withPageInfo } from '../../lib/pagination.js';
import { resolveDismissalIfRecovered } from '../alerts/alerts.service.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';

// Changes to these fields are written to the item's timeline (goal 9).
const TRACKED_FIELDS = ['sku', 'name', 'description', 'unitId', 'reorderLevel', 'categoryId'];

const itemInclude = {
  category: { select: { id: true, name: true } },
  unit: { select: { id: true, code: true } },
  createdBy: { select: { id: true, name: true } },
  // Lets the edit form know whether the unit is still changeable, without a
  // second request. Zero means the item has no ledger history yet.
  _count: { select: { lines: true } },
};

const asText = (value) => (value === null || value === undefined ? null : String(value));

export async function getItem(id) {
  const item = await prisma.item.findUnique({ where: { id }, include: itemInclude });
  if (!item) throw notFound(`Item ${id} not found`);
  return item;
}

export async function createItem(data, actor) {
  return prisma.$transaction(async (tx) => {
    await assertCategoryExists(tx, data.categoryId);
    await assertUnitExists(tx, data.unitId);

    const item = await tx.item.create({
      data: { ...data, createdById: actor.id },
      include: itemInclude,
    });
    await tx.itemEvent.create({
      data: { itemId: item.id, type: 'CREATED', newValue: item.sku, actorId: actor.id },
    });
    return item;
  }, TRANSACTION_OPTIONS);
}

export async function updateItem(id, data, actor) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.item.findUnique({ where: { id } });
    if (!before) throw notFound(`Item ${id} not found`);
    if (data.categoryId !== undefined) await assertCategoryExists(tx, data.categoryId);

    if (data.unitId !== undefined && data.unitId !== before.unitId) {
      await assertUnitExists(tx, data.unitId);
      await assertUnitStillChangeable(tx, before);
    }

    const after = await tx.item.update({ where: { id }, data, include: itemInclude });
    await recordFieldChanges(tx, before, after, actor);

    // Lowering the reorder level can lift an item back above its line, which
    // re-arms a dismissed alert exactly as a delivery would (goal 10).
    if (before.reorderLevel !== after.reorderLevel) {
      await resolveDismissalIfRecovered(tx, id);
    }
    return after;
  }, TRANSACTION_OPTIONS);
}

/**
 * Archiving keeps the item and its whole history but takes it out of
 * circulation; the movement service refuses new movements against an archived
 * item (goal 2).
 */
export async function archiveItem(id, actor) {
  return setArchived(id, true, actor);
}

export async function restoreItem(id, actor) {
  return setArchived(id, false, actor);
}

async function setArchived(id, archived, actor) {
  return prisma.$transaction(async (tx) => {
    const item = await tx.item.findUnique({ where: { id } });
    if (!item) throw notFound(`Item ${id} not found`);

    const isArchived = item.archivedAt !== null;
    if (isArchived === archived) {
      throw conflict(`Item is already ${archived ? 'archived' : 'active'}`);
    }

    const updated = await tx.item.update({
      where: { id },
      data: { archivedAt: archived ? new Date() : null },
      include: itemInclude,
    });
    await tx.itemEvent.create({
      data: { itemId: id, type: archived ? 'ARCHIVED' : 'RESTORED', actorId: actor.id },
    });
    return updated;
  }, TRANSACTION_OPTIONS);
}

/** Writes one timeline entry per field that actually changed. */
async function recordFieldChanges(tx, before, after, actor) {
  const events = TRACKED_FIELDS.filter((field) => before[field] !== after[field]).map((field) => ({
    itemId: after.id,
    type: 'FIELD_CHANGED',
    field,
    oldValue: asText(before[field]),
    newValue: asText(after[field]),
    actorId: actor.id,
  }));

  // An id tells a reader nothing, so record the unit's code instead.
  const unitChange = events.find((event) => event.field === 'unitId');
  if (unitChange) {
    const codes = await tx.unit.findMany({
      where: { id: { in: [before.unitId, after.unitId] } },
      select: { id: true, code: true },
    });
    const codeOf = (id) => codes.find((u) => u.id === id)?.code ?? String(id);
    unitChange.field = 'unit';
    unitChange.oldValue = codeOf(before.unitId);
    unitChange.newValue = codeOf(after.unitId);
  }

  // A category id tells a reader nothing, so record the names instead.
  const categoryChange = events.find((event) => event.field === 'categoryId');
  if (categoryChange) {
    const names = await tx.category.findMany({
      where: { id: { in: [before.categoryId, after.categoryId] } },
      select: { id: true, name: true },
    });
    const nameOf = (id) => names.find((c) => c.id === id)?.name ?? String(id);
    categoryChange.field = 'category';
    categoryChange.oldValue = nameOf(before.categoryId);
    categoryChange.newValue = nameOf(after.categoryId);
  }

  if (events.length > 0) await tx.itemEvent.createMany({ data: events });
}

/**
 * The unit of measure is the denominator of every number in an item's ledger:
 * "142" only means something alongside "box". Once movements exist, changing it
 * would silently reinterpret all of them without touching a row — the one way
 * left to rewrite history that the append-only triggers do not cover.
 *
 * Before the first movement it is freely editable, so a typo caught immediately
 * is just a typo.
 */
async function assertUnitStillChangeable(tx, item) {
  const recorded = await tx.stockMovementLine.count({ where: { itemId: item.id } });
  if (recorded > 0) {
    throw conflict(
      `${item.sku} has ${recorded} recorded movement(s) in its current unit, so the unit can no longer be changed. Create a separate item to stock it in a different unit.`,
      { itemId: item.id, movements: recorded },
    );
  }
}

async function assertUnitExists(tx, unitId) {
  const unit = await tx.unit.findUnique({ where: { id: unitId }, select: { id: true } });
  if (!unit) throw badRequest(`Unit ${unitId} does not exist`);
}

async function assertCategoryExists(tx, categoryId) {
  const category = await tx.category.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });
  if (!category) throw badRequest(`Category ${categoryId} does not exist`);
}

// ---------------------------------------------------------------------------
// The item list (goal 6).
//
// This is the one place that drops to SQL. On-hand is derived by summing the
// ledger, and you cannot filter or sort by an aggregate of a related table
// through Prisma's query API — so searching, filtering, sorting and paging all
// have to happen in one statement to stay on the server.
// ---------------------------------------------------------------------------

// Only these columns can be sorted by. The value is interpolated into the SQL
// directly, so it must never come from user input — the schema's enum picks a
// key here, and this map decides the column.
const SORT_COLUMNS = {
  name: 'i.name',
  sku: 'i.sku',
  onHand: 'onHand',
  reorderLevel: 'i.reorderLevel',
  createdAt: 'i.createdAt',
};

export async function listItems(params) {
  const { search, categoryId, locationId, archived, belowReorder, sort, direction } = params;
  const { skip, take } = toSkipTake(params);

  const filters = [];

  if (search) {
    const term = `%${search}%`;
    filters.push(Prisma.sql`(i.name LIKE ${term} OR i.sku LIKE ${term})`);
  }
  if (categoryId) filters.push(Prisma.sql`i.categoryId = ${categoryId}`);
  if (archived === 'active') filters.push(Prisma.sql`i.archivedAt IS NULL`);
  if (archived === 'archived') filters.push(Prisma.sql`i.archivedAt IS NOT NULL`);

  // "At or below reorder level" always means the total across every location,
  // the same definition the low-stock alerts use, even when the list is
  // filtered to one location.
  if (belowReorder) filters.push(Prisma.sql`COALESCE(total.qty, 0) <= i.reorderLevel`);

  const where = filters.length > 0 ? Prisma.sql`WHERE ${Prisma.join(filters, ' AND ')}` : Prisma.empty;

  // Filtering by location narrows on-hand to that location, and an inner join
  // means only items that have actually moved through it are listed.
  const locationJoin = locationId
    ? Prisma.sql`
      JOIN (
        SELECT itemId, SUM(quantityDelta) AS qty
        FROM stock_movement_lines WHERE locationId = ${locationId} GROUP BY itemId
      ) atLocation ON atLocation.itemId = i.id`
    : Prisma.empty;

  const from = Prisma.sql`
    FROM items i
    JOIN categories c ON c.id = i.categoryId
    JOIN units u ON u.id = i.unitId
    LEFT JOIN (
      SELECT itemId, SUM(quantityDelta) AS qty FROM stock_movement_lines GROUP BY itemId
    ) total ON total.itemId = i.id
    ${locationJoin}
    ${where}
  `;

  const onHand = locationId ? Prisma.sql`atLocation.qty` : Prisma.sql`total.qty`;
  const orderBy = Prisma.raw(`${SORT_COLUMNS[sort]} ${direction === 'desc' ? 'DESC' : 'ASC'}`);

  const [rows, counted] = await Promise.all([
    prisma.$queryRaw`
      SELECT i.id, i.sku, i.name, i.description, i.reorderLevel,
             i.archivedAt, c.id AS categoryId, c.name AS categoryName,
             u.id AS unitId, u.code AS unitCode,
             CAST(COALESCE(${onHand}, 0) AS SIGNED) AS onHand,
             CAST(COALESCE(total.qty, 0) AS SIGNED) AS totalOnHand
      ${from}
      ORDER BY ${orderBy}, i.id ASC
      LIMIT ${take} OFFSET ${skip}
    `,
    prisma.$queryRaw`SELECT COUNT(*) AS total ${from}`,
  ]);

  const total = Number(counted[0].total);
  return withPageInfo(rows.map(presentRow), total, params);
}

/** Reshapes a flat SQL row into the nested shape the rest of the API returns. */
function presentRow(row) {
  const totalOnHand = Number(row.totalOnHand);
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    description: row.description,
    unit: { id: row.unitId, code: row.unitCode },
    reorderLevel: row.reorderLevel,
    archivedAt: row.archivedAt,
    category: { id: row.categoryId, name: row.categoryName },
    // Narrowed to one location when the list is filtered by location.
    onHand: Number(row.onHand),
    totalOnHand,
    belowReorderLevel: totalOnHand <= row.reorderLevel,
  };
}

// ---------------------------------------------------------------------------
// The item timeline (goal 9). Append-only: there is no update or delete path
// here, and the database refuses one anyway.
// ---------------------------------------------------------------------------

/** Creation, every tracked field change, archive/restore, and notes. */
export async function getTimeline(itemId, pagination) {
  await getItem(itemId); // 404s for an unknown item before returning an empty page

  const where = { itemId };
  const [rows, total] = await Promise.all([
    prisma.itemEvent.findMany({
      where,
      include: { actor: { select: { id: true, name: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...toSkipTake(pagination),
    }),
    prisma.itemEvent.count({ where }),
  ]);

  return withPageInfo(rows, total, pagination);
}

/** Notes sit on the same timeline as field changes, not in a separate list. */
export async function addNote(itemId, note, actor) {
  await getItem(itemId);

  return prisma.itemEvent.create({
    data: { itemId, type: 'NOTE', note, actorId: actor.id },
    include: { actor: { select: { id: true, name: true } } },
  });
}
