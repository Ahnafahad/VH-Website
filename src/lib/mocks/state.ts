/**
 * Pure result-visibility rules for mock exams (no DB access — unit-testable).
 *
 *   locked      nothing to show yet
 *   provisional the student's own typed/online answers, scored — shown once every window has closed (a
 *               window staff closed early counts) AND it is 8pm Dhaka on the exam day, flagged as "not every copy has been checked yet"
 *   official    staff published the results (scanned OMR scores are in, essays marked)
 */

import type { Test, TestWindow, TestAttempt } from '@/lib/db/schema';
import { effectiveWindowState } from '@/lib/tests/windows';

export const RESULTS_HOUR_DHAKA = 20;   // sit-in mock results go up at 8pm Dhaka on the exam day (no window may run past it)
const DHAKA_MS = 6 * 3600_000;          // UTC+6, no DST

/** 8pm Dhaka on the Dhaka calendar day of `t`. */
export function resultsTimeFor(t: number): number {
  return Math.floor((t + DHAKA_MS) / 86_400_000) * 86_400_000 + RESULTS_HOUR_DHAKA * 3600_000 - DHAKA_MS;
}

export type MockPhase = 'locked' | 'provisional' | 'official';

export function mockPhase(
  // Elective mocks are sat and entered by the student alone, so they show the moment the window closes; the sit-in mocks wait for 8pm.
  test: Pick<Test, 'resultsPublishedAt'> & { electiveCount?: number | null },
  windows: Pick<TestWindow, 'status' | 'opensAt' | 'closesAt'>[],
  attempt: Pick<TestAttempt, 'status'> | null,
  now: Date = new Date(),
): MockPhase {
  if (test.resultsPublishedAt != null) return 'official';
  if (attempt?.status !== 'submitted' || windows.length === 0) return 'locked';
  const allClosed = windows.every(w => effectiveWindowState(w as TestWindow, now) === 'closed');
  if (!allClosed) return 'locked';
  if ((test.electiveCount ?? 0) > 0) return 'provisional';
  const examDay = Math.max(...windows.map(w => w.opensAt.getTime()));
  return now.getTime() >= resultsTimeFor(examDay) ? 'provisional' : 'locked';
}

/**
 * Solution sheet release: same clock as mockPhase but the viewer needs no attempt (an absent student with
 * access gets the solutions too). Staff bypass this at the call site.
 */
export function solutionsOpen(
  test: Pick<Test, 'resultsPublishedAt'> & { electiveCount?: number | null },
  windows: Pick<TestWindow, 'status' | 'opensAt' | 'closesAt'>[],
  now: Date = new Date(),
): boolean {
  if (test.resultsPublishedAt != null) return true;
  if (windows.length === 0 || !windows.every(w => effectiveWindowState(w as TestWindow, now) === 'closed')) return false;
  if ((test.electiveCount ?? 0) > 0) return true;
  return now.getTime() >= resultsTimeFor(Math.max(...windows.map(w => w.opensAt.getTime())));
}
