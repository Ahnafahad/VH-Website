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
