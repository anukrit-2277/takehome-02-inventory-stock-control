import { z } from 'zod';

/** Query params every paginated list accepts. */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export function toSkipTake({ page, pageSize }) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

/** Wraps rows with the counts a client needs to render a pager. */
export function withPageInfo(rows, total, { page, pageSize }) {
  return { data: rows, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}
