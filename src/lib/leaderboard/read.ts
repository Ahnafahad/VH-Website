/**
 * DB reads for the multi-board leaderboard. Read-only — no writes.
 *
 * Batch scoping: every board is scoped to one `batches` row (name × product),
 * mirroring the "cohort = test × batch × product" rule already used for
 * per-test Top 5 (lib/tests/service.ts). A board's cohort = users whose
 * `users.batch` matches the batch name AND who hold active `user_access` for
 * the batch's product. This is the same definition for all three boards, so
 * LexiCore, Latest Test and All Tests always describe the same group of
 * people for a given batch — no cross-batch/cross-product mixing.
 */

import { db } from '@/lib/db';
import {
  users, userAccess, batches, vocabUserProgress, tests, testWindows, testAttempts,
} from '@/lib/db/schema';
import type { Batch, UserProduct } from '@/lib/db/schema';
import { and, eq, inArray, ne } from 'drizzle-orm';
import { resultsVisible } from '@/lib/tests/windows';
import { isTestAllowedForProducts } from '@/lib/tests/access';
import {
  isTestBoardEligible, pickLatestTestId, rankTestBoard, rankAllTestsBoard,
  rankLexiCoreBoard, type RankedBoardEntry, type AllTestsAttempt,
} from './boards';

/** Resolves the batch (name × product) that scopes a viewer's boards, from
 * their own `users.batch` string and active product grants. Null when the
 * viewer has no batch assigned or no matching active batch row exists —
 * boards render empty in that case, not a crash. */
export async function getViewerBatch(
  viewer: { batch: string | null; products: UserProduct[] },
): Promise<Batch | null> {
  if (!viewer.batch || viewer.products.length === 0) return null;
  const [batch] = await db
    .select()
    .from(batches)
    .where(and(
      eq(batches.name, viewer.batch),
      inArray(batches.product, viewer.products),
      eq(batches.status, 'active'),
    ))
    .limit(1);
  return batch ?? null;
}

/** userId → displayName for everyone in this batch's cohort. */
async function getCohort(batch: Batch): Promise<Map<number, string>> {
  const rows = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .innerJoin(userAccess, and(
      eq(userAccess.userId, users.id),
      eq(userAccess.product, batch.product),
      eq(userAccess.active, true),
    ))
    .where(and(eq(users.batch, batch.name), ne(users.status, 'inactive')));
  return new Map(rows.map(r => [r.id, r.name]));
}

// ─── LexiCore board ───────────────────────────────────────────────────────────

export async function getLexiCoreBoard(batch: Batch): Promise<RankedBoardEntry[]> {
  const cohort = await getCohort(batch);
  if (cohort.size === 0) return [];

  const progress = await db
    .select({ userId: vocabUserProgress.userId, totalPoints: vocabUserProgress.totalPoints })
    .from(vocabUserProgress)
    .where(inArray(vocabUserProgress.userId, [...cohort.keys()]));

  return rankLexiCoreBoard(progress.map(p => ({
    userId: p.userId,
    displayName: cohort.get(p.userId)!,
    totalPoints: p.totalPoints ?? 0,
  })));
}

// ─── Shared: cohort's visible non-diagnostic submitted attempts ──────────────

async function getVisibleCohortAttempts(cohort: Map<number, string>, product: string) {
  const eligibleTests = (await db.select().from(tests).where(eq(tests.status, 'published')))
    .filter(isTestBoardEligible)
    .filter(t => isTestAllowedForProducts(t, [product]));
  if (eligibleTests.length === 0) return { attempts: [], testById: new Map<number, typeof eligibleTests[number]>() };

  const testIds = eligibleTests.map(t => t.id);
  const [attempts, windows] = await Promise.all([
    db.select().from(testAttempts).where(and(
      inArray(testAttempts.testId, testIds),
      eq(testAttempts.status, 'submitted'),
      inArray(testAttempts.userId, [...cohort.keys()]),
    )),
    db.select().from(testWindows).where(inArray(testWindows.testId, testIds)),
  ]);

  const windowsByTest = new Map<number, typeof windows>();
  for (const w of windows) {
    const list = windowsByTest.get(w.testId) ?? [];
    list.push(w);
    windowsByTest.set(w.testId, list);
  }

  const testById = new Map(eligibleTests.map(t => [t.id, t]));
  const visible = attempts.filter(a => {
    const test = testById.get(a.testId);
    return test ? resultsVisible(test, windowsByTest.get(test.id) ?? []) : false;
  });

  return { attempts: visible, testById };
}

// ─── Latest Test board ────────────────────────────────────────────────────────

export interface LatestTestBoard {
  entries: RankedBoardEntry[];
  testTitle: string | null;
}

export async function getLatestTestBoard(batch: Batch): Promise<LatestTestBoard> {
  const cohort = await getCohort(batch);
  if (cohort.size === 0) return { entries: [], testTitle: null };

  const { attempts, testById } = await getVisibleCohortAttempts(cohort, batch.product);
  if (attempts.length === 0) return { entries: [], testTitle: null };

  const lastByTest = new Map<number, number>();
  for (const a of attempts) {
    const t = a.submittedAt?.getTime() ?? 0;
    lastByTest.set(a.testId, Math.max(lastByTest.get(a.testId) ?? 0, t));
  }
  const latestTestId = pickLatestTestId(
    [...lastByTest.entries()].map(([testId, lastSubmittedAt]) => ({ testId, lastSubmittedAt })),
  );
  if (latestTestId === null) return { entries: [], testTitle: null };

  const cohortAttempts = attempts.filter(a => a.testId === latestTestId);
  const entries = rankTestBoard(cohortAttempts.map(a => ({
    attemptId: a.id,
    userId: a.userId,
    totalScore: a.totalScore ?? 0,
    submittedAt: a.submittedAt?.getTime() ?? 0,
    correct: a.totalCorrect ?? 0,
    wrong: a.totalWrong ?? 0,
  })), cohort);

  return { entries, testTitle: testById.get(latestTestId)?.title ?? null };
}

// ─── All Tests (cumulative) board ────────────────────────────────────────────
// PROPOSAL, not user-approved: average percentage across every non-diagnostic
// submitted attempt in the cohort. See build report for the exact formula.

export async function getAllTestsBoard(batch: Batch): Promise<RankedBoardEntry[]> {
  const cohort = await getCohort(batch);
  if (cohort.size === 0) return [];

  const { attempts, testById } = await getVisibleCohortAttempts(cohort, batch.product);
  if (attempts.length === 0) return [];

  const rows: AllTestsAttempt[] = [];
  for (const a of attempts) {
    const test = testById.get(a.testId);
    if (!test || test.totalMarks <= 0) continue;
    rows.push({
      userId: a.userId,
      percentage: round2(((a.totalScore ?? 0) / test.totalMarks) * 100),
      submittedAt: a.submittedAt?.getTime() ?? 0,
    });
  }
  if (rows.length === 0) return [];

  return rankAllTestsBoard(rows, cohort);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
