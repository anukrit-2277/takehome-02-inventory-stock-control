import { Router } from 'express';

import { prisma } from '../lib/prisma.js';
import { authRoutes } from '../modules/auth/auth.routes.js';
import { categoryRoutes } from '../modules/categories/categories.routes.js';
import { locationRoutes } from '../modules/locations/locations.routes.js';
import { userRoutes } from '../modules/users/users.routes.js';
import { itemRoutes } from '../modules/items/items.routes.js';
import { movementRoutes } from '../modules/movements/movements.routes.js';
import { importRoutes } from '../modules/imports/imports.routes.js';
import { exportRoutes } from '../modules/exports/exports.routes.js';
import { dashboardRoutes } from '../modules/dashboard/dashboard.routes.js';
import { alertRoutes } from '../modules/alerts/alerts.routes.js';

export const router = Router();

router.get('/health', async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: 'ok', time: new Date().toISOString() });
});

router.use('/auth', authRoutes);
router.use('/categories', categoryRoutes);
router.use('/locations', locationRoutes);
router.use('/users', userRoutes);
router.use('/items', itemRoutes);
router.use('/movements', movementRoutes);
router.use('/imports', importRoutes);
router.use('/exports', exportRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/alerts', alertRoutes);
