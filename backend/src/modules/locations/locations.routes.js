import { Router } from 'express';

import * as controller from './locations.controller.js';
import { createLocationSchema, updateLocationSchema } from './locations.schemas.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';

export const locationRoutes = Router();

locationRoutes.use(requireAuth);

// Staff can see every location because movement forms and item pages name them.
// Whether they may *act* at one is a separate check, made per movement.
locationRoutes.get('/', controller.list);
locationRoutes.post('/', requireRole('MANAGER'), validate(createLocationSchema), controller.create);
locationRoutes.patch('/:id', requireRole('MANAGER'), validate(updateLocationSchema), controller.update);
