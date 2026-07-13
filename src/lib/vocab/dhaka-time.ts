/**
 * Day-boundary helpers anchored to Asia/Dhaka (UTC+6, no DST).
 *
 * LexiCore's audience is in Bangladesh — streaks, daily goals, and "today"
 * must flip at midnight Dhaka time, not at midnight server/UTC time.
 * All helpers take and return ordinary UTC Date instants.
 */

const DHAKA_OFFSET_MS = 6 * 3_600_000;

/** Calendar day in Dhaka for a given instant, as "YYYY-MM-DD". */
export function dhakaDayString(date: Date): string {
  return new Date(date.getTime() + DHAKA_OFFSET_MS).toISOString().slice(0, 10);
}

/** The UTC instant at which the current Dhaka day started (00:00 Dhaka). */
export function dhakaDayStart(now: Date = new Date()): Date {
  const shifted = new Date(now.getTime() + DHAKA_OFFSET_MS);
  const dayStartShifted = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
  );
  return new Date(dayStartShifted - DHAKA_OFFSET_MS);
}

/** The UTC instant at which the previous Dhaka day started. */
export function dhakaYesterdayStart(now: Date = new Date()): Date {
  return new Date(dhakaDayStart(now).getTime() - 86_400_000);
}

/** Monday 00:00 Dhaka for the week containing `now`, returned as a UTC instant. */
export function dhakaWeekStart(now: Date = new Date()): Date {
  const start = dhakaDayStart(now);
  const shifted = new Date(start.getTime() + DHAKA_OFFSET_MS);
  const daysSinceMonday = (shifted.getUTCDay() + 6) % 7;
  return new Date(start.getTime() - daysSinceMonday * 86_400_000);
}
