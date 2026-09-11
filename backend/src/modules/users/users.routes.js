import { Router } from 'express';

import * as controller from './users.controller.js';
import { createUserSchema, updateUserSchema, setAssignmentsSchema } from './users.schemas.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';

export const userRoutes = Router();

// Staff have no business listing accounts or changing who works where, so the
// whole module is manager-only (goals 1 and 5).
userRoutes.use(requireAuth, requireRole('MANAGER'));

userRoutes.get('/', controller.list);
userRoutes.post('/', validate(createUserSchema), controller.create);
userRoutes.patch('/:id', validate(updateUserSchema), controller.update);
userRoutes.put('/:id/locations', validate(setAssignmentsSchema), controller.setAssignments);
