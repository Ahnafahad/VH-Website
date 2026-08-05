/**
 * Pure ranking/aggregation logic for the multi-board leaderboard. No DB access
 * here — everything is unit-testable. DB reads live in ./read.ts.
 *
 * Boards (spec: DECISIONS.md §13):
 *   - LexiCore    — vocab total points (one segment among several, no longer
 *                   "the whole" leaderboard).
 *   - Latest Test — the most recently-taken non-diagnostic test's cohort
 *                   ranking, reusing `rankCohort()` from lib/tests/scoring.ts
 *                   so ranks match what students see on their own results page.
 *   - All Tests   — cumulative average-percentage board across every
 *                   non-diagnostic submitted attempt. NOTE: this aggregation
 *                   (simple average of per-test percentage) is a PROPOSAL —
 *                   not a user-approved composite formula. See build report.
 */

import { rankCohort, type CohortRankEntry } from '@/lib/tests/scoring';

export interface RankedBoardEntry {
  rank: number;
  userId: number;
  displayName: string;
  value: number;
}

// ─── Test-board eligibility ───────────────────────────────────────────────────

/** A test qualifies for ANY test-based board only if published and not a
 * diagnostic (FBS diagnostics are explicitly excluded from every test board). */
export function isTestBoardEligible(test: { isDiagnostic: boolean; status: string }): boolean {
  return !test.isDiagnostic && test.status === 'published';
}

// ─── Latest Test ──────────────────────────────────────────────────────────────

/** Picks the "latest" test for the Latest-Test board: the one whose cohort has
 * the most recent submitted attempt. Returns null when no candidate exists. */
export function pickLatestTestId(
  candidates: { testId: number; lastSubmittedAt: number }[],
): number | null {
  if (candidates.length === 0) return null;
  return candidates.reduce((a, b) => (b.lastSubmittedAt > a.lastSubmittedAt ? b : a)).testId;
}

/** Ranks one test's cohort attempts with the same rankCohort() ordering the
 * student results page uses, then attaches display names. */
export function rankTestBoard(
  entries: CohortRankEntry[],
  nameById: Map<number, string>,
): RankedBoardEntry[] {
  return rankCohort(entries).map(e => ({
    rank: e.rank,
    userId: e.userId,
    displayName: nameById.get(e.userId) ?? 'Student',
    value: e.totalScore,
  }));
}

// ─── All Tests (cumulative) ───────────────────────────────────────────────────

export interface AllTestsAttempt {
  userId: number;
  percentage: number;
  submittedAt: number; // epoch ms
}

/** Cumulative board: average percentage across every non-diagnostic submitted
 * attempt the user has in the cohort. Standard competition ranking on the
 * average; ties broken by more tests attempted, then earlier average
 * submission time (does not change the shared rank number, matching the
 * rankCohort() tie-break convention). */
export function rankAllTestsBoard(
  attempts: AllTestsAttempt[],
  nameById: Map<number, string>,
): RankedBoardEntry[] {
  const byUser = new Map<number, { sum: number; count: number; submittedSum: number }>();
  for (const a of attempts) {
    const cur = byUser.get(a.userId) ?? { sum: 0, count: 0, submittedSum: 0 };
    cur.sum += a.percentage;
    cur.count += 1;
    cur.submittedSum += a.submittedAt;
    byUser.set(a.userId, cur);
  }

  const rows = Array.from(byUser.entries()).map(([userId, s]) => ({
    userId,
    avgPercentage: round2(s.sum / s.count),
    testCount: s.count,
    avgSubmittedAt: s.submittedSum / s.count,
  }));

  rows.sort((a, b) => {
    if (b.avgPercentage !== a.avgPercentage) return b.avgPercentage - a.avgPercentage;
    if (b.testCount !== a.testCount) return b.testCount - a.testCount;
    return a.avgSubmittedAt - b.avgSubmittedAt;
  });

  const out: RankedBoardEntry[] = [];
  let rank = 0, prev: number | null = null;
  rows.forEach((r, i) => {
    if (prev === null || r.avgPercentage < prev) { rank = i + 1; prev = r.avgPercentage; }
    out.push({
      rank,
      userId: r.userId,
      displayName: nameById.get(r.userId) ?? 'Student',
      value: r.avgPercentage,
    });
  });
  return out;
}

// ─── LexiCore ─────────────────────────────────────────────────────────────────

export interface LexiCoreRow {
  userId: number;
  displayName: string;
  totalPoints: number;
}

/** LexiCore board: total vocab points, standard competition ranking. */
export function rankLexiCoreBoard(rows: LexiCoreRow[]): RankedBoardEntry[] {
  const sorted = [...rows].sort((a, b) => b.totalPoints - a.totalPoints);
  const out: RankedBoardEntry[] = [];
  let rank = 0, prev: number | null = null;
  sorted.forEach((r, i) => {
    if (prev === null || r.totalPoints < prev) { rank = i + 1; prev = r.totalPoints; }
    out.push({ rank, userId: r.userId, displayName: r.displayName, value: r.totalPoints });
  });
  return out;
}

// ─── Top 20 + show all ────────────────────────────────────────────────────────

export interface BoardPage<T> {
  top: T[];
  rest: T[];
  total: number;
}

/** Splits a fully-ranked board into the default top-N view and the remainder
 * for a "show all" expansion. Never throws on an empty board. */
export function paginateBoard<T>(entries: T[], limit = 20): BoardPage<T> {
  return { top: entries.slice(0, limit), rest: entries.slice(limit), total: entries.length };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
