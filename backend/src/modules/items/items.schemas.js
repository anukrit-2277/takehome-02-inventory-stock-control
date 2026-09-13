import { z } from 'zod';
import { paginationSchema } from '../../lib/pagination.js';

export const createItemSchema = z.object({
  sku: z.string().trim().toUpperCase().min(1, 'SKU is required').max(64),
  name: z.string().trim().min(1, 'Name is required').max(200),
  description: z.string().trim().max(2000).optional(),
  unitId: z.number().int().positive(),
  reorderLevel: z.number().int().min(0, 'Reorder level cannot be negative'),
  categoryId: z.number().int().positive(),
});

export const updateItemSchema = createItemSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, 'Provide at least one field to update');

// Query params arrive as strings, so "false" would coerce to true under
// z.coerce.boolean(). Accepting only the two literals avoids that and rejects
// anything else outright.
const booleanParam = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .optional();

export const listItemsSchema = paginationSchema.extend({
  search: z.string().trim().max(200).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  locationId: z.coerce.number().int().positive().optional(),
  // Archived items drop out of day-to-day lists unless asked for (goal 2).
  archived: z.enum(['active', 'archived', 'all']).default('active'),
  belowReorder: booleanParam,
  sort: z.enum(['name', 'sku', 'onHand', 'reorderLevel', 'createdAt']).default('name'),
  direction: z.enum(['asc', 'desc']).default('asc'),
});

export const createNoteSchema = z.object({
  note: z.string().trim().min(1, 'A note cannot be empty').max(2000),
});

export const timelineQuerySchema = paginationSchema;
