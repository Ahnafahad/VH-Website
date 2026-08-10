import { describe, it, expect } from 'vitest';
import { rankCohort, shouldRankByCohort, type CohortRankEntry } from '../scoring';

function entry(overrides: Partial<CohortRankEntry> & { attemptId: number }): CohortRankEntry {
  return {
    userId: overrides.attemptId,
    totalScore: 0,
    submittedAt: 0,
    correct: 0,
    wrong: 0,
    ...overrides,
  };
}

describe('rankCohort', () => {
  it('orders a clean set (no ties) by score descending with sequential ranks', () => {
    const entries = [
      entry({ attemptId: 1, totalScore: 70, submittedAt: 100 }),
      entry({ attemptId: 2, totalScore: 90, submittedAt: 100 }),
      entry({ attemptId: 3, totalScore: 80, submittedAt: 100 }),
    ];
    const out = rankCohort(entries);
    expect(out.map(r => r.attemptId)).toEqual([2, 3, 1]);
    expect(out.map(r => r.rank)).toEqual([1, 2, 3]);
  });

  it('breaks a tie by earlier submission time (rank number still shared)', () => {
    const entries = [
      entry({ attemptId: 1, totalScore: 80, submittedAt: 200 }), // later
      entry({ attemptId: 2, totalScore: 80, submittedAt: 100 }), // earlier — wins tie
    ];
    const out = rankCohort(entries);
    expect(out.map(r => r.attemptId)).toEqual([2, 1]); // earlier submission listed first
    expect(out.map(r => r.rank)).toEqual([1, 1]); // same score → same competition rank
  });

  it('breaks a tie by accuracy when submission times are equal', () => {
    const entries = [
      entry({ attemptId: 1, totalScore: 80, submittedAt: 100, correct: 8, wrong: 4 }), // 66.7% accuracy
      entry({ attemptId: 2, totalScore: 80, submittedAt: 100, correct: 8, wrong: 0 }), // 100% accuracy — wins tie
    ];
    const out = rankCohort(entries);
    expect(out.map(r => r.attemptId)).toEqual([2, 1]); // higher accuracy listed first
    expect(out.map(r => r.rank)).toEqual([1, 1]);
  });

  it('cuts a definite top 5 out of a 3-way tie straddling 5th place, deterministically', () => {
    const entries = [
      entry({ attemptId: 1, totalScore: 100, submittedAt: 100 }), // rank 1
      entry({ attemptId: 2, totalScore: 95, submittedAt: 100 }),  // rank 2
      entry({ attemptId: 3, totalScore: 90, submittedAt: 100 }),  // rank 3
      entry({ attemptId: 4, totalScore: 85, submittedAt: 100 }),  // rank 4
      // 3-way tie at what would be rank 5 — only 2 of these 3 can fit in a top 5
      entry({ attemptId: 5, totalScore: 80, submittedAt: 300, correct: 5, wrong: 0 }),
      entry({ attemptId: 6, totalScore: 80, submittedAt: 100, correct: 5, wrong: 0 }), // earliest — makes the cut
      entry({ attemptId: 7, totalScore: 80, submittedAt: 200, correct: 5, wrong: 0 }),
    ];
    const topFive = rankCohort(entries).slice(0, 5);
    expect(topFive).toHaveLength(5);
    expect(topFive.map(r => r.attemptId)).toEqual([1, 2, 3, 4, 6]);
    // Excluded ties (5, 7) do not silently expand the cut to 6 or 7.
    expect(topFive.some(r => r.attemptId === 5)).toBe(false);
    expect(topFive.some(r => r.attemptId === 7)).toBe(false);
  });
});

describe('shouldRankByCohort', () => {
  it('is false for FBS diagnostics regardless of submission count', () => {
    expect(shouldRankByCohort({ isDiagnostic: true }, 0)).toBe(false);
    expect(shouldRankByCohort({ isDiagnostic: true }, 40)).toBe(false);
  });

  it('is false for a non-diagnostic test with no submissions (nothing to scope)', () => {
    expect(shouldRankByCohort({ isDiagnostic: false }, 0)).toBe(false);
  });

  it('is true for a non-diagnostic test with submissions', () => {
    expect(shouldRankByCohort({ isDiagnostic: false }, 1)).toBe(true);
  });
});
