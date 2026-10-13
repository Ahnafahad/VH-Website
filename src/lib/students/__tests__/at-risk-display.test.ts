import { describe, it, expect } from 'vitest';
import { computeStudentMetrics, type MetricsAttempt } from '../student-metrics-pure';
import { computeAtRiskFlag, atRiskTrend, shortReason, sparkSeries } from '../at-risk-pure';
import { buildCheckInMessage } from '../whatsapp-message';

function attempt(id: number, date: string, percentage: number, rank: number): MetricsAttempt {
  return {
    attemptId: id, testId: id, isDiagnostic: false, submittedAt: new Date(date), percentage, rank,
    totalStudents: 40, percentile: 50, totalUnattempted: 0, totalQuestions: 20, sections: [],
  };
}

describe('at-risk display helpers', () => {
  const metrics = computeStudentMetrics({
    attempts: [
      attempt(1, '2026-07-01', 90.04, 2),
      attempt(2, '2026-07-15', 70, 5),
      attempt(3, '2026-08-01', 45, 9),
      attempt(4, '2026-08-10', 40, 12),
    ],
    batchSectionTotals: [],
    availableTestsCount: 0,
    violationCount: 0,
  });

  it('keeps the rule unchanged: still flagged on the same data', () => {
    expect(computeAtRiskFlag(metrics).atRisk).toBe(true);
  });

  it('atRiskTrend returns the last three scores and ranks, oldest first', () => {
    expect(atRiskTrend(metrics)).toEqual({ scores: [70, 45, 40], ranks: [5, 9, 12] });
  });

  it('shortReason writes one line per reason code and ignores unknown codes', () => {
    expect(shortReason([{ code: 'marks_decline' }])).toBe('Marks fell on the last two tests');
    expect(shortReason([{ code: 'marks_decline' }, { code: 'rank_decline' }]))
      .toBe('Marks fell on the last two tests · Rank fell two tests in a row');
    expect(shortReason([{ code: 'other' }])).toBe('');
  });

  it('sparkSeries draws scores for marks decline and inverted ranks for rank-only decline', () => {
    const trend = { scores: [70, 45, 40], ranks: [5, 9, 12] };
    expect(sparkSeries(trend, [{ code: 'marks_decline' }])).toEqual({ kind: 'marks', values: [70, 45, 40] });
    expect(sparkSeries(trend, [{ code: 'rank_decline' }])).toEqual({ kind: 'rank', values: [-5, -9, -12] });
  });
});

describe('buildCheckInMessage', () => {
  it('greets by first name', () => {
    expect(buildCheckInMessage('Aanya Rahman')).toContain('Hi Aanya,');
  });
  it('falls back when the name is blank', () => {
    expect(buildCheckInMessage('  ')).toContain('Hi there,');
  });
});
