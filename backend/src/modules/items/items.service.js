import { prisma } from '../../lib/prisma.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';

// Changes to these fields are written to the item's timeline (goal 9).
const TRACKED_FIELDS = ['sku', 'name', 'description', 'unitOfMeasure', 'reorderLevel', 'categoryId'];

const itemInclude = {
  category: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
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

    const item = await tx.item.create({
      data: { ...data, createdById: actor.id },
      include: itemInclude,
    });
    await tx.itemEvent.create({
      data: { itemId: item.id, type: 'CREATED', newValue: item.sku, actorId: actor.id },
    });
    return item;
  });
}

export async function updateItem(id, data, actor) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.item.findUnique({ where: { id } });
    if (!before) throw notFound(`Item ${id} not found`);
    if (data.categoryId !== undefined) await assertCategoryExists(tx, data.categoryId);

    const after = await tx.item.update({ where: { id }, data, include: itemInclude });
    await recordFieldChanges(tx, before, after, actor);
    return after;
  });
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
  });
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

async function assertCategoryExists(tx, categoryId) {
  const category = await tx.category.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });
  if (!category) throw badRequest(`Category ${categoryId} does not exist`);
}
