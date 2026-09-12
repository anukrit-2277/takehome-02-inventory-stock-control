import * as service from './items.service.js';
// On-hand is derived from the ledger, so the movement service owns that query.
import { getItemStock } from '../movements/movements.service.js';
import { parseId } from '../../lib/params.js';

export async function list(req, res) {
  res.json(await service.listItems(req.validatedQuery));
}

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

export async function stock(req, res) {
  res.json(await getItemStock(parseId(req.params.id)));
}

export async function timeline(req, res) {
  res.json(await service.getTimeline(parseId(req.params.id), req.validatedQuery));
}

export async function addNote(req, res) {
  const event = await service.addNote(parseId(req.params.id), req.body.note, req.user);
  res.status(201).json({ event });
}
