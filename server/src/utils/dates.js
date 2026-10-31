// Dates are stored as UTC. Calendar days (streaks, charts) are computed in the user's IANA timezone.
export function isValidTimezone(tz) {
  try { new Intl.DateTimeFormat('en-CA', { timeZone: tz }); return typeof tz === 'string' && tz.length < 64; } catch { return false; }
}
export const dayKey = (date, tz = 'UTC') =>
  new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
export function shiftDayKey(key, delta) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}
export const addDays = (date, days) => new Date(date.getTime() + days * 86400000);
export const addMinutes = (date, min) => new Date(date.getTime() + min * 60000);
