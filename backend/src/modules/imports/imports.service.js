import { prisma } from '../../lib/prisma.js';
import { badRequest } from '../../lib/errors.js';
import { parseCsv, describeFailure } from '../../lib/csv.js';
import { createItem } from '../items/items.service.js';
import { recordMovement } from '../movements/movements.service.js';
import { itemRowSchema, receiptRowSchema, ITEM_COLUMNS, RECEIPT_COLUMNS } from './imports.schemas.js';

/**
 * Runs one handler per row and collects the outcome of each.
 *
 * Rows are deliberately independent: each handler opens its own transaction, so
 * a row that fails rolls back only itself and every valid row is still imported
 * (goal 7). The report names the line number in the uploaded file.
 */
async function importRows(rows, handleRow) {
  const report = { totalRows: rows.length, imported: 0, failed: 0, failures: [] };

  for (const { line, row } of rows) {
    try {
      await handleRow(row);
      report.imported += 1;
    } catch (error) {
      report.failed += 1;
      report.failures.push({ line, sku: row.sku ?? null, error: describeFailure(error) });
    }
  }
  return report;
}

/**
 * Validates a CSV row and throws its first problem as a plain sentence. The
 * messages in the row schemas already name their field, so nothing is prefixed.
 */
function parseRow(schema, row) {
  const result = schema.safeParse(row);
  if (!result.success) throw badRequest(result.error.issues[0].message);
  return result.data;
}

export async function importItems(buffer, actor) {
  const rows = parseCsv(buffer, ITEM_COLUMNS);

  // Categories are a list managers maintain, so an unknown one is an error
  // rather than something the import quietly creates (goal 2).
  const categories = await prisma.category.findMany({ select: { id: true, name: true } });
  const categoryByName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));

  return importRows(rows, async (row) => {
    const { category, ...data } = parseRow(itemRowSchema, row);

    const categoryId = categoryByName.get(category.toLowerCase());
    if (!categoryId) {
      throw badRequest(`Unknown category "${category}" — create it first`);
    }
    await createItem({ ...data, categoryId }, actor);
  });
}

export async function importReceipts(buffer, actor) {
  const rows = parseCsv(buffer, RECEIPT_COLUMNS);

  const [items, locations] = await Promise.all([
    prisma.item.findMany({ select: { id: true, sku: true } }),
    prisma.location.findMany({ select: { id: true, code: true } }),
  ]);
  const itemBySku = new Map(items.map((i) => [i.sku.toUpperCase(), i.id]));
  const locationByCode = new Map(locations.map((l) => [l.code.toUpperCase(), l.id]));

  return importRows(rows, async (row) => {
    const data = parseRow(receiptRowSchema, row);

    const itemId = itemBySku.get(data.sku);
    if (!itemId) throw badRequest(`No item with SKU "${data.sku}"`);

    const locationId = locationByCode.get(data.locationCode);
    if (!locationId) throw badRequest(`No location with code "${data.locationCode}"`);

    // Goes through the ledger service, so archived items, inactive locations
    // and staff location limits all still apply, row by row.
    await recordMovement(
      {
        itemId,
        kind: 'RECEIPT',
        quantity: data.quantity,
        locationId,
        occurredAt: data.occurredAt,
        note: data.note,
      },
      actor,
    );
  });
}
