/**
 * At-risk student flag — pure rule (DECISIONS.md "Approved extra
 * recommendations"). No DB imports — unit-testable without a live DB
 * connection. The DB-touching scan is in at-risk.ts.
 *
 * The platform is young (see metrics-inventory.md: 5 tests with attempts, 8
 * completed class sessions, 2 assignments), so most "at risk" signals people
 * reach for by default are too thin here and would just cry wolf:
 *
 *  - REJECTED absolute test-average threshold (e.g. "<50%") — the schema has
 *    no defined passing line, and with only 5 tests total an arbitrary cutoff
 *    would just relabel "consistently weak" as "newly at risk".
 *  - REJECTED homework submission rate / attendance % — only 2 assignments and
 *    8 completed sessions exist in prod; DECISIONS.md §12 already excludes
 *    these from the whole progress feature for the same reason.
 *  - REJECTED skipped-rate / consistency (variance) taken alone — neither is
 *    directional. A single hard test can spike either without the student
 *    actually sliding.
 *  - REJECTED improvementDelta (first attempt vs latest) — a strong opening
 *    attempt can mask a real ongoing decline in the middle attempts; a
 *    2-in-a-row check is a stricter, less noisy version of the same idea.
 *  - REJECTED test_violations (proctoring flags) — a real signal, but an
 *    integrity signal, not an academic-decline one; only 1 student in prod
 *    has any row at all, too rare to double up as "at risk" here.
 *
 * What ships: two directional, multi-point signals, each requiring
 * MIN_ATTEMPTS_FOR_TREND (3) non-diagnostic submitted attempts so a student
 * with almost no data is never flagged — there simply aren't 3 points to look
 * at, so no reason ever fires for them.
 */

import type { StudentMetrics } from './student-metrics-pure';

export const MIN_ATTEMPTS_FOR_TREND = 3;

export interface AtRiskReason {
  code:    'marks_decline' | 'rank_decline';
  message: string;
}

export interface AtRiskResult {
  atRisk:  boolean;
  reasons: AtRiskReason[];
}

/**
 * Looks only at the LAST 3 chronological non-diagnostic submitted attempts
 * (student-metrics-pure.ts already sorts marksTrend/rankTrend oldest-first
 * and already excludes diagnostics).
 */
export function computeAtRiskFlag(metrics: StudentMetrics): AtRiskResult {
  const reasons: AtRiskReason[] = [];

  if (metrics.marksTrend.length >= MIN_ATTEMPTS_FOR_TREND) {
    const [a, b, c] = metrics.marksTrend.slice(-MIN_ATTEMPTS_FOR_TREND).map(p => p.percentage);
    if (c < b && b < a) {
      reasons.push({
        code:    'marks_decline',
        message: `Marks fell for 2 tests in a row: ${a.toFixed(1)}% → ${b.toFixed(1)}% → ${c.toFixed(1)}%`,
      });
    }
  }

  if (metrics.rankTrend.length >= MIN_ATTEMPTS_FOR_TREND) {
    const last3 = metrics.rankTrend.slice(-MIN_ATTEMPTS_FOR_TREND);
    const [a, b, c] = last3.map(p => p.rank);
    if (c > b && b > a) {
      reasons.push({
        code:    'rank_decline',
        message: `Rank dropped for 2 tests in a row: #${a} → #${b} → #${c} of ${last3[2].totalStudents}`,
      });
    }
  }

  return { atRisk: reasons.length > 0, reasons };
}

// ─── Display helpers (no change to the rule above) ────────────────────────────

/** The last three scores and ranks behind the flag, oldest first, for the sparkline. */
export interface AtRiskTrend {
  scores: number[]; // percentages, 1 decimal
  ranks:  number[];
}

export function atRiskTrend(metrics: StudentMetrics): AtRiskTrend {
  const round1 = (n: number) => Math.round(n * 10) / 10;
  return {
    scores: metrics.marksTrend.slice(-MIN_ATTEMPTS_FOR_TREND).map(p => round1(p.percentage)),
    ranks:  metrics.rankTrend.slice(-MIN_ATTEMPTS_FOR_TREND).map(p => p.rank),
  };
}

const SHORT_REASON: Record<AtRiskReason['code'], string> = {
  marks_decline: 'Marks fell on the last two tests',
  rank_decline:  'Rank fell two tests in a row',
};

/** One short line for a row, e.g. "Marks fell on the last two tests". */
export function shortReason(reasons: { code: string }[]): string {
  const lines = reasons
    .map(r => SHORT_REASON[r.code as AtRiskReason['code']])
    .filter((l): l is string => Boolean(l));
  return lines.join(' · ');
}

/**
 * Series for the sparkline, where a higher value always means better. Marks
 * decline draws the scores; rank-only decline draws the ranks upside down
 * (rank 1 is best) so a falling line still reads as getting worse.
 */
export function sparkSeries(
  trend: AtRiskTrend,
  reasons: { code: string }[],
): { kind: 'marks' | 'rank'; values: number[] } {
  const hasMarks = reasons.some(r => r.code === 'marks_decline');
  if (hasMarks || trend.ranks.length === 0) return { kind: 'marks', values: trend.scores };
  return { kind: 'rank', values: trend.ranks.map(r => -r) };
}
