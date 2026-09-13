import { prisma, TRANSACTION_OPTIONS } from '../../lib/prisma.js';
import { conflict, forbidden, notFound } from '../../lib/errors.js';
import { assertCanActAtLocations } from '../../lib/access.js';
import { resolveDismissalIfRecovered } from '../alerts/alerts.service.js';
import { toSkipTake, withPageInfo } from '../../lib/pagination.js';

/**
 * Turns one movement into the signed ledger lines it produces.
 *
 * This is the whole of the arithmetic. A receipt adds, an issue subtracts, an
 * adjustment applies its own sign, and a transfer is a single movement with two
 * lines that cancel out — which is why a transfer can never be half-applied.
 */
function buildLines(input) {
  switch (input.kind) {
    case 'RECEIPT':
      return [{ locationId: input.locationId, quantityDelta: input.quantity }];
    case 'ISSUE':
      return [{ locationId: input.locationId, quantityDelta: -input.quantity }];
    case 'ADJUSTMENT':
      return [{ locationId: input.locationId, quantityDelta: input.quantity }];
    case 'TRANSFER':
      return [
        { locationId: input.sourceLocationId, quantityDelta: -input.quantity },
        { locationId: input.destinationLocationId, quantityDelta: input.quantity },
      ];
    default:
      throw new Error(`Unhandled movement kind: ${input.kind}`);
  }
}

/**
 * Records a movement. Everything happens in one transaction so the item cannot
 * change underneath us and a partially written transfer cannot survive.
 */
export async function recordMovement(input, actor) {
  const lines = buildLines(input);

  // Only managers may adjust. Staff record what physically happened; correcting
  // a count against the ledger is a decision, not an observation (goal 1).
  if (input.kind === 'ADJUSTMENT' && actor.role !== 'MANAGER') {
    throw forbidden('Only a manager can record an adjustment');
  }

  return prisma.$transaction(async (tx) => {
    const item = await lockItem(tx, input.itemId);
    if (item.archivedAt) {
      throw conflict(`${item.sku} is archived and cannot take new movements`);
    }

    const locations = await loadLocations(tx, lines);

    // Staff act only where they are assigned; a transfer is checked at both ends.
    assertCanActAtLocations(actor, [...locations.values()]);

    assertLocationsAcceptStock(lines, locations);
    await assertStockAvailable(tx, input.itemId, lines, locations);

    const movement = await tx.stockMovement.create({
      data: {
        itemId: input.itemId,
        kind: input.kind,
        quantity: input.quantity,
        locationId: input.locationId ?? null,
        sourceLocationId: input.sourceLocationId ?? null,
        destinationLocationId: input.destinationLocationId ?? null,
        reason: input.reason ?? null,
        note: input.note ?? null,
        recordedById: actor.id,
        ...(input.occurredAt ? { occurredAt: input.occurredAt } : {}),
        // Lines inherit itemId and occurredAt from this row automatically: they
        // are part of the composite foreign key back to it.
        lines: { create: lines },
      },
      include: movementInclude,
    });

    // A delivery can lift the item back above its reorder level, which clears a
    // dismissed alert so it can fire again next time (goal 10).
    await resolveDismissalIfRecovered(tx, input.itemId);

    return movement;
  }, TRANSACTION_OPTIONS);
}

/**
 * Takes a write lock on the item row for the rest of the transaction.
 *
 * Without this, two people issuing the last units at the same time would both
 * read the same balance, both decide there is enough, and both insert — driving
 * the location negative. Locking the item serialises movements for that item
 * while leaving every other item free to proceed in parallel.
 */
async function lockItem(tx, itemId) {
  const rows = await tx.$queryRaw`
    SELECT id, sku, archivedAt FROM items WHERE id = ${itemId} FOR UPDATE
  `;
  if (rows.length === 0) throw notFound(`Item ${itemId} not found`);
  return rows[0];
}

