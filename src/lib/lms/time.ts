// ─── Dhaka Time Helpers ───────────────────────────────────────────────────────
// Dhaka is UTC+6 with no DST. All display/input in Dhaka; storage is UTC epoch.

import { DHAKA_OFFSET_HOURS } from './constants';

const DHAKA_TZ = 'Asia/Dhaka';
const DHAKA_OFFSET_MS = DHAKA_OFFSET_HOURS * 60 * 60 * 1000;

/**
 * Format a Date in Dhaka time using Intl.DateTimeFormat.
 *
 * @param date - The UTC Date to format.
 * @param pattern - Intl.DateTimeFormatOptions shorthand keys or a full options
 *   object. For convenience, pass a string preset:
 *   'date'     → { dateStyle: 'medium' }
 *   'time'     → { timeStyle: 'short' }
 *   'datetime' → { dateStyle: 'medium', timeStyle: 'short' }
 *   Or pass an Intl.DateTimeFormatOptions object directly.
 */
export function formatDhaka(
  date: Date,
  pattern: 'date' | 'time' | 'datetime' | Intl.DateTimeFormatOptions = 'datetime',
): string {
  let options: Intl.DateTimeFormatOptions;
  if (pattern === 'date') {
    options = { dateStyle: 'medium', timeZone: DHAKA_TZ };
  } else if (pattern === 'time') {
    options = { timeStyle: 'short', timeZone: DHAKA_TZ };
  } else if (pattern === 'datetime') {
    options = { dateStyle: 'medium', timeStyle: 'short', timeZone: DHAKA_TZ };
  } else {
    options = { ...pattern, timeZone: DHAKA_TZ };
  }
  return new Intl.DateTimeFormat('en-BD', options).format(date);
}

/**
 * Convert a Dhaka-local (dayOfWeek, HH:mm) pair to a UTC Date.
 *
 * The returned date is the first occurrence of that weekday+time AT OR AFTER
 * `referenceDate`, in Dhaka local time.
 *
 * @param dayOfWeek - 0 = Sunday … 6 = Saturday (Dhaka local).
 * @param timeOfDay - 'HH:mm' in Dhaka local time.
 * @param referenceDate - Base UTC Date for the search (defaults to now).
 */
export function dhakaDayAndTimeToUtc(
  dayOfWeek: number,
  timeOfDay: string,
  referenceDate: Date,
): Date {
  // Parse HH:mm
  const [hh, mm] = timeOfDay.split(':').map(Number);

  // Convert referenceDate to Dhaka epoch by adding offset
  const refDhakaMs = referenceDate.getTime() + DHAKA_OFFSET_MS;
  const refDhakaDate = new Date(refDhakaMs);

  // Build a candidate Dhaka date at the requested day/time in the same week
  // Start from midnight of the Dhaka day of referenceDate
  const refDhakaDow = refDhakaDate.getUTCDay();          // 0=Sun..6=Sat in Dhaka
  const refDhakaMidnightMs =
    refDhakaMs -
    (refDhakaDate.getUTCHours() * 3600 +
      refDhakaDate.getUTCMinutes() * 60 +
      refDhakaDate.getUTCSeconds()) *
      1000 -
    refDhakaDate.getUTCMilliseconds();

  // Days until the target dayOfWeek
  const daysAhead = (dayOfWeek - refDhakaDow + 7) % 7;

  // Build candidate Dhaka epoch (ms) for that day at the given time
  const candidateDhakaMs =
    refDhakaMidnightMs + daysAhead * 86400_000 + (hh * 3600 + mm * 60) * 1000;

  // If the candidate is in the past relative to referenceDate, advance by 7 days
  const candidateUtcMs = candidateDhakaMs - DHAKA_OFFSET_MS;
  if (candidateUtcMs < referenceDate.getTime()) {
    return new Date(candidateUtcMs + 7 * 86400_000);
  }

  return new Date(candidateUtcMs);
}
