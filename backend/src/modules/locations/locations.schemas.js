import { z } from 'zod';

export const createLocationSchema = z.object({
  code: z.string().trim().toUpperCase().min(1, 'Code is required').max(32),
  name: z.string().trim().min(1, 'Name is required').max(120),
});

export const updateLocationSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    isActive: z.boolean(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, 'Provide at least one field to update');
