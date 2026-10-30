/**
 * Pure result-visibility rules for mock exams (no DB access — unit-testable).
 *
 *   locked      nothing to show yet
 *   provisional the student's own typed/online answers, scored — shown PROVISIONAL_DELAY_MS after
 *               the last window closes, flagged as "not every copy has been checked yet"
 *   official    staff published the results (scanned OMR scores are in, essays marked)
 */

import type { Test, TestWindow, TestAttempt } from '@/lib/db/schema';

export const PROVISIONAL_DELAY_MS = 10 * 60_000;

export type MockPhase = 'locked' | 'provisional' | 'official';

export function mockPhase(
  test: Pick<Test, 'resultsPublishedAt'>,
  windows: Pick<TestWindow, 'closesAt'>[],
  attempt: Pick<TestAttempt, 'status'> | null,
  now: Date = new Date(),
): MockPhase {
  if (test.resultsPublishedAt != null) return 'official';
  if (attempt?.status !== 'submitted' || windows.length === 0) return 'locked';
  const lastClose = Math.max(...windows.map(w => w.closesAt.getTime()));
  return now.getTime() >= lastClose + PROVISIONAL_DELAY_MS ? 'provisional' : 'locked';
}
