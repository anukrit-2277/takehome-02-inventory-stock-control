import bcrypt from 'bcryptjs';

import { prisma, TRANSACTION_OPTIONS } from '../../lib/prisma.js';
import { badRequest, notFound } from '../../lib/errors.js';

// Shared shape for every user we return. Chosen explicitly so a password hash
// can never leak by someone adding a field to the model later.
const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  createdAt: true,
  assignments: { select: { location: { select: { id: true, code: true, name: true } } } },
};

/** Flattens assignments into a plain list of locations. */
function present(user) {
  const { assignments, ...rest } = user;
  return { ...rest, locations: assignments.map((a) => a.location) };
}

export async function listUsers() {
  const users = await prisma.user.findMany({ select: userSelect, orderBy: { name: 'asc' } });
  return users.map(present);
}

export async function createUser({ password, ...data }) {
  const user = await prisma.user.create({
    data: { ...data, passwordHash: await bcrypt.hash(password, 10) },
    select: userSelect,
  });
  return present(user);
}

export async function updateUser(id, data, actor) {
  // A manager who demotes or deactivates themselves could lock everyone out of
  // the manager-only routes, so those two fields are off limits on your own row.
  if (id === actor.id && (data.role !== undefined || data.isActive !== undefined)) {
    throw badRequest('You cannot change your own role or active status');
  }

  await findOrThrow(id);
  const user = await prisma.user.update({ where: { id }, data, select: userSelect });
  return present(user);
}

/**
 * Replaces a user's location assignments with exactly the set given (goal 5).
 * Sending [] clears them.
 */
export async function setAssignments(userId, locationIds, actor) {
  const ids = [...new Set(locationIds)];

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw notFound(`User ${userId} not found`);

    const found = await tx.location.count({ where: { id: { in: ids } } });
    if (found !== ids.length) throw badRequest('One or more locations do not exist');

    await tx.locationAssignment.deleteMany({ where: { userId } });
    if (ids.length > 0) {
      await tx.locationAssignment.createMany({
        data: ids.map((locationId) => ({ userId, locationId, assignedById: actor.id })),
      });
    }

    return present(await tx.user.findUnique({ where: { id: userId }, select: userSelect }));
  }, TRANSACTION_OPTIONS);
}

async function findOrThrow(id) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw notFound(`User ${id} not found`);
  return user;
}
