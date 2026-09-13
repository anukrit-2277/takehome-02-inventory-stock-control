import { stringify } from 'csv-stringify/sync';

import { prisma } from '../../lib/prisma.js';

/**
 * Current stock position: every item, with its on-hand quantity in each
 * location as its own column (goal 7).
 *
 * On-hand is summed from the ledger here exactly as it is everywhere else —
 * the export reads the same source of truth as the screen.
 */
export async function stockPositionCsv({ archived = 'active' } = {}) {
  const where =
    archived === 'active' ? { archivedAt: null }
    : archived === 'archived' ? { archivedAt: { not: null } }
    : {};

  const [items, locations, balances] = await Promise.all([
    prisma.item.findMany({
      where,
      orderBy: { sku: 'asc' },
      include: { category: { select: { name: true } }, unit: { select: { code: true } } },
    }),
    prisma.location.findMany({ orderBy: { code: 'asc' } }),
    prisma.stockMovementLine.groupBy({
      by: ['itemId', 'locationId'],
      _sum: { quantityDelta: true },
    }),
  ]);

  // itemId -> locationId -> quantity
  const byItem = new Map();
  for (const row of balances) {
    if (!byItem.has(row.itemId)) byItem.set(row.itemId, new Map());
    byItem.get(row.itemId).set(row.locationId, row._sum.quantityDelta ?? 0);
  }

  const header = [
    'SKU', 'Name', 'Category', 'Unit', 'Reorder Level',
    ...locations.map((l) => l.code),
    'Total On Hand', 'At Or Below Reorder', 'Archived',
  ];

  const rows = items.map((item) => {
    const quantities = locations.map((l) => byItem.get(item.id)?.get(l.id) ?? 0);
    const total = quantities.reduce((sum, value) => sum + value, 0);

    return [
      item.sku, item.name, item.category.name, item.unit.code, item.reorderLevel,
      ...quantities,
      total,
      total <= item.reorderLevel ? 'Yes' : 'No',
      item.archivedAt ? 'Yes' : 'No',
    ];
  });

  return stringify([header, ...rows]);
}

export function stockPositionFilename() {
  return `stock-position-${new Date().toISOString().slice(0, 10)}.csv`;
}
