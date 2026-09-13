import { z } from 'zod';

// Short and lowercase by convention: "each", "box", "metre". Stored exactly as
// entered after trimming, so the dropdown and every display read the same.
const unitCode = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Unit is required')
  .max(32, 'Unit must be 32 characters or fewer')
  .regex(/^[\p{L}\p{N}\s./-]+$/u, 'Unit can only contain letters, numbers, spaces and / . -');

export const createUnitSchema = z.object({ code: unitCode });
export const updateUnitSchema = createUnitSchema;
