import { describe, it, expect } from 'vitest';
import { computeStudentMetrics, type MetricsAttempt, type StudentMetricsInput } from '../student-metrics-pure';
import { computeAtRiskFlag } from '../at-risk-pure';

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

describe('computeAtRiskFlag', () => {
  it('clearly at-risk: marks fall 2 tests in a row → flagged with a marks_decline reason', () => {
    const attempts: MetricsAttempt[] = [
      attempt({ attemptId: 1, testId: 1, submittedAt: '2026-07-01', percentage: 90, rank: 2, totalStudents: 40 }),
      attempt({ attemptId: 2, testId: 2, submittedAt: '2026-07-15', percentage: 70, rank: 5, totalStudents: 40 }),
      attempt({ attemptId: 3, testId: 3, submittedAt: '2026-08-01', percentage: 45, rank: 9, totalStudents: 40 }),
    ];
    const metrics = computeStudentMetrics(input({ attempts, availableTestsCount: 3 }));

    const result = computeAtRiskFlag(metrics);

    expect(result.atRisk).toBe(true);
    expect(result.reasons.map(r => r.code)).toContain('marks_decline');
    expect(result.reasons.find(r => r.code === 'marks_decline')?.message).toBe(
      'Marks fell for 2 tests in a row: 90.0% → 70.0% → 45.0%',
    );
  });

  it('clearly at-risk: rank worsens 2 tests in a row → flagged with a rank_decline reason', () => {
    const attempts: MetricsAttempt[] = [
      attempt({ attemptId: 1, testId: 1, submittedAt: '2026-07-01', percentage: 80, rank: 1, totalStudents: 30 }),
      attempt({ attemptId: 2, testId: 2, submittedAt: '2026-07-15', percentage: 78, rank: 8, totalStudents: 30 }),
      attempt({ attemptId: 3, testId: 3, submittedAt: '2026-08-01', percentage: 75, rank: 15, totalStudents: 30 }),
    ];
    const metrics = computeStudentMetrics(input({ attempts, availableTestsCount: 3 }));

    const result = computeAtRiskFlag(metrics);

    expect(result.atRisk).toBe(true);
    expect(result.reasons.map(r => r.code)).toContain('rank_decline');
    expect(result.reasons.find(r => r.code === 'rank_decline')?.message).toBe(
      'Rank dropped for 2 tests in a row: #1 → #8 → #15 of 30',
    );
  });

  it('healthy student: marks and rank improving → not flagged', () => {
    const attempts: MetricsAttempt[] = [
      attempt({ attemptId: 1, testId: 1, submittedAt: '2026-07-01', percentage: 50, rank: 20, totalStudents: 30 }),
      attempt({ attemptId: 2, testId: 2, submittedAt: '2026-07-15', percentage: 65, rank: 12, totalStudents: 30 }),
      attempt({ attemptId: 3, testId: 3, submittedAt: '2026-08-01', percentage: 80, rank: 3, totalStudents: 30 }),
    ];
    const metrics = computeStudentMetrics(input({ attempts, availableTestsCount: 3 }));

    const result = computeAtRiskFlag(metrics);

    expect(result.atRisk).toBe(false);
    expect(result.reasons).toEqual([]);
  });

  it('healthy student: one bad test sandwiched between two good ones → not flagged (not a 2-in-a-row decline)', () => {
    const attempts: MetricsAttempt[] = [
      attempt({ attemptId: 1, testId: 1, submittedAt: '2026-07-01', percentage: 80, rank: 3, totalStudents: 30 }),
      attempt({ attemptId: 2, testId: 2, submittedAt: '2026-07-15', percentage: 40, rank: 25, totalStudents: 30 }),
      attempt({ attemptId: 3, testId: 3, submittedAt: '2026-08-01', percentage: 85, rank: 2, totalStudents: 30 }),
    ];
    const metrics = computeStudentMetrics(input({ attempts, availableTestsCount: 3 }));

    const result = computeAtRiskFlag(metrics);

    expect(result.atRisk).toBe(false);
  });

  it('almost no data (1 attempt): never flagged, even though the single score is weak', () => {
    const attempts: MetricsAttempt[] = [
      attempt({ attemptId: 1, testId: 1, submittedAt: '2026-08-01', percentage: 20, rank: 29, totalStudents: 30 }),
    ];
    const metrics = computeStudentMetrics(input({ attempts, availableTestsCount: 3 }));

    const result = computeAtRiskFlag(metrics);

    expect(result.atRisk).toBe(false);
    expect(result.reasons).toEqual([]);
  });

  it('almost no data (2 attempts, both declining): still not flagged — needs a 3rd point to call it "2 in a row"', () => {
    const attempts: MetricsAttempt[] = [
      attempt({ attemptId: 1, testId: 1, submittedAt: '2026-07-01', percentage: 90, rank: 1, totalStudents: 30 }),
      attempt({ attemptId: 2, testId: 2, submittedAt: '2026-08-01', percentage: 40, rank: 25, totalStudents: 30 }),
    ];
    const metrics = computeStudentMetrics(input({ attempts, availableTestsCount: 3 }));

    const result = computeAtRiskFlag(metrics);

    expect(result.atRisk).toBe(false);
    expect(result.reasons).toEqual([]);
  });

  it('zero attempts: not flagged, no crash', () => {
    const metrics = computeStudentMetrics(input({ availableTestsCount: 5 }));
    const result = computeAtRiskFlag(metrics);
    expect(result.atRisk).toBe(false);
    expect(result.reasons).toEqual([]);
  });

  it('both signals can fire together', () => {
    const attempts: MetricsAttempt[] = [
      attempt({ attemptId: 1, testId: 1, submittedAt: '2026-07-01', percentage: 90, rank: 1, totalStudents: 30 }),
      attempt({ attemptId: 2, testId: 2, submittedAt: '2026-07-15', percentage: 70, rank: 10, totalStudents: 30 }),
      attempt({ attemptId: 3, testId: 3, submittedAt: '2026-08-01', percentage: 50, rank: 20, totalStudents: 30 }),
    ];
    const metrics = computeStudentMetrics(input({ attempts, availableTestsCount: 3 }));

    const result = computeAtRiskFlag(metrics);

    expect(result.atRisk).toBe(true);
    expect(result.reasons).toHaveLength(2);
  });
});
