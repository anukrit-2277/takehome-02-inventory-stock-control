import { z } from 'zod';

import { isRealCalendarDate } from '../../lib/dates.js';

// CSV values are always strings, so numbers and dates are coerced here rather
// than reusing the JSON schemas.

// A blank cell arrives as undefined, which would otherwise produce Zod's
// "expected string, received undefined". These give the failure report a
// sentence the person fixing the file can act on.
// max() needs its own message: the schema-level `error` option applies to every
// issue on the string, so without this a 250-character name reported
// "Name is required", which is misleading rather than merely unhelpful.
const required = (label, max) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be ${max} characters or fewer`);

const wholeNumber = (label) =>
  z.coerce.number({ error: `${label} must be a whole number` }).int(`${label} must be a whole number`);

export const itemRowSchema = z.object({
  sku: required('SKU', 64).toUpperCase(),
  name: required('Name', 200),
  description: z.string().trim().max(2000).optional(),
  unit: required('Unit of measure', 32),
  reorderLevel: wholeNumber('Reorder level').min(0, 'Reorder level cannot be negative'),
  category: required('Category', 80),
});

export const receiptRowSchema = z.object({
  sku: required('SKU', 64).toUpperCase(),
  locationCode: required('Location', 32).toUpperCase(),
  quantity: wholeNumber('Quantity').positive('Quantity must be greater than zero'),
  // Checked as a string first: JavaScript turns 2026-02-30 into 2 March rather
  // than rejecting it, which would file the receipt under a day nobody typed.
  occurredAt: z
    .string()
    .refine(isRealCalendarDate, 'Date is not a real calendar date')
    .pipe(z.coerce.date({ error: 'Date is not a valid date' }))
    .refine((d) => d <= new Date(), 'Date cannot be in the future')
    .optional(),
  note: z.string().trim().max(2000).optional(),
});

// Maps normalised CSV headers onto our field names. Several spellings are
// accepted because people write these files by hand.
export const ITEM_COLUMNS = {
  sku: 'sku',
  name: 'name',
  description: 'description',
  unitofmeasure: 'unit',
  unit: 'unit',
  uom: 'unit',
  reorderlevel: 'reorderLevel',
  reorder: 'reorderLevel',
  category: 'category',
};

export const RECEIPT_COLUMNS = {
  sku: 'sku',
  location: 'locationCode',
  locationcode: 'locationCode',
  quantity: 'quantity',
  qty: 'quantity',
  occurredat: 'occurredAt',
  date: 'occurredAt',
  note: 'note',
};
