import * as service from './movements.service.js';

export async function create(req, res) {
  res.status(201).json({ movement: await service.recordMovement(req.body, req.user) });
}

export async function list(req, res) {
  res.json(await service.listMovements(req.validatedQuery));
}
