import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authRoutes } from '../modules/auth/auth.routes.js';

export const router = Router();

router.get('/health', async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: 'ok', time: new Date().toISOString() });
});

router.use('/auth', authRoutes);

// Feature routers are mounted here as each phase lands.
