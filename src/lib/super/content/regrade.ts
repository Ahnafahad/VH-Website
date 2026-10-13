/**
 * Regrade: recompute every submitted attempt with the SAME scorer the submit path uses
 * (scoreAttemptById), preview old -> new + rank movement, then apply in a retried transaction.
 */
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tests, testAttempts, users } from '@/lib/db/schema';
import { ApiException } from '@/lib/api-utils';
import { scoreAttemptById } from '@/lib/tests/service';
import { computeRanks } from '@/lib/tests/scoring';
import { parseChosenSections } from '@/lib/tests/diagnostic';
import { MAX_TX_ATTEMPTS, isTursoConflict } from '@/lib/db/tx-retry';
import { recordAudit } from '@/lib/audit-log';
import { snapshotTest } from './versions';

export interface RegradeInput {
  attemptId: number; userId: number; name: string;
  oldScore: number; newScore: number;
  oldCorrect: number; newCorrect: number;
  oldWrong: number; newWrong: number;
  oldUnattempted: number; newUnattempted: number;
  oldSections: string | null; newSections: string;
}
export interface RegradeRow extends RegradeInput {
  oldRank: number; newRank: number; rankDelta: number; changed: boolean;
}
export interface RegradeDiff {
  rows: RegradeRow[];
  total: number; changedCount: number; rankChangedCount: number;
  topMovers: RegradeRow[];
}

/** Pure: given old/new numbers per attempt, work out who changed and how ranks moved (test-wide, standard competition ranking). */
export function computeRegradeDiff(inputs: RegradeInput[]): RegradeDiff {
  const before = new Map(computeRanks(inputs.map(i => ({ attemptId: i.attemptId, totalScore: i.oldScore }))).map(r => [r.attemptId, r.rank]));
  const after = new Map(computeRanks(inputs.map(i => ({ attemptId: i.attemptId, totalScore: i.newScore }))).map(r => [r.attemptId, r.rank]));
  const rows: RegradeRow[] = inputs.map(i => {
    const oldRank = before.get(i.attemptId)!, newRank = after.get(i.attemptId)!;
    const changed = i.oldScore !== i.newScore || i.oldCorrect !== i.newCorrect || i.oldWrong !== i.newWrong
      || i.oldUnattempted !== i.newUnattempted || (i.oldSections ?? '') !== i.newSections;
    return { ...i, oldRank, newRank, rankDelta: oldRank - newRank, changed };
  });
  const topMovers = rows.filter(r => r.rankDelta !== 0)
    .sort((a, b) => Math.abs(b.rankDelta) - Math.abs(a.rankDelta)).slice(0, 5);
  return {
    rows, total: rows.length,
    changedCount: rows.filter(r => r.changed).length,
    rankChangedCount: rows.filter(r => r.rankDelta !== 0).length,
    topMovers,
  };
}

export async function previewRegrade(testId: number): Promise<RegradeDiff> {
  const test = await db.select().from(tests).where(eq(tests.id, testId)).get();
  if (!test) throw new ApiException('Test not found', 404);
  const attempts = await db.select({ a: testAttempts, name: users.name })
    .from(testAttempts).innerJoin(users, eq(users.id, testAttempts.userId))
    .where(and(eq(testAttempts.testId, testId), eq(testAttempts.status, 'submitted')));
  const inputs: RegradeInput[] = [];
  for (const { a, name } of attempts) {
    // Same restriction the submit route applies for diagnostics' chosen sections.
    const chosen = test.isDiagnostic ? parseChosenSections(a.chosenSections) : [];
    const s = await scoreAttemptById(a.id, testId, chosen.length > 0 ? chosen : undefined);
    inputs.push({
      attemptId: a.id, userId: a.userId, name,
      oldScore: a.totalScore ?? 0, newScore: s.totalScore,
      oldCorrect: a.totalCorrect ?? 0, newCorrect: s.totalCorrect,
      oldWrong: a.totalWrong ?? 0, newWrong: s.totalWrong,
      oldUnattempted: a.totalUnattempted ?? 0, newUnattempted: s.totalUnattempted,
      oldSections: a.sectionScores, newSections: JSON.stringify(s.sections),
    });
  }
  return computeRegradeDiff(inputs);
}

export async function applyRegrade(testId: number, actorId: number): Promise<{ changed: number; total: number; rankChanged: number }> {
  const diff = await previewRegrade(testId);
  const changed = diff.rows.filter(r => r.changed);
  if (changed.length === 0) return { changed: 0, total: diff.total, rankChanged: 0 };
  await snapshotTest(testId, 'Pre-regrade snapshot', actorId);

  for (let attempt = 1; attempt <= MAX_TX_ATTEMPTS; attempt++) {
    try {
      await db.transaction(async (tx) => {
        for (const r of changed) {
          await tx.update(testAttempts).set({
            totalScore: r.newScore, totalCorrect: r.newCorrect, totalWrong: r.newWrong,
            totalUnattempted: r.newUnattempted, sectionScores: r.newSections,
          }).where(eq(testAttempts.id, r.attemptId));
        }
      });
      break;
    } catch (err) {
      if (attempt === MAX_TX_ATTEMPTS || !isTursoConflict(err)) throw err;
      await new Promise(r => setTimeout(r, 25 * attempt));
    }
  }

  await recordAudit({
    actorUserId: actorId, action: 'marks.regrade', entityType: 'test', entityId: testId,
    before: null,
    after: {
      attempts: diff.total, changed: changed.length, rankChanged: diff.rankChangedCount,
      topMovers: diff.topMovers.map(m => ({ name: m.name, from: m.oldRank, to: m.newRank })),
    },
  });
  return { changed: changed.length, total: diff.total, rankChanged: diff.rankChangedCount };
}
