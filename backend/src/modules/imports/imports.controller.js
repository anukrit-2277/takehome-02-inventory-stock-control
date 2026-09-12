import * as service from './imports.service.js';

export async function items(req, res) {
  res.json(await service.importItems(req.file.buffer, req.user));
}

export async function receipts(req, res) {
  res.json(await service.importReceipts(req.file.buffer, req.user));
}
