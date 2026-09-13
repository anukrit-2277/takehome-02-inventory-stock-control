import { Router } from 'express';

import * as controller from './units.controller.js';
import { createUnitSchema, updateUnitSchema } from './units.schemas.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';

export const unitRoutes = Router();

unitRoutes.use(requireAuth);

// Everyone reads units to file items and read quantities; only managers
// maintain the list itself.
unitRoutes.get('/', controller.list);
unitRoutes.post('/', requireRole('MANAGER'), validate(createUnitSchema), controller.create);
unitRoutes.patch('/:id', requireRole('MANAGER'), validate(updateUnitSchema), controller.update);
unitRoutes.delete('/:id', requireRole('MANAGER'), controller.remove);
