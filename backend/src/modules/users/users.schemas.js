import { z } from 'zod';

/**
 * A person's name.
 *
 * The only structural rule is that it contains at least one letter, which
 * rejects "12345" and "!!!" without inventing rules about what a real name looks
 * like. Deliberately permissive about scripts, accents, hyphens, apostrophes and
 * digits — "José Ramírez-O'Neill" and "Jean-Luc" are names, and an internal tool
 * has no business rejecting them.
 */
const personName = z
  .string()
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(120, 'Name must be 120 characters or fewer')
  .regex(/\p{L}/u, 'Name must contain at least one letter');

/**
 * Password strength.
 *
 * Each rule is its own check so the response names every requirement the
 * password misses, rather than one unhelpful "password too weak". Zod collects
 * all of them, and the client renders them as a list.
 *
 * The upper bound exists because bcrypt silently ignores anything past 72 bytes;
 * rejecting longer input is more honest than truncating it.
 */
const strongPassword = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be 72 characters or fewer')
  .regex(/[a-z]/, 'Password must include a lowercase letter')
  .regex(/[A-Z]/, 'Password must include an uppercase letter')
  .regex(/[0-9]/, 'Password must include a number')
  .regex(/[^A-Za-z0-9]/, 'Password must include a symbol');

export const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email('A valid email is required'),
  name: personName,
  // Retyping the password is checked in the form, not here. It guards against a
  // typo the person making the account cannot see; the server has nothing extra
  // to protect by receiving the same value twice.
  password: strongPassword,
  role: z.enum(['MANAGER', 'STAFF']),
});

export const updateUserSchema = z
  .object({
    name: personName,
    role: z.enum(['MANAGER', 'STAFF']),
    isActive: z.boolean(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, 'Provide at least one field to update');

export const setAssignmentsSchema = z.object({
  locationIds: z.array(z.number().int().positive()),
});
