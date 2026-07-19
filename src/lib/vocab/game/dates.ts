/**
 * Word Hunt — Dhaka (UTC+6) calendar-day helpers.
 *
 * The game's day boundary is Bangladesh time, not server/UTC time — a round
 * "for" 2026-07-19 is playable at full points from 00:00 to 23:59 Dhaka time.
 */

const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;

/** Today's date in Dhaka time, as 'YYYY-MM-DD'. */
export function todayDhaka(): string {
  return toDhakaDateString(new Date());
}

/** Convert any instant to its Dhaka calendar-day string 'YYYY-MM-DD'. */
export function toDhakaDateString(date: Date): string {
  const dhaka = new Date(date.getTime() + DHAKA_OFFSET_MS);
  return dhaka.toISOString().slice(0, 10);
}

/** -1 if a < b, 0 if equal, 1 if a > b. Both are 'YYYY-MM-DD' strings. */
export function compareDates(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function isFutureDate(date: string): boolean {
  return compareDates(date, todayDhaka()) > 0;
}

export function isPastDate(date: string): boolean {
  return compareDates(date, todayDhaka()) < 0;
}
