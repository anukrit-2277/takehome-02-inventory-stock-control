import { Router } from 'express';

import * as controller from './movements.controller.js';
import { createMovementSchema, listMovementsSchema } from './movements.schemas.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';

export const movementRoutes = Router();

movementRoutes.use(requireAuth);

// Both roles record movements. Which kinds, and at which locations, is decided
// per request inside the service — staff are limited to receipts, issues and
// transfers at their own locations (goals 1 and 5).
movementRoutes.get('/', validate(listMovementsSchema, 'query'), controller.list);
movementRoutes.post('/', validate(createMovementSchema), controller.create);
