// ─── Schedule Generator — Pure Occurrence Computation ─────────────────────────
// No DB imports — unit-testable without a live DB connection.
// The DB upsert layer is in schedule-generator.ts.

import { dhakaDayAndTimeToUtc } from './time';
import { SCHEDULE_GENERATOR_DAYS_AHEAD } from './constants';

export interface ScheduleRule {
  dayOfWeek: number;  // 0=Sun..6=Sat (Dhaka local)
  timeOfDay: string;  // 'HH:mm' Dhaka local
}

/**
 * Compute all UTC occurrence Dates for a weekly schedule rule between
 * `fromDate` and `fromDate + daysAhead` days.
 *
 * Pure function — no DB access, fully unit-testable.
 */
export function computeOccurrences(
  rule: ScheduleRule,
  fromDate: Date,
  daysAhead: number = SCHEDULE_GENERATOR_DAYS_AHEAD,
): Date[] {
  const results: Date[] = [];
  const toDate = new Date(fromDate.getTime() + daysAhead * 86400_000);

  // Start from the first occurrence at or after fromDate
  let candidate = dhakaDayAndTimeToUtc(rule.dayOfWeek, rule.timeOfDay, fromDate);

  while (candidate <= toDate) {
    results.push(new Date(candidate));
    // Advance by 7 days to get the next weekly occurrence
    candidate = new Date(candidate.getTime() + 7 * 86400_000);
  }

  return results;
}
