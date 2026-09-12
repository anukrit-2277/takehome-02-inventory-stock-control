import { Router } from 'express';
import { z } from 'zod';

import * as controller from './exports.controller.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';

const exportQuerySchema = z.object({
  archived: z.enum(['active', 'archived', 'all']).default('active'),
});

export const exportRoutes = Router();

exportRoutes.use(requireAuth);

exportRoutes.get('/stock-position', validate(exportQuerySchema, 'query'), controller.stockPosition);
