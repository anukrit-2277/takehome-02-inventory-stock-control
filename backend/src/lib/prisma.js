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

/**
 * Options for every interactive transaction.
 *
 * Prisma's defaults (5s timeout, 2s to acquire a connection) assume the
 * database is next door. Recording a movement makes about eight round trips —
 * lock the item, read it, load its locations, sum the balance, insert the
 * movement and its lines, then re-check the low-stock alert — so on a managed
 * database a few hundred milliseconds away the default is not enough. Seeding
 * against a remote MySQL failed on exactly this, 5176ms against a 5000ms limit.
 *
 * In production the API should sit beside the database and these transactions
 * finish in tens of milliseconds; the headroom is for the times it does not.
 */
export const TRANSACTION_OPTIONS = { timeout: 20_000, maxWait: 10_000 };
