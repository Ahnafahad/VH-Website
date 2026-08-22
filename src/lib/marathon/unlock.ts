/**
 * Pure day-unlock logic for the Math Marathon module. No DB access here —
 * everything is unit-testable.
 *
 * Rule (confirmed with the user): Day N unlocks N-1 calendar days after the
 * assignment's startDate, the same moment for every student in the assigned
 * batch. Once unlocked, a day never re-locks — students who fall behind can
 * still finish Day 2 on Day 5 while Day 6 keeps unlocking on schedule.
 */

import type { DayState } from './types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** The instant Day `dayNumber` becomes available for an assignment starting at `startDate`. */
export function dayUnlockDate(startDate: Date, dayNumber: number): Date {
  return new Date(startDate.getTime() + (dayNumber - 1) * MS_PER_DAY);
}

export function isDayUnlocked(startDate: Date, dayNumber: number, now: Date = new Date()): boolean {
  return now.getTime() >= dayUnlockDate(startDate, dayNumber).getTime();
}

export function effectiveDayState(startDate: Date, dayNumber: number, now: Date = new Date()): DayState {
  return isDayUnlocked(startDate, dayNumber, now) ? 'unlocked' : 'locked';
}

/**
 * When a student has more than one matching assignment for the same chapter
 * (shouldn't normally happen, but batch reassignment could leave a stale row),
 * the earliest startDate wins — it can only make more days available, never fewer.
 */
export function earliestStartDate(startDates: Date[]): Date | null {
  if (startDates.length === 0) return null;
  return new Date(Math.min(...startDates.map(d => d.getTime())));
}
