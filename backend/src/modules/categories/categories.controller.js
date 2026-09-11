import * as service from './categories.service.js';
import { parseId } from '../../lib/params.js';

export async function list(_req, res) {
  res.json({ categories: await service.listCategories() });
}

export async function create(req, res) {
  res.status(201).json({ category: await service.createCategory(req.body) });
}

export async function update(req, res) {
  res.json({ category: await service.updateCategory(parseId(req.params.id), req.body) });
}

export async function remove(req, res) {
  await service.deleteCategory(parseId(req.params.id));
  res.status(204).end();
}
