import { prisma } from '../../lib/prisma.js';
import { conflict, notFound } from '../../lib/errors.js';

export function listUnits() {
  return prisma.unit.findMany({
    orderBy: { code: 'asc' },
    include: { _count: { select: { items: true } } },
  });
}

export function createUnit(data) {
  return prisma.unit.create({ data });
}

export async function updateUnit(id, data) {
  await findOrThrow(id);
  return prisma.unit.update({ where: { id }, data });
}

export async function deleteUnit(id) {
  const unit = await findOrThrow(id);

  // Items must always have a unit, so a unit in use cannot be removed. Same
  // rule as categories, and the foreign key would refuse it anyway.
  const inUse = await prisma.item.count({ where: { unitId: id } });
  if (inUse > 0) {
    throw conflict(`"${unit.code}" is used by ${inUse} item(s) and cannot be deleted`);
  }
  await prisma.unit.delete({ where: { id } });
}

async function findOrThrow(id) {
  const unit = await prisma.unit.findUnique({ where: { id } });
  if (!unit) throw notFound(`Unit ${id} not found`);
  return unit;
}
