import { z } from 'zod';

export const createItemSchema = z.object({
  sku: z.string().trim().toUpperCase().min(1, 'SKU is required').max(64),
  name: z.string().trim().min(1, 'Name is required').max(200),
  description: z.string().trim().max(2000).optional(),
  unitOfMeasure: z.string().trim().min(1, 'Unit of measure is required').max(32),
  reorderLevel: z.number().int().min(0, 'Reorder level cannot be negative'),
  categoryId: z.number().int().positive(),
});

export const updateItemSchema = createItemSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, 'Provide at least one field to update');
