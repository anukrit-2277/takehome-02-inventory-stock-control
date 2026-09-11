import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const router = Router();

router.get('/health', async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Feature routers are mounted here as each phase lands.
