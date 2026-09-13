import * as service from './units.service.js';
import { parseId } from '../../lib/params.js';

export async function list(_req, res) {
  res.json({ units: await service.listUnits() });
}

export async function create(req, res) {
  res.status(201).json({ unit: await service.createUnit(req.body) });
}

export async function update(req, res) {
  res.json({ unit: await service.updateUnit(parseId(req.params.id), req.body) });
}

export async function remove(req, res) {
  await service.deleteUnit(parseId(req.params.id));
  res.status(204).end();
}
