/**
 * Boundaries for the dashboard's time windows.
 *
 * These are computed in JavaScript and passed to SQL as parameters rather than
 * using MySQL's date functions, so "today" and "this week" mean the same thing
 * in the query as they do in the rest of the application.
 */

export function startOfDay(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

/** Monday 00:00 of the week the given date falls in. */
export function startOfWeek(date = new Date()) {
  const start = startOfDay(date);
  const daysSinceMonday = (start.getDay() + 6) % 7; // getDay(): Sunday is 0
  start.setDate(start.getDate() - daysSinceMonday);
  return start;
}

export function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** "2026-09-12" in local time, for matching SQL's DATE() output. */
export function toDateKey(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
