import * as service from './items.service.js';
import { parseId } from '../../lib/params.js';

export async function get(req, res) {
  res.json({ item: await service.getItem(parseId(req.params.id)) });
}

export async function create(req, res) {
  res.status(201).json({ item: await service.createItem(req.body, req.user) });
}

export async function update(req, res) {
  res.json({ item: await service.updateItem(parseId(req.params.id), req.body, req.user) });
}

export async function archive(req, res) {
  res.json({ item: await service.archiveItem(parseId(req.params.id), req.user) });
}

export async function restore(req, res) {
  res.json({ item: await service.restoreItem(parseId(req.params.id), req.user) });
}
