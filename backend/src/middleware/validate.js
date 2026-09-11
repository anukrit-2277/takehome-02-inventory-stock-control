import { badRequest } from '../lib/errors.js';

/**
 * Validates one part of the request against a Zod schema and REPLACES it with
 * the parsed result, so handlers always receive coerced, trimmed, typed values
 * and never touch the raw body.
 */
export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || source,
        message: issue.message,
      }));
      return next(badRequest('Validation failed', details));
    }
    // req.query is a getter in Express 5, so assign onto a stable property.
    if (source === 'query') req.validatedQuery = result.data;
    else req[source] = result.data;
    next();
  };
}
