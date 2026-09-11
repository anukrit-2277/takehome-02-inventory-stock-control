import { Router } from 'express';

import * as controller from './items.controller.js';
import { createItemSchema, updateItemSchema, listItemsSchema } from './items.schemas.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';

export const itemRoutes = Router();

itemRoutes.use(requireAuth);

// Staff read items in order to record movements against them, but only managers
// create, edit or archive them (goals 1 and 2).
itemRoutes.get('/', validate(listItemsSchema, 'query'), controller.list);
itemRoutes.get('/:id', controller.get);
itemRoutes.get('/:id/stock', controller.stock);
itemRoutes.post('/', requireRole('MANAGER'), validate(createItemSchema), controller.create);
itemRoutes.patch('/:id', requireRole('MANAGER'), validate(updateItemSchema), controller.update);
itemRoutes.post('/:id/archive', requireRole('MANAGER'), controller.archive);
itemRoutes.post('/:id/restore', requireRole('MANAGER'), controller.restore);
