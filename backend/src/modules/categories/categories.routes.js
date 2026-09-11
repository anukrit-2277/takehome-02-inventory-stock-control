import { Router } from 'express';

import * as controller from './categories.controller.js';
import { createCategorySchema, updateCategorySchema } from './categories.schemas.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';

export const categoryRoutes = Router();

categoryRoutes.use(requireAuth);

// Everyone needs to read categories to file and find items; only managers
// maintain the list itself (goal 2).
categoryRoutes.get('/', controller.list);
categoryRoutes.post('/', requireRole('MANAGER'), validate(createCategorySchema), controller.create);
categoryRoutes.patch('/:id', requireRole('MANAGER'), validate(updateCategorySchema), controller.update);
categoryRoutes.delete('/:id', requireRole('MANAGER'), controller.remove);
