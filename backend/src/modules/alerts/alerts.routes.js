import { Router } from 'express';

import * as controller from './alerts.controller.js';
import { listAlertsSchema } from './alerts.schemas.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';

export const alertRoutes = Router();

alertRoutes.use(requireAuth);

// Everyone sees the alerts and the count badge; only a manager silences one
// (goal 10).
alertRoutes.get('/low-stock', validate(listAlertsSchema, 'query'), controller.list);
alertRoutes.post('/low-stock/:itemId/dismiss', requireRole('MANAGER'), controller.dismiss);
alertRoutes.delete('/low-stock/:itemId/dismiss', requireRole('MANAGER'), controller.restore);
