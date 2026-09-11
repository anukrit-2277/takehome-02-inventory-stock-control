import { badRequest } from './errors.js';

/** Parses a numeric :id route param, rejecting anything that is not a positive integer. */
export function parseId(value, name = 'id') {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw badRequest(`Invalid ${name}: ${value}`);
  return id;
}
