import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email('A valid email is required'),
  name: z.string().trim().min(1, 'Name is required').max(120),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['MANAGER', 'STAFF']),
});

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    role: z.enum(['MANAGER', 'STAFF']),
    isActive: z.boolean(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, 'Provide at least one field to update');

export const setAssignmentsSchema = z.object({
  locationIds: z.array(z.number().int().positive()),
});
