import { Prisma } from '@prisma/client';

import { prisma, TRANSACTION_OPTIONS } from '../../lib/prisma.js';
import { conflict, notFound } from '../../lib/errors.js';
import { toSkipTake, withPageInfo } from '../../lib/pagination.js';

/** On-hand across every location — the figure goal 10 compares to the reorder level. */
async function totalOnHand(client, itemId) {
  const { _sum } = await client.stockMovementLine.aggregate({
    where: { itemId },
    _sum: { quantityDelta: true },
  });
  return _sum.quantityDelta ?? 0;
}

/**
 * Items at or below their reorder level (goal 10).
 *
 * A dismissal hides an item while it is unresolved, so the default list is what
 * the alerts area and its count badge show. Archived items are left out, in
 * step with the dashboard and the item list.
 */
export async function listLowStock({ includeDismissed = false, ...pagination }) {
  const { skip, take } = toSkipTake(pagination);

  // Built once and used by both the page query and the count, so the two can
  // never drift apart.
  const from = Prisma.sql`
    FROM items i
    JOIN categories c ON c.id = i.categoryId
    LEFT JOIN (
      SELECT itemId, SUM(quantityDelta) AS qty FROM stock_movement_lines GROUP BY itemId
    ) total ON total.itemId = i.id
    LEFT JOIN alert_dismissals d ON d.itemId = i.id AND d.resolvedAt IS NULL
    WHERE i.archivedAt IS NULL
      AND COALESCE(total.qty, 0) <= i.reorderLevel
      ${includeDismissed ? Prisma.empty : Prisma.sql`AND d.id IS NULL`}
  `;

  const [rows, counted] = await Promise.all([
    prisma.$queryRaw`
      SELECT i.id, i.sku, i.name, i.unitOfMeasure, i.reorderLevel,
             c.name AS categoryName,
             CAST(COALESCE(total.qty, 0) AS SIGNED) AS onHand,
             d.id AS dismissalId, d.dismissedAt,
             (SELECT name FROM users WHERE id = d.dismissedById) AS dismissedByName
      ${from}
      ORDER BY (COALESCE(total.qty, 0) - i.reorderLevel) ASC, i.sku ASC
      LIMIT ${take} OFFSET ${skip}
    `,
    prisma.$queryRaw`SELECT COUNT(*) AS total ${from}`,
  ]);

  return withPageInfo(rows.map(present), Number(counted[0].total), pagination);
}

function present(row) {
  const onHand = Number(row.onHand);
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    unitOfMeasure: row.unitOfMeasure,
    category: row.categoryName,
    onHand,
    reorderLevel: row.reorderLevel,
    // How many units short of the reorder level, so the list can be ordered by
    // urgency and the UI can say "12 below".
    shortfall: row.reorderLevel - onHand,
    dismissed: row.dismissalId
      ? { at: row.dismissedAt, by: row.dismissedByName }
      : null,
  };
}

/** A manager silences one item's alert until its stock recovers. */
export async function dismissAlert(itemId, actor) {
  return prisma.$transaction(async (tx) => {
    const item = await tx.item.findUnique({ where: { id: itemId } });
    if (!item) throw notFound(`Item ${itemId} not found`);

    const onHand = await totalOnHand(tx, itemId);
    if (onHand > item.reorderLevel) {
      throw conflict(`${item.sku} is not at or below its reorder level`);
    }

    const active = await tx.alertDismissal.findFirst({ where: { itemId, resolvedAt: null } });
    if (active) throw conflict(`${item.sku} has already been dismissed`);

    return tx.alertDismissal.create({ data: { itemId, dismissedById: actor.id } });
  }, TRANSACTION_OPTIONS);
}

/** Undoes a dismissal, for when one was made by mistake. */
export async function restoreAlert(itemId) {
  const active = await prisma.alertDismissal.findFirst({ where: { itemId, resolvedAt: null } });
  if (!active) throw notFound('That item has no dismissed alert');

  await prisma.alertDismissal.update({
    where: { id: active.id },
    data: { resolvedAt: new Date() },
  });
}

/**
 * Re-arms a dismissed alert once the item climbs back above its reorder level
 * (goal 10): stamping resolvedAt stops the dismissal suppressing anything, so
 * if stock falls back to the line later the alert appears again.
 *
 * Called from inside the transaction that changed the stock or the reorder
 * level, so the dismissal can never be left stale.
 */
export async function resolveDismissalIfRecovered(tx, itemId) {
  const active = await tx.alertDismissal.findFirst({ where: { itemId, resolvedAt: null } });
  if (!active) return;

  const item = await tx.item.findUnique({ where: { id: itemId }, select: { reorderLevel: true } });
  const onHand = await totalOnHand(tx, itemId);

  if (onHand > item.reorderLevel) {
    await tx.alertDismissal.update({ where: { id: active.id }, data: { resolvedAt: new Date() } });
  }
}
