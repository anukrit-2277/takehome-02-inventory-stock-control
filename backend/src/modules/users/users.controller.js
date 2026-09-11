import * as service from './users.service.js';
import { parseId } from '../../lib/params.js';

export async function list(_req, res) {
  res.json({ users: await service.listUsers() });
}

export async function create(req, res) {
  res.status(201).json({ user: await service.createUser(req.body) });
}

export async function update(req, res) {
  res.json({ user: await service.updateUser(parseId(req.params.id), req.body, req.user) });
}

export async function setAssignments(req, res) {
  const user = await service.setAssignments(parseId(req.params.id), req.body.locationIds, req.user);
  res.json({ user });
}
