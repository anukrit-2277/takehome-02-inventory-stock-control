import { Router } from 'express';

import * as controller from './dashboard.controller.js';
import { requireAuth } from '../../middleware/auth.js';

export const dashboardRoutes = Router();

// Both roles see the same figures. The brief wants whoever buys stock to spot
// shortages at a glance, and staff seeing the same picture costs nothing.
dashboardRoutes.get('/', requireAuth, controller.get);