/** Loads every location the movement touches, keyed by id. */
async function loadLocations(tx, lines) {
  const ids = [...new Set(lines.map((line) => line.locationId))];
  const rows = await tx.location.findMany({ where: { id: { in: ids } } });

  if (rows.length !== ids.length) {
    const missing = ids.filter((id) => !rows.some((row) => row.id === id));
    throw notFound(`Location ${missing.join(', ')} not found`);
  }
  return new Map(rows.map((row) => [row.id, row]));
}

/**
 * A deactivated location is one being retired, so no new stock may arrive
 * there. Taking stock out of it is still allowed — that is how you empty it.
 */
function assertLocationsAcceptStock(lines, locations) {
  for (const line of lines) {
    const location = locations.get(line.locationId);
    if (line.quantityDelta > 0 && !location.isActive) {
      throw conflict(`${location.code} is inactive and cannot receive stock`);
    }
  }
}

/**
 * Refuses any movement that would drive a location negative (goal 4). Only
 * lines that remove stock need checking; adding can never go below zero.
 */
async function assertStockAvailable(tx, itemId, lines, locations) {
  for (const line of lines.filter((l) => l.quantityDelta < 0)) {
    const onHand = await onHandAtLocation(tx, itemId, line.locationId);
    const wanted = -line.quantityDelta;

    if (onHand < wanted) {
      const { code } = locations.get(line.locationId);
      throw conflict(
        `Not enough stock at ${code}: ${onHand} on hand, ${wanted} requested`,
        { locationId: line.locationId, onHand, requested: wanted },
      );
    }
  }
}

/** On-hand is always summed from the ledger — it is never stored (goal 4). */
async function onHandAtLocation(tx, itemId, locationId) {
  const { _sum } = await tx.stockMovementLine.aggregate({
    where: { itemId, locationId },
    _sum: { quantityDelta: true },
  });
  return _sum.quantityDelta ?? 0;
}

const movementInclude = {
  // The item is included so a movement can stand on its own in the global list,
  // where the reader has no item page for context.
  item: { select: { id: true, sku: true, name: true } },
  recordedBy: { select: { id: true, name: true } },
  location: { select: { id: true, code: true, name: true } },
  sourceLocation: { select: { id: true, code: true, name: true } },
  destinationLocation: { select: { id: true, code: true, name: true } },
};

/** Movement history, newest first. The item page passes itemId. */
export async function listMovements({ itemId, locationId, kind, ...pagination }) {
  const where = {
    ...(itemId ? { itemId } : {}),
    ...(kind ? { kind } : {}),
    // A movement "at" a location includes both ends of a transfer.
    ...(locationId
      ? {
          OR: [
            { locationId },
            { sourceLocationId: locationId },
            { destinationLocationId: locationId },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      include: movementInclude,
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      ...toSkipTake(pagination),
    }),
    prisma.stockMovement.count({ where }),
  ]);

  return withPageInfo(rows, total, pagination);
}

/** On-hand for one item, broken down by location and totalled. */
export async function getItemStock(itemId) {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: { id: true, sku: true, name: true, reorderLevel: true },
  });
  if (!item) throw notFound(`Item ${itemId} not found`);

  const grouped = await prisma.stockMovementLine.groupBy({
    by: ['locationId'],
    where: { itemId },
    _sum: { quantityDelta: true },
  });

  const locations = await prisma.location.findMany({
    where: { id: { in: grouped.map((row) => row.locationId) } },
    select: { id: true, code: true, name: true },
  });

  // Only locations the item has actually moved through appear here; a location
  // it has never been to has no rows to sum, which is a zero we do not store.
  const byLocation = grouped
    .map((row) => ({
      location: locations.find((l) => l.id === row.locationId),
      onHand: row._sum.quantityDelta ?? 0,
    }))
    .sort((a, b) => a.location.code.localeCompare(b.location.code));

  const totalOnHand = byLocation.reduce((sum, row) => sum + row.onHand, 0);

  return { item, totalOnHand, belowReorderLevel: totalOnHand <= item.reorderLevel, byLocation };
}
