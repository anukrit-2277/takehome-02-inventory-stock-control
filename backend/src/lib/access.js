import { forbidden } from './errors.js';

/** Managers act everywhere. Staff act only at the locations assigned to them. */
export function canActAtLocation(user, locationId) {
  if (user.role === 'MANAGER') return true;
  return (user.locationIds ?? []).includes(locationId);
}

/**
 * Throws unless the user may act at every location given, naming the ones they
 * may not by code — a transfer is checked at both ends.
 *
 * Takes location records rather than ids so the message reads "RT-SOUTH"
 * instead of "location 3", which matters in a CSV import report.
 */
export function assertCanActAtLocations(user, locations) {
  const denied = locations.filter((location) => !canActAtLocation(user, location.id));
  if (denied.length > 0) {
    throw forbidden(`You are not assigned to ${denied.map((l) => l.code).join(', ')}`);
  }
}
