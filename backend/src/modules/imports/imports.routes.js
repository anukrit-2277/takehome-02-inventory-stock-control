import { Router } from 'express';

import * as controller from './imports.controller.js';
import { uploadCsv } from '../../middleware/upload.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';

export const importRoutes = Router();

importRoutes.use(requireAuth);

// Creating items is a manager job, so importing them is too. Receipts are
// everyday work, so staff may import those — each row is still checked against
// the locations they are assigned to.
importRoutes.post('/items', requireRole('MANAGER'), uploadCsv, controller.items);
importRoutes.post('/receipts', uploadCsv, controller.receipts);
