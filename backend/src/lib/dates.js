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

/**
 * True when a date string names a day that actually exists.
 *
 * JavaScript rolls impossible dates forward: new Date('2026-02-30') is 2 March
 * and new Date('2026-02-29') is 1 March, because 2026 is not a leap year. Left
 * alone, a CSV row dated 30 February would be filed under a day nobody typed —
 * and movements are append-only, so that date could never be corrected.
 * Anything that is not a plain "YYYY-MM-DD..." string is left to Date parsing.
 */
export function isRealCalendarDate(value) {
  if (typeof value !== 'string') return true;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return true;

  const [, year, month, day] = match;
  const parsed = new Date(`${year}-${month}-${day}T00:00:00Z`);
  return (
    parsed.getUTCFullYear() === Number(year) &&
    parsed.getUTCMonth() + 1 === Number(month) &&
    parsed.getUTCDate() === Number(day)
  );
}
