import * as service from './locations.service.js';
import { parseId } from '../../lib/params.js';

export async function list(_req, res) {
  res.json({ locations: await service.listLocations() });
}

export async function create(req, res) {
  res.status(201).json({ location: await service.createLocation(req.body) });
}

export async function update(req, res) {
  res.json({ location: await service.updateLocation(parseId(req.params.id), req.body) });
}
