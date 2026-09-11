import { prisma } from '../../lib/prisma.js';
import { notFound } from '../../lib/errors.js';

export function listLocations() {
  return prisma.location.findMany({ orderBy: { code: 'asc' } });
}

export function createLocation(data) {
  return prisma.location.create({ data });
}

export async function updateLocation(id, data) {
  const location = await prisma.location.findUnique({ where: { id } });
  if (!location) throw notFound(`Location ${id} not found`);
  return prisma.location.update({ where: { id }, data });
}

// There is no delete. A location that appears anywhere in the ledger must keep
// existing or its movements would lose their meaning, and the database refuses
// the delete anyway. Deactivating it is the intended way to retire one.
