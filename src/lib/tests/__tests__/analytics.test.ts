import { describe, expect, it } from 'vitest';
import {
  average,
  median,
  stdDev,
  computeTestAnalytics,
  computeViolationStats,
  type AnalyticsInput,
  type RawAttempt,
} from '../analytics';

function attempt(overrides: Partial<RawAttempt> & { attemptId: number; userId: number }): RawAttempt {
  return {
    userName: `User ${overrides.userId}`,
    userEmail: `user${overrides.userId}@example.com`,
    status: 'submitted',
    totalScore: 0,
    submittedAt: 60_000,
    sectionScores: null,
    ...overrides,
  };
}

describe('basic stats helpers', () => {
  it('average/median/stdDev over a known set', () => {
    const nums = [2, 4, 4, 4, 5, 5, 7, 9];
    expect(average(nums)).toBe(5);
    expect(median(nums)).toBe(4.5);
    expect(stdDev(nums)).toBe(2);
  });

  it('average/median/stdDev return 0 for an empty array (no NaN)', () => {
    expect(average([])).toBe(0);
    expect(median([])).toBe(0);
    expect(stdDev([])).toBe(0);
  });

  it('median handles odd-length arrays', () => {
    expect(median([10, 1, 5])).toBe(5);
  });
});

describe('computeTestAnalytics — empty-attempts case', () => {
  const input: AnalyticsInput = {
    eligibleCount: 20,
    testTotalMarks: 100,
    attempts: [],
    sections: [{ sectionId: 1, title: 'Mathematics', order: 1 }],
    questions: [
      { questionId: 1, sectionId: 1, number: 1, correctKey: 'A' },
      { questionId: 2, sectionId: 1, number: 2, correctKey: 'B' },
    ],
    answers: [],
  };

  it('does not divide by zero or crash when nobody has attempted', () => {
    const result = computeTestAnalytics(input);
    expect(result.participation).toEqual({ eligible: 20, attempted: 0, attemptedPercent: 0 });
    expect(result.completion).toEqual({ attempted: 0, submitted: 0, completionPercent: 0 });
    expect(result.averageScore).toBe(0);
    expect(result.medianScore).toBe(0);
    expect(result.stdDevScore).toBe(0);
    expect(result.highestScore).toBe(0);
    expect(result.lowestScore).toBe(0);
    expect(result.top5).toEqual([]);
    expect(result.bottomPerformers).toEqual([]);
    expect(result.mostWrong).toEqual([]);
    expect(result.mostSkipped).toEqual([]);
    // Every distribution bucket present, all zero — not undefined.
    expect(result.scoreDistribution.every(b => b.count === 0)).toBe(true);
    expect(result.scoreDistribution).toHaveLength(5);
  });

  it('question stats are all-zero, not NaN, when no one answered', () => {
    const result = computeTestAnalytics(input);
    expect(result.questions).toEqual([
      { questionId: 1, number: 1, sectionId: 1, correctCount: 0, wrongCount: 0, skippedCount: 0, accuracy: null },
      { questionId: 2, number: 2, sectionId: 1, correctCount: 0, wrongCount: 0, skippedCount: 0, accuracy: null },
    ]);
  });

  it('section stats have zero averages and null accuracy, not a crash', () => {
    const result = computeTestAnalytics(input);
    expect(result.sections).toEqual([
      { sectionId: 1, title: 'Mathematics', averageScore: 0, maxScore: 0, averagePercentage: 0, accuracy: null },
    ]);
  });
});

describe('computeTestAnalytics — per-question accuracy with real answers', () => {
  const input: AnalyticsInput = {
    eligibleCount: 4,
    testTotalMarks: 10,
    attempts: [
      attempt({ attemptId: 1, userId: 1, totalScore: 8 }),
      attempt({ attemptId: 2, userId: 2, totalScore: 6 }),
      attempt({ attemptId: 3, userId: 3, totalScore: 4 }),
      // a 4th student started but never submitted — counts toward participation,
      // not completion, and contributes no answers.
      attempt({ attemptId: 4, userId: 4, status: 'in_progress', totalScore: null, submittedAt: null }),
    ],
    sections: [{ sectionId: 1, title: 'Vocabulary', order: 1 }],
    questions: [
      { questionId: 10, sectionId: 1, number: 1, correctKey: 'A' },
      { questionId: 11, sectionId: 1, number: 2, correctKey: 'B' },
    ],
    answers: [
      // Q10: 2 correct, 1 wrong, 0 skipped (of 3 submitted attempts)
      { attemptId: 1, questionId: 10, selectedKey: 'A' },
      { attemptId: 2, questionId: 10, selectedKey: 'A' },
      { attemptId: 3, questionId: 10, selectedKey: 'C' },
      // Q11: 1 correct, 0 wrong, 2 skipped (attempt 2 cleared its answer -> null)
      { attemptId: 1, questionId: 11, selectedKey: 'B' },
      { attemptId: 2, questionId: 11, selectedKey: null },
    ],
  };

  it('computes correct/wrong/skipped and accuracy per question', () => {
    const result = computeTestAnalytics(input);
    const q10 = result.questions.find(q => q.questionId === 10)!;
    const q11 = result.questions.find(q => q.questionId === 11)!;

    expect(q10).toEqual({
      questionId: 10, number: 1, sectionId: 1,
      correctCount: 2, wrongCount: 1, skippedCount: 0, accuracy: round2((2 / 3) * 100),
    });
    expect(q11).toEqual({
      questionId: 11, number: 2, sectionId: 1,
      correctCount: 1, wrongCount: 0, skippedCount: 2, accuracy: 100,
    });
  });

  it('participation counts the in-progress attempt, completion does not', () => {
    const result = computeTestAnalytics(input);
    expect(result.participation).toEqual({ eligible: 4, attempted: 4, attemptedPercent: 100 });
    expect(result.completion).toEqual({ attempted: 4, submitted: 3, completionPercent: 75 });
  });

  it('averages only submitted scores', () => {
    const result = computeTestAnalytics(input);
    expect(result.averageScore).toBe(6); // (8+6+4)/3
    expect(result.medianScore).toBe(6);
    expect(result.highestScore).toBe(8);
    expect(result.lowestScore).toBe(4);
  });

  it('ranks top/bottom performers by score, excluding the unsubmitted attempt', () => {
    const result = computeTestAnalytics(input);
    expect(result.top5.map(r => r.userId)).toEqual([1, 2, 3]);
    expect(result.bottomPerformers.map(r => r.userId)).toEqual([3, 2, 1]);
  });

  it('most-wrong and most-skipped surface the right questions', () => {
    const result = computeTestAnalytics(input);
    expect(result.mostWrong[0].questionId).toBe(10);
    expect(result.mostSkipped[0].questionId).toBe(11);
  });
});

describe('computeViolationStats', () => {
  it('tallies violations by action', () => {
    const stats = computeViolationStats([
      { action: 'warning' }, { action: 'warning' }, { action: 'reset' }, { action: 'ban' },
    ]);
    expect(stats).toEqual({ totalCount: 4, byAction: { warning: 2, reset: 1, ban: 1 } });
  });

  it('returns zero for no violations, not a crash', () => {
    expect(computeViolationStats([])).toEqual({ totalCount: 0, byAction: {} });
  });
});

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
