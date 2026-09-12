import { z } from 'zod';
import { paginationSchema } from '../../lib/pagination.js';

export const listAlertsSchema = paginationSchema.extend({
  includeDismissed: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});
