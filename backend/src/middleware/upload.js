import multer from 'multer';

import { badRequest } from '../lib/errors.js';

// Imports are small enough to hold in memory; nothing is written to disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

/** Accepts one file in the "file" field and fails clearly when none is sent. */
export function uploadCsv(req, res, next) {
  upload.single('file')(req, res, (error) => {
    if (error) {
      return next(
        error.code === 'LIMIT_FILE_SIZE'
          ? badRequest('The file is larger than the 2MB limit')
          : badRequest(error.message),
      );
    }
    if (!req.file) return next(badRequest('Attach a CSV file in the "file" field'));
    next();
  });
}
