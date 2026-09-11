import { forbidden } from './errors.js';

/** Managers act everywhere. Staff act only at the locations assigned to them. */
export function canActAtLocation(user, locationId) {
  if (user.role === 'MANAGER') return true;
  return user.locationIds.includes(locationId);
}

/**
 * Throws unless the user may act at every location given. Nulls are ignored, so
 * callers can pass a movement's three location fields without filtering first.
 */
export function assertCanActAtLocations(user, ...locationIds) {
  const denied = locationIds.filter((id) => id != null && !canActAtLocation(user, id));
  if (denied.length > 0) {
    throw forbidden(`You are not assigned to location ${denied.join(', ')}`);
  }
}
