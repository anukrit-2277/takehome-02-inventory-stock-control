import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

// Set LOG_QUERIES=true to print every statement Prisma sends, which is the
// quickest way to check that filtering and sorting really happen in the
// database rather than in JavaScript.
const logLevels =
  process.env.LOG_QUERIES === 'true'
    ? ['query', 'warn', 'error']
    : env.nodeEnv === 'development'
      ? ['warn', 'error']
      : ['error'];

export const prisma = new PrismaClient({ log: logLevels });
