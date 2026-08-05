/**
 * Pre-filled WhatsApp status message (DECISIONS.md "Approved extra
 * recommendations") — name, latest test score, rank, plus whatever else the
 * metrics module has for this student. Purely a draft: the admin reads,
 * edits and sends it themselves inside WhatsApp.
 */

import type { StudentMetrics } from './student-metrics-pure';
import type { AtRiskResult } from './at-risk-pure';

export interface WhatsAppMessageInput {
  studentName: string;
  metrics:     StudentMetrics;
  atRisk:      AtRiskResult;
}

export function buildStatusMessage({ studentName, metrics, atRisk }: WhatsAppMessageInput): string {
  const lines: string[] = [`Hi, a quick update on ${studentName}'s progress at VH:`];

  if (metrics.marksTrend.length > 0) {
    const latest = metrics.marksTrend[metrics.marksTrend.length - 1];
    lines.push(`- Latest test score: ${latest.percentage.toFixed(1)}%`);
  }
  if (metrics.latestRank != null && metrics.latestTotalStudents != null) {
    lines.push(`- Latest rank: #${metrics.latestRank} of ${metrics.latestTotalStudents}`);
  }
  if (metrics.testAveragePercent != null) {
    lines.push(`- Test average: ${metrics.testAveragePercent.toFixed(1)}% across ${metrics.testsAttempted} test${metrics.testsAttempted === 1 ? '' : 's'}`);
  }
  if (metrics.weakestSection) {
    lines.push(`- Weakest section: ${metrics.weakestSection}`);
  }

  if (atRisk.reasons.length > 0) {
    lines.push('', 'Flagged for attention:');
    for (const r of atRisk.reasons) lines.push(`- ${r.message}`);
  }

  return lines.join('\n');
}
