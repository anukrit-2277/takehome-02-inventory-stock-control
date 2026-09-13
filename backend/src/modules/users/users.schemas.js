import { z } from 'zod';

/**
 * A person's name.
 *
 * Letters, spaces, hyphens, apostrophes and full stops only — no digits and no
 * other symbols, because a person is not called "demo1". It must also start
 * with a letter, which rules out "-Ann" and ".".
 *
 * \p{L} matches letters in any script and \p{M} matches combining accents, so
 * "José Ramírez-O'Neill", "Jean-Luc", "St. John" and "张伟" are all fine. Being
 * strict about digits is a deliberate trade-off: it rejects the rare name that
 * genuinely contains one, and that is the right call for an internal tool where
 * the realistic input is a placeholder, not an unusual name.
 *
 * Item names are validated separately and DO allow digits — "M8 Hex Bolt 40mm"
 * is a perfectly good product name.
 */
const personName = z
  .string()
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(120, 'Name must be 120 characters or fewer')
  .regex(/^\p{L}/u, 'Name must start with a letter')
  .regex(
    /^[\p{L}\p{M}\s'.-]+$/u,
    'Name can only contain letters, spaces, hyphens and apostrophes',
  );

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
