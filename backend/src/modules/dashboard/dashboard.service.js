import { prisma } from '../../lib/prisma.js';
import { startOfDay, startOfWeek, addDays, toDateKey } from '../../lib/dates.js';

const WEEKS_CHARTED = 8;

/** Everything the landing view needs, in one request (goal 8). */
export async function getDashboard() {
  const today = startOfDay();
  const tomorrow = addDays(today, 1);
  const thisWeek = startOfWeek();
  const chartFrom = addDays(thisWeek, -7 * (WEEKS_CHARTED - 1));

  const [headline, byCategory, byLocation, weekly] = await Promise.all([
    getHeadline(today, tomorrow, thisWeek),
    getStockByCategory(),
    getStockByLocation(),
    getWeeklyVolume(chartFrom),
  ]);

  return { headline, byCategory, byLocation, weekly: fillMissingWeeks(weekly, chartFrom) };
}

async function getHeadline(today, tomorrow, weekStart) {
  const [items, movements] = await Promise.all([
    // Both item counts come from one pass over the catalogue.
    prisma.$queryRaw`
      SELECT COUNT(*) AS activeItems,
             SUM(COALESCE(total.qty, 0) <= i.reorderLevel) AS atOrBelowReorder
      FROM items i
      LEFT JOIN (
        SELECT itemId, SUM(quantityDelta) AS qty FROM stock_movement_lines GROUP BY itemId
      ) total ON total.itemId = i.id
      WHERE i.archivedAt IS NULL
    `,
    prisma.$queryRaw`
      SELECT
        SUM(occurredAt >= ${today} AND occurredAt < ${tomorrow}) AS movementsToday,
        COUNT(DISTINCT CASE WHEN occurredAt >= ${weekStart} THEN itemId END) AS itemsMovedThisWeek
      FROM stock_movements
    `,
  ]);

  return {
    activeItems: Number(items[0].activeItems ?? 0),
    atOrBelowReorder: Number(items[0].atOrBelowReorder ?? 0),
    movementsToday: Number(movements[0].movementsToday ?? 0),
    itemsMovedThisWeek: Number(movements[0].itemsMovedThisWeek ?? 0),
  };
}

/**
 * On-hand by category. Categories with no stock still appear, so the breakdown
 * matches the category list rather than silently dropping empty ones.
 */
async function getStockByCategory() {
  const rows = await prisma.$queryRaw`
    SELECT c.id, c.name,
           COUNT(DISTINCT i.id) AS itemCount,
           CAST(COALESCE(SUM(l.quantityDelta), 0) AS SIGNED) AS onHand
    FROM categories c
    LEFT JOIN items i ON i.categoryId = c.id AND i.archivedAt IS NULL
    LEFT JOIN stock_movement_lines l ON l.itemId = i.id
    GROUP BY c.id, c.name
    ORDER BY c.name ASC
  `;
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    itemCount: Number(row.itemCount),
    onHand: Number(row.onHand),
  }));
}

/** On-hand by location, counting active items only, same as by category. */
async function getStockByLocation() {
  const rows = await prisma.$queryRaw`
    SELECT loc.id, loc.code, loc.name, loc.isActive,
           CAST(COALESCE(SUM(CASE WHEN i.archivedAt IS NULL THEN l.quantityDelta ELSE 0 END), 0) AS SIGNED) AS onHand
    FROM locations loc
    LEFT JOIN stock_movement_lines l ON l.locationId = loc.id
    LEFT JOIN items i ON i.id = l.itemId
    GROUP BY loc.id, loc.code, loc.name, loc.isActive
    ORDER BY loc.code ASC
  `;
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    isActive: Boolean(row.isActive),
    onHand: Number(row.onHand),
  }));
}

/**
 * Receipt and issue volume per week. WEEKDAY() is 0 on Monday, so subtracting it
 * gives the Monday that starts each movement's week — the same boundary
 * startOfWeek() uses in JavaScript, because both run in UTC.
 */
async function getWeeklyVolume(from) {
  const rows = await prisma.$queryRaw`
    SELECT DATE_FORMAT(DATE_SUB(occurredAt, INTERVAL WEEKDAY(occurredAt) DAY), '%Y-%m-%d') AS weekStart,
           CAST(SUM(kind = 'RECEIPT') AS SIGNED) AS receiptCount,
           CAST(SUM(CASE WHEN kind = 'RECEIPT' THEN quantity ELSE 0 END) AS SIGNED) AS receiptQuantity,
           CAST(SUM(kind = 'ISSUE') AS SIGNED) AS issueCount,
           CAST(SUM(CASE WHEN kind = 'ISSUE' THEN quantity ELSE 0 END) AS SIGNED) AS issueQuantity
    FROM stock_movements
    WHERE occurredAt >= ${from}
    GROUP BY weekStart
    ORDER BY weekStart ASC
  `;
  return rows;
}

/** A week with no trading has no row, so pad the series out to eight points. */
function fillMissingWeeks(rows, from) {
  // weekStart arrives already formatted as a string, so there is no Date to
  // reinterpret in a different timezone.
  const byWeek = new Map(rows.map((row) => [row.weekStart, row]));

  return Array.from({ length: WEEKS_CHARTED }, (_, index) => {
    const weekStart = toDateKey(addDays(from, index * 7));
    const row = byWeek.get(weekStart);
    return {
      weekStart,
      receiptCount: Number(row?.receiptCount ?? 0),
      receiptQuantity: Number(row?.receiptQuantity ?? 0),
      issueCount: Number(row?.issueCount ?? 0),
      issueQuantity: Number(row?.issueQuantity ?? 0),
    };
  });
}
