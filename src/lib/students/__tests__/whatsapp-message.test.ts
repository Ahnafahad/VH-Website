import { describe, it, expect } from 'vitest';
import { computeStudentMetrics, type MetricsAttempt, type StudentMetricsInput } from '../student-metrics-pure';
import { computeAtRiskFlag } from '../at-risk-pure';
import { buildStatusMessage } from '../whatsapp-message';

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

describe('buildStatusMessage', () => {
  it('includes name, latest score, rank and test average', () => {
    const attempts: MetricsAttempt[] = [
      attempt({ attemptId: 1, testId: 1, submittedAt: '2026-07-01', percentage: 60, rank: 10, totalStudents: 30 }),
      attempt({ attemptId: 2, testId: 2, submittedAt: '2026-08-01', percentage: 80, rank: 3, totalStudents: 30 }),
    ];
    const metrics = computeStudentMetrics(input({ attempts, availableTestsCount: 2 }));
    const atRisk = computeAtRiskFlag(metrics);

    const message = buildStatusMessage({ studentName: 'Rahat Hasan', metrics, atRisk });

    expect(message).toContain('Rahat Hasan');
    expect(message).toContain('Latest test score: 80.0%');
    expect(message).toContain('Latest rank: #3 of 30');
    expect(message).toContain('Test average: 70.0% across 2 tests');
    expect(message).not.toContain('Flagged for attention');
  });

  it('appends at-risk reasons when flagged', () => {
    const attempts: MetricsAttempt[] = [
      attempt({ attemptId: 1, testId: 1, submittedAt: '2026-07-01', percentage: 90, rank: 1, totalStudents: 30 }),
      attempt({ attemptId: 2, testId: 2, submittedAt: '2026-07-15', percentage: 70, rank: 8, totalStudents: 30 }),
      attempt({ attemptId: 3, testId: 3, submittedAt: '2026-08-01', percentage: 45, rank: 15, totalStudents: 30 }),
    ];
    const metrics = computeStudentMetrics(input({ attempts, availableTestsCount: 3 }));
    const atRisk = computeAtRiskFlag(metrics);

    const message = buildStatusMessage({ studentName: 'Shuborno Huq', metrics, atRisk });

    expect(message).toContain('Flagged for attention:');
    expect(message).toContain('Marks fell for 2 tests in a row');
  });

  it('handles a student with no attempts without crashing', () => {
    const metrics = computeStudentMetrics(input({ availableTestsCount: 5 }));
    const atRisk = computeAtRiskFlag(metrics);
    const message = buildStatusMessage({ studentName: 'New Student', metrics, atRisk });
    expect(message).toContain('New Student');
  });
});
