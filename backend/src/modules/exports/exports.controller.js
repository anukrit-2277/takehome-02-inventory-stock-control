import * as service from './exports.service.js';

export async function stockPosition(req, res) {
  const csv = await service.stockPositionCsv({ archived: req.validatedQuery.archived });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${service.stockPositionFilename()}"`);
  // Leading byte order mark, so Excel opens the file as UTF-8 rather than
  // guessing and mangling any non-ASCII item name.
  res.send('\uFEFF' + csv);
}
