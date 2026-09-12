import * as service from './alerts.service.js';
import { parseId } from '../../lib/params.js';

export async function list(req, res) {
  res.json(await service.listLowStock(req.validatedQuery));
}

export async function dismiss(req, res) {
  const dismissal = await service.dismissAlert(parseId(req.params.itemId), req.user);
  res.status(201).json({ dismissal });
}

export async function restore(req, res) {
  await service.restoreAlert(parseId(req.params.itemId));
  res.status(204).end();
}
