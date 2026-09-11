import { z } from 'zod';
import { paginationSchema } from '../../lib/pagination.js';

const positiveQuantity = z.number().int().positive('Quantity must be a positive whole number');
const locationId = z.number().int().positive();

// Recorded time is optional so historical rows can be imported; it can never be
// in the future, because the ledger is a record of what already happened.
const occurredAt = z.coerce
  .date()
  .max(new Date(8.64e15), 'Invalid date')
  .refine((d) => d <= new Date(), 'occurredAt cannot be in the future')
  .optional();

const common = { itemId: z.number().int().positive(), note: z.string().trim().max(2000).optional(), occurredAt };

// A discriminated union means each kind carries exactly the fields it needs, and
// the error message names the kind that failed rather than listing every field.
export const createMovementSchema = z.discriminatedUnion('kind', [
  z.object({ ...common, kind: z.literal('RECEIPT'), quantity: positiveQuantity, locationId }),
  z.object({ ...common, kind: z.literal('ISSUE'), quantity: positiveQuantity, locationId }),
  z.object({
    ...common,
    kind: z.literal('TRANSFER'),
    quantity: positiveQuantity,
    sourceLocationId: locationId,
    destinationLocationId: locationId,
  }).refine(
    (data) => data.sourceLocationId !== data.destinationLocationId,
    { message: 'A transfer needs two different locations', path: ['destinationLocationId'] },
  ),
  z.object({
    ...common,
    kind: z.literal('ADJUSTMENT'),
    // The only kind that may be negative — it is how a miscount gets corrected.
    quantity: z.number().int().refine((n) => n !== 0, 'Quantity cannot be zero'),
    locationId,
    reason: z.string().trim().min(1, 'An adjustment must have a reason').max(500),
  }),
]);

export const listMovementsSchema = paginationSchema.extend({
  itemId: z.coerce.number().int().positive().optional(),
  locationId: z.coerce.number().int().positive().optional(),
  kind: z.enum(['RECEIPT', 'ISSUE', 'TRANSFER', 'ADJUSTMENT']).optional(),
});
