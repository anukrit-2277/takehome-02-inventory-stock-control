import * as service from './dashboard.service.js';

export async function get(_req, res) {
  res.json(await service.getDashboard());
}
