import { prisma } from '../../lib/prisma.js';
import { conflict, notFound } from '../../lib/errors.js';

export function listCategories() {
  return prisma.category.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { items: true } } },
  });
}

export function createCategory(data) {
  return prisma.category.create({ data });
}

export async function updateCategory(id, data) {
  await findOrThrow(id);
  return prisma.category.update({ where: { id }, data });
}

export async function deleteCategory(id) {
  const category = await findOrThrow(id);
  // Items must always have a category, so a category in use cannot be removed.
  const inUse = await prisma.item.count({ where: { categoryId: id } });
  if (inUse > 0) {
    throw conflict(`"${category.name}" is used by ${inUse} item(s) and cannot be deleted`);
  }
  await prisma.category.delete({ where: { id } });
}

async function findOrThrow(id) {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) throw notFound(`Category ${id} not found`);
  return category;
}
