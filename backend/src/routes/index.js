import { Router } from 'express';

import { prisma } from '../lib/prisma.js';
import { authRoutes } from '../modules/auth/auth.routes.js';
import { categoryRoutes } from '../modules/categories/categories.routes.js';
import { locationRoutes } from '../modules/locations/locations.routes.js';
import { userRoutes } from '../modules/users/users.routes.js';
import { itemRoutes } from '../modules/items/items.routes.js';
import { movementRoutes } from '../modules/movements/movements.routes.js';

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
