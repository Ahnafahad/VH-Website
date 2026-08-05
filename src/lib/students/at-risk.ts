/**
 * DB fetch layer for the at-risk student scan (DECISIONS.md "Approved extra
 * recommendations"). See at-risk-pure.ts for the rule itself and the
 * rejected-signals rationale. Reuses getStudentMetricsForUser — no second
 * aggregation of test scoring.
 */

import { db } from '@/lib/db';
import { users, tests, testAttempts } from '@/lib/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { getStudentMetricsForUser } from './student-metrics';
import { computeAtRiskFlag, MIN_ATTEMPTS_FOR_TREND } from './at-risk-pure';
import type { AtRiskReason } from './at-risk-pure';

export { computeAtRiskFlag, MIN_ATTEMPTS_FOR_TREND } from './at-risk-pure';
export type { AtRiskReason, AtRiskResult } from './at-risk-pure';

export interface AtRiskStudent {
  id:      number;
  name:    string;
  email:   string;
  batch:   string | null;
  reasons: AtRiskReason[];
}

/**
 * DB-touching scan for the admin home panel. Cheaply prefilters to students
 * who could possibly have 3 non-diagnostic submitted attempts before running
 * the (expensive, per-attempt) full metrics pipeline — computeAtRiskFlag can
 * never fire for anyone below that count anyway, so there is no point paying
 * for their metrics.
 */
export async function getAtRiskStudents(): Promise<AtRiskStudent[]> {
  const attemptRows = await db
    .select({ userId: testAttempts.userId })
    .from(testAttempts)
    .innerJoin(tests, eq(testAttempts.testId, tests.id))
    .where(and(eq(testAttempts.status, 'submitted'), eq(tests.isDiagnostic, false)));

  const counts = new Map<number, number>();
  for (const r of attemptRows) counts.set(r.userId, (counts.get(r.userId) ?? 0) + 1);

  const candidateIds = Array.from(counts.entries())
    .filter(([, n]) => n >= MIN_ATTEMPTS_FOR_TREND)
    .map(([id]) => id);
  if (candidateIds.length === 0) return [];

  const candidates = await db
    .select({ id: users.id, name: users.name, email: users.email, batch: users.batch })
    .from(users)
    .where(and(eq(users.role, 'student'), eq(users.status, 'active'), inArray(users.id, candidateIds)));
  if (candidates.length === 0) return [];

  const fullMetrics = await Promise.all(candidates.map(u => getStudentMetricsForUser(u.id)));

  const flagged: AtRiskStudent[] = [];
  candidates.forEach((u, i) => {
    const full = fullMetrics[i];
    if (!full) return;
    const flag = computeAtRiskFlag(full.testMetrics);
    if (flag.atRisk) flagged.push({ id: u.id, name: u.name, email: u.email, batch: u.batch, reasons: flag.reasons });
  });

  return flagged;
}
