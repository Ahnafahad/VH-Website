/**
 * Pure result-visibility rules for mock exams (no DB access — unit-testable).
 *
 *   locked      nothing to show yet
 *   provisional the student's own typed/online answers, scored — shown the moment every window has
 *               closed (a window staff closed early counts), flagged as "not every copy has been checked yet"
 *   official    staff published the results (scanned OMR scores are in, essays marked)
 */

import type { Test, TestWindow, TestAttempt } from '@/lib/db/schema';
import { effectiveWindowState } from '@/lib/tests/windows';

export type MockPhase = 'locked' | 'provisional' | 'official';

export function mockPhase(
  // Elective mocks are sat and entered by the student alone; either way the result shows the moment every window has closed.
  test: Pick<Test, 'resultsPublishedAt'> & { electiveCount?: number | null },
  windows: Pick<TestWindow, 'status' | 'opensAt' | 'closesAt'>[],
  attempt: Pick<TestAttempt, 'status'> | null,
  now: Date = new Date(),
): MockPhase {
  if (test.resultsPublishedAt != null) return 'official';
  if (attempt?.status !== 'submitted' || windows.length === 0) return 'locked';
  const allClosed = windows.every(w => effectiveWindowState(w as TestWindow, now) === 'closed');
  return allClosed ? 'provisional' : 'locked';
}
