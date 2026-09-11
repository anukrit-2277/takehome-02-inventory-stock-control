import { Prisma } from '@prisma/client';
import { AppError } from '../lib/errors.js';
import { isProduction } from '../config/env.js';

// Maps a database constraint name to something a user can act on. Anything not
// listed falls back to a generic message rather than leaking SQL.
const CHECK_CONSTRAINT_MESSAGES = {
  chk_movement_shape:
    'A transfer needs a source and a destination location; every other movement needs a single location',
  chk_movement_quantity_nonzero: 'Quantity cannot be zero',
  chk_movement_positive_unless_adjustment:
    'Receipts, issues and transfers must have a positive quantity',
  chk_movement_adjustment_reason: 'An adjustment must include a reason',
  chk_line_delta_nonzero: 'A ledger line cannot move zero units',
  chk_item_reorder_level_nonnegative: 'Reorder level cannot be negative',
};

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.originalUrl}` } });
}

// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity.
export function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
    });
  }

  // Unique constraint violations are a normal outcome of a user typing a
  // duplicate SKU or email, so translate them rather than 500-ing.
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    const fields = err.meta?.target;
    return res.status(409).json({
      error: { code: 'CONFLICT', message: 'A record with that value already exists', details: { fields } },
    });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } });
  }

  // The database enforces rules Prisma cannot express: append-only triggers and
  // CHECK constraints. Those surface as raw connector errors, so translate them
  // into the same shaped responses the service layer produces. Reaching one of
  // these means a code path tried something the service should have caught, so
  // log it loudly — but still answer the client sensibly rather than 500.
  const raw = typeof err?.message === 'string' ? err.message : '';

  if (raw.includes('is append-only')) {
    console.error('[append-only violation]', raw);
    return res.status(409).json({
      error: {
        code: 'APPEND_ONLY',
        message: 'This record is part of an append-only history and cannot be changed or removed',
      },
    });
  }

  const check = raw.match(/Check constraint '([^']+)' is violated/);
  if (check) {
    console.error('[check constraint violation]', raw);
    return res.status(422).json({
      error: {
        code: 'UNPROCESSABLE',
        message: CHECK_CONSTRAINT_MESSAGES[check[1]] ?? 'That record breaks a database rule',
        details: { constraint: check[1] },
      },
    });
  }

  console.error('[unhandled]', err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong',
      ...(isProduction ? {} : { detail: err.message }),
    },
  });
}
