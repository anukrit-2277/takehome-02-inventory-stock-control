import { prisma } from '../lib/prisma.js';
import { unauthorized, forbidden } from '../lib/errors.js';
import { verifyAccessToken } from '../modules/auth/auth.service.js';

/**
 * Verifies the bearer token and puts the current user on req.user.
 *
 * The user is read from the database on every request rather than trusted from
 * the token's claims, so deactivating an account or changing someone's role
 * takes effect immediately instead of when their access token expires.
 */
export async function requireAuth(req, _res, next) {
  const [scheme, token] = (req.get('authorization') ?? '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(unauthorized('Missing bearer token'));
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return next(unauthorized('Invalid or expired access token'));
  }

  const user = await prisma.user.findUnique({
    where: { id: Number(payload.sub) },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      assignments: { select: { locationId: true } },
    },
  });
  if (!user || !user.isActive) {
    return next(unauthorized('This account is no longer active'));
  }

  req.user = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    // Empty for managers, who are not assigned to locations because they can
    // act at all of them.
    locationIds: user.assignments.map((a) => a.locationId),
  };
  next();
}

/** Restricts a route to the given roles. Use after requireAuth. */
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(forbidden(`This action requires the ${roles.join(' or ')} role`));
    }
    next();
  };
}
