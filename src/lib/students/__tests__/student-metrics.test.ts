import { describe, it, expect } from 'vitest';
import {
  computeStudentMetrics,
  type MetricsAttempt,
  type StudentMetricsInput,
} from '../student-metrics-pure';

function attempt(
  over: Partial<Omit<MetricsAttempt, 'attemptId' | 'submittedAt'>> & { attemptId: number; submittedAt: string },
): MetricsAttempt {
  return {
    testId: 1,
    isDiagnostic: false,
    percentage: 70,
    rank: 1,
    totalStudents: 10,
    percentile: 90,
    totalUnattempted: 0,
    totalQuestions: 20,
    sections: [],
    ...over,
    attemptId: over.attemptId,
    submittedAt: new Date(over.submittedAt),
  };
}

function input(over: Partial<StudentMetricsInput>): StudentMetricsInput {
  return {
    attempts: [],
    batchSectionTotals: [],
    availableTestsCount: 0,
    violationCount: 0,
    ...over,
  };
}

describe('computeStudentMetrics', () => {
  it('zero attempts: every derived metric is null/empty, nothing crashes or NaNs', () => {
    const result = computeStudentMetrics(input({ availableTestsCount: 17 }));

    expect(result.testsAttempted).toBe(0);
    expect(result.testAveragePercent).toBeNull();
    expect(result.latestRank).toBeNull();
    expect(result.latestPercentile).toBeNull();
    expect(result.latestTotalStudents).toBeNull();
    expect(result.rankTrend).toEqual([]);
    expect(result.marksTrend).toEqual([]);
    expect(result.sectionAccuracy).toEqual([]);
    expect(result.strongestSection).toBeNull();
    expect(result.weakestSection).toBeNull();
    expect(result.participationRate).toBe(0); // 0 attempted / 17 available
    expect(result.skippedRate).toBeNull();
    expect(result.improvementDelta).toBeNull();
    expect(result.consistency).toBeNull();
    expect(result.violationCount).toBe(0);
  });

  it('zero attempts and zero available tests: participation rate is null, not a divide-by-zero', () => {
    const result = computeStudentMetrics(input({ availableTestsCount: 0 }));
    expect(result.participationRate).toBeNull();
    expect(Number.isNaN(result.participationRate)).toBe(false);
  });

  it('exactly one attempt: trend has one point, improvementDelta and consistency are null (not NaN, not divide-by-zero)', () => {
    const a = attempt({ attemptId: 1, submittedAt: '2026-07-01', percentage: 64, rank: 3, totalStudents: 12, percentile: 75 });
    const result = computeStudentMetrics(input({
      attempts: [a],
      availableTestsCount: 5,
    }));

    expect(result.testsAttempted).toBe(1);
    expect(result.testAveragePercent).toBe(64);
    expect(result.latestRank).toBe(3);
    expect(result.latestPercentile).toBe(75);
    expect(result.latestTotalStudents).toBe(12);
    expect(result.rankTrend).toHaveLength(1);
    expect(result.marksTrend).toHaveLength(1);
    expect(result.improvementDelta).toBeNull();
    expect(result.consistency).toBeNull();
    expect(Number.isNaN(result.improvementDelta as number)).toBe(false);
    expect(result.participationRate).toBe(20); // 1/5 * 100
  });

  it('several attempts: trends, variance and improvement delta are computed correctly, chronological', () => {
    const attempts: MetricsAttempt[] = [
      attempt({ attemptId: 1, testId: 1, submittedAt: '2026-07-01', percentage: 50, rank: 5, percentile: 60,
        totalUnattempted: 2, totalQuestions: 20,
        sections: [{ title: 'Math', correct: 10, wrong: 5, unattempted: 2, totalQuestions: 17 }] }),
      attempt({ attemptId: 2, testId: 2, submittedAt: '2026-06-01', percentage: 40, rank: 8, percentile: 40,
        totalUnattempted: 4, totalQuestions: 20,
        sections: [{ title: 'Math', correct: 6, wrong: 6, unattempted: 4, totalQuestions: 16 }] }),
      attempt({ attemptId: 3, testId: 3, submittedAt: '2026-08-01', percentage: 70, rank: 2, percentile: 90,
        totalUnattempted: 1, totalQuestions: 20,
        sections: [{ title: 'Math', correct: 14, wrong: 4, unattempted: 1, totalQuestions: 19 }] }),
    ];
    const result = computeStudentMetrics(input({
      attempts,
      batchSectionTotals: [{ title: 'Math', correct: 100, wrong: 100 }], // batch avg 50%
      availableTestsCount: 3,
    }));

    expect(result.testsAttempted).toBe(3);
    expect(result.testAveragePercent).toBeCloseTo((50 + 40 + 70) / 3, 2);

    // Chronological order: Jun (attempt 2) -> Jul (attempt 1) -> Aug (attempt 3)
    expect(result.marksTrend.map(p => p.attemptId)).toEqual([2, 1, 3]);
    expect(result.rankTrend.map(p => p.rank)).toEqual([8, 5, 2]);

    // Latest by date = attempt 3 (Aug)
    expect(result.latestRank).toBe(2);
    expect(result.latestPercentile).toBe(90);

    // improvement = last(70) - first(40) chronologically
    expect(result.improvementDelta).toBe(30);

    // consistency = population variance of [40, 50, 70] (any order, mean = 160/3)
    const mean = (40 + 50 + 70) / 3;
    const expectedVariance = ((40 - mean) ** 2 + (50 - mean) ** 2 + (70 - mean) ** 2) / 3;
    expect(result.consistency).toBeCloseTo(expectedVariance, 1);

    // section accuracy: correct sum 30, wrong sum 15 -> 66.67%; batch 100/200 = 50% -> delta +16.67
    expect(result.sectionAccuracy).toHaveLength(1);
    expect(result.sectionAccuracy[0].title).toBe('Math');
    expect(result.sectionAccuracy[0].accuracyPercent).toBeCloseTo(66.67, 1);
    expect(result.sectionAccuracy[0].batchAvgAccuracyPercent).toBe(50);
    expect(result.sectionAccuracy[0].deltaVsBatch).toBeCloseTo(16.67, 1);
    expect(result.strongestSection).toBe('Math');
    expect(result.weakestSection).toBe('Math');

    // skipped rate: unattempted sum 7 / totalQuestions sum 60 = 11.67%
    expect(result.skippedRate).toBeCloseTo((7 / 60) * 100, 1);

    expect(result.participationRate).toBe(100); // 3 distinct tests / 3 available
  });

  it('diagnostic attempts are excluded from every average, trend and section metric', () => {
    const real = attempt({ attemptId: 1, testId: 1, submittedAt: '2026-07-01', percentage: 60, rank: 1, percentile: 90,
      sections: [{ title: 'Math', correct: 8, wrong: 2, unattempted: 0, totalQuestions: 10 }] });
    const diagnostic = attempt({
      attemptId: 2, testId: 99, isDiagnostic: true, submittedAt: '2026-07-15', percentage: 10, rank: 1, percentile: 10,
      totalUnattempted: 50, totalQuestions: 50,
      sections: [{ title: 'Should Not Count', correct: 1, wrong: 49, unattempted: 0, totalQuestions: 50 }],
    });

    const result = computeStudentMetrics(input({
      attempts: [real, diagnostic],
      availableTestsCount: 1,
    }));

    // Only the non-diagnostic attempt counts.
    expect(result.testsAttempted).toBe(1);
    expect(result.testAveragePercent).toBe(60);
    expect(result.marksTrend).toHaveLength(1);
    expect(result.rankTrend).toHaveLength(1);
    expect(result.sectionAccuracy.map(s => s.title)).toEqual(['Math']);
    expect(result.skippedRate).toBe(0); // only the real attempt's 0/10 counted
    expect(result.violationCount).toBe(0);
  });

  it('violation count passes through untouched', () => {
    const result = computeStudentMetrics(input({ violationCount: 4 }));
    expect(result.violationCount).toBe(4);
  });

  it('section with zero answers on either side does not divide by zero', () => {
    const a = attempt({
      attemptId: 1, submittedAt: '2026-07-01',
      sections: [{ title: 'Untouched', correct: 0, wrong: 0, unattempted: 10, totalQuestions: 10 }],
    });
    const result = computeStudentMetrics(input({ attempts: [a] }));
    // A section with zero correct+wrong is filtered out entirely (nothing to grade).
    expect(result.sectionAccuracy).toEqual([]);
  });
});
