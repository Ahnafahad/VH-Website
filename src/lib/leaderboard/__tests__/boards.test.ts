import { describe, it, expect } from 'vitest';
import {
  isTestBoardEligible,
  pickLatestTestId,
  rankTestBoard,
  rankAllTestsBoard,
  rankLexiCoreBoard,
  paginateBoard,
  type AllTestsAttempt,
  type LexiCoreRow,
} from '../boards';
import type { CohortRankEntry } from '@/lib/tests/scoring';

// ─── isTestBoardEligible ──────────────────────────────────────────────────────

describe('isTestBoardEligible', () => {
  it('excludes FBS diagnostics even when published', () => {
    expect(isTestBoardEligible({ isDiagnostic: true, status: 'published' })).toBe(false);
  });

  it('excludes drafts and archived tests', () => {
    expect(isTestBoardEligible({ isDiagnostic: false, status: 'draft' })).toBe(false);
    expect(isTestBoardEligible({ isDiagnostic: false, status: 'archived' })).toBe(false);
  });

  it('includes a published non-diagnostic test', () => {
    expect(isTestBoardEligible({ isDiagnostic: false, status: 'published' })).toBe(true);
  });
});

// ─── pickLatestTestId ─────────────────────────────────────────────────────────

describe('pickLatestTestId', () => {
  it('returns null for an empty candidate list (no crash)', () => {
    expect(pickLatestTestId([])).toBeNull();
  });

  it('picks the test with the most recent submission', () => {
    const id = pickLatestTestId([
      { testId: 1, lastSubmittedAt: 100 },
      { testId: 2, lastSubmittedAt: 300 },
      { testId: 3, lastSubmittedAt: 200 },
    ]);
    expect(id).toBe(2);
  });
});

// ─── rankTestBoard (Latest Test) ──────────────────────────────────────────────

function cohortEntry(overrides: Partial<CohortRankEntry> & { attemptId: number; userId: number }): CohortRankEntry {
  return { totalScore: 0, submittedAt: 0, correct: 0, wrong: 0, ...overrides };
}

describe('rankTestBoard', () => {
  it('returns an empty board for zero entries without crashing', () => {
    expect(rankTestBoard([], new Map())).toEqual([]);
  });

  it('ranks by score desc and attaches display names', () => {
    const names = new Map([[1, 'Alice'], [2, 'Bob']]);
    const out = rankTestBoard([
      cohortEntry({ attemptId: 1, userId: 1, totalScore: 70 }),
      cohortEntry({ attemptId: 2, userId: 2, totalScore: 90 }),
    ], names);
    expect(out.map(e => e.displayName)).toEqual(['Bob', 'Alice']);
    expect(out.map(e => e.rank)).toEqual([1, 2]);
  });

  it('falls back to "Student" when a name is missing from the map', () => {
    const out = rankTestBoard([cohortEntry({ attemptId: 1, userId: 99, totalScore: 50 })], new Map());
    expect(out[0].displayName).toBe('Student');
  });
});

// ─── rankAllTestsBoard ────────────────────────────────────────────────────────

describe('rankAllTestsBoard', () => {
  it('returns an empty board for zero attempts without crashing', () => {
    expect(rankAllTestsBoard([], new Map())).toEqual([]);
  });

  it('averages percentage per user across multiple tests and ranks desc', () => {
    const names = new Map([[1, 'Alice'], [2, 'Bob']]);
    const attempts: AllTestsAttempt[] = [
      { userId: 1, percentage: 80, submittedAt: 100 },
      { userId: 1, percentage: 90, submittedAt: 200 }, // Alice avg 85
      { userId: 2, percentage: 95, submittedAt: 150 }, // Bob avg 95
    ];
    const out = rankAllTestsBoard(attempts, names);
    expect(out.map(e => e.displayName)).toEqual(['Bob', 'Alice']);
    expect(out.find(e => e.displayName === 'Alice')!.value).toBe(85);
  });

  it('breaks a tied average by more tests attempted, then earlier avg submission', () => {
    const names = new Map([[1, 'OneTest'], [2, 'TwoTests']]);
    const attempts: AllTestsAttempt[] = [
      { userId: 1, percentage: 80, submittedAt: 100 }, // avg 80, 1 test
      { userId: 2, percentage: 80, submittedAt: 100 },
      { userId: 2, percentage: 80, submittedAt: 100 }, // avg 80, 2 tests — wins tie-break
    ];
    const out = rankAllTestsBoard(attempts, names);
    expect(out.map(e => e.displayName)).toEqual(['TwoTests', 'OneTest']);
    // Tied average → same competition rank, ordering only decided by tie-break
    expect(out.map(e => e.rank)).toEqual([1, 1]);
  });
});

// ─── rankLexiCoreBoard ────────────────────────────────────────────────────────

describe('rankLexiCoreBoard', () => {
  it('returns an empty board for zero rows without crashing', () => {
    expect(rankLexiCoreBoard([])).toEqual([]);
  });

  it('ranks by total points desc with standard competition ties', () => {
    const rows: LexiCoreRow[] = [
      { userId: 1, displayName: 'Alice', totalPoints: 500 },
      { userId: 2, displayName: 'Bob', totalPoints: 800 },
      { userId: 3, displayName: 'Cara', totalPoints: 800 },
    ];
    const out = rankLexiCoreBoard(rows);
    expect(out.map(e => e.displayName)).toEqual(['Bob', 'Cara', 'Alice']);
    expect(out.map(e => e.rank)).toEqual([1, 1, 3]); // 1224 ranking
  });
});

// ─── paginateBoard (Top 20 + show all) ────────────────────────────────────────

describe('paginateBoard', () => {
  it('handles an empty board without crashing', () => {
    const page = paginateBoard([]);
    expect(page).toEqual({ top: [], rest: [], total: 0 });
  });

  it('puts everything in "top" when there are fewer than 20 entries', () => {
    const entries = Array.from({ length: 12 }, (_, i) => i);
    const page = paginateBoard(entries);
    expect(page.top).toHaveLength(12);
    expect(page.rest).toHaveLength(0);
    expect(page.total).toBe(12);
  });

  it('cuts at 20 and "show all" (rest) returns exactly the remainder', () => {
    const entries = Array.from({ length: 37 }, (_, i) => i); // 0..36
    const page = paginateBoard(entries);
    expect(page.top).toHaveLength(20);
    expect(page.top).toEqual(entries.slice(0, 20));
    expect(page.rest).toHaveLength(17);
    expect(page.rest).toEqual(entries.slice(20));
    expect(page.total).toBe(37);
    // top + rest reconstitutes the full board
    expect([...page.top, ...page.rest]).toEqual(entries);
  });
});
