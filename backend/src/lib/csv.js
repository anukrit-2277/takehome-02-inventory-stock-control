import { parse } from 'csv-parse/sync';

import { badRequest } from './errors.js';

const MAX_ROWS = 5000;

/** "Reorder Level", "reorder_level" and "reorderLevel" all become "reorderlevel". */
const normalise = (header) => header.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Parses an uploaded CSV into clean rows.
 *
 * `columns` maps normalised header names to the field names we want, which also
 * lets a file use a friendlier heading than our internal one. Each row comes
 * back with the line number it occupied in the file, so an error report can
 * point at the line the user has to go and fix.
 */
export function parseCsv(buffer, columns) {
  let records;
  try {
    records = parse(buffer, {
      bom: true,
      trim: true,
      skip_empty_lines: true,
      columns: (header) => header.map(normalise),
      info: true,
    });
  } catch (error) {
    throw badRequest(`Could not read the CSV file: ${error.message}`);
  }

  if (records.length === 0) throw badRequest('The file has no data rows');
  if (records.length > MAX_ROWS) throw badRequest(`Too many rows: ${records.length}, the limit is ${MAX_ROWS}`);

  return records.map(({ record, info }) => {
    const row = {};
    for (const [header, field] of Object.entries(columns)) {
      if (record[header] !== undefined && record[header] !== '') row[field] = record[header];
    }
    return { line: info.lines, row };
  });
}

/** Turns a thrown error into one sentence for the failure report. */
export function describeFailure(error) {
  if (error.details?.length) {
    return error.details.map((d) => `${d.field}: ${d.message}`).join('; ');
  }
  if (error.code === 'P2002') return 'A record with that value already exists';
  return error.message ?? 'Unexpected error';
}
