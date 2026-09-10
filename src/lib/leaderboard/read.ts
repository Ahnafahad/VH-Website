/**
 * DB reads for the multi-board leaderboard. Read-only — no writes.
 *
 * Batch scoping: every board is scoped to the viewer's batch name × the full
 * set of products they hold active access to under it, mirroring the cohort
 * rule used for per-test Top 5 (lib/tests/service.ts — batch name match +
 * product intersection). A board's cohort = users whose `users.batch`
 * matches the batch name AND who hold active `user_access` for ANY of those
 * products — a student with both iba and fbs access must see the same full
 * cohort a single-product student sees, not a narrower slice of it.
 */

import { db } from '@/lib/db';
import {
  users, userAccess, batches, vocabUserProgress, tests, testWindows, testAttempts,
} from '@/lib/db/schema';
import type { UserProduct } from '@/lib/db/schema';
import { and, eq, inArray, ne } from 'drizzle-orm';
import { resultsVisible } from '@/lib/tests/windows';
import { isTestAllowedForProducts } from '@/lib/tests/access';
import {
  isTestBoardEligible, pickLatestTestId, rankTestBoard, rankAllTestsBoard,
  rankLexiCoreBoard, type RankedBoardEntry, type AllTestsAttempt,
} from './boards';

/** A viewer's batch scope: the batch name plus every active product they
 * hold access to under it. Students commonly hold more than one product
 * (e.g. iba + fbs) — the cohort for every board must include all of them,
 * not just one arbitrarily picked product, or the board silently narrows to
 * a fraction of the true batch (see 2026-09-10 dashboard-vs-backend bug). */
export interface ViewerBatch {
  name: string;
  products: UserProduct[];
}

/** Resolves the batch scope for a viewer, from their own `users.batch`
 * string and active product grants. Null when the viewer has no batch
 * assigned or no matching active batch row exists — boards render empty in
 * that case, not a crash. */
export async function getViewerBatch(
  viewer: { batch: string | null; products: UserProduct[] },
): Promise<ViewerBatch | null> {
  if (!viewer.batch || viewer.products.length === 0) return null;
  const rows = await db
    .select({ product: batches.product })
    .from(batches)
    .where(and(
      eq(batches.name, viewer.batch),
      inArray(batches.product, viewer.products),
      eq(batches.status, 'active'),
    ));
  if (rows.length === 0) return null;
  const matched = new Set(rows.map(r => r.product));
  return { name: viewer.batch, products: viewer.products.filter(p => matched.has(p)) };
}

/** userId → displayName for everyone in this batch's cohort (any of the
 * viewer's active products, not just one). */
async function getCohort(batch: ViewerBatch): Promise<Map<number, string>> {
  const rows = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .innerJoin(userAccess, and(
      eq(userAccess.userId, users.id),
      inArray(userAccess.product, batch.products),
      eq(userAccess.active, true),
    ))
    .where(and(eq(users.batch, batch.name), ne(users.status, 'inactive')));
  return new Map(rows.map(r => [r.id, r.name]));
}

// ─── LexiCore board ───────────────────────────────────────────────────────────

export async function getLexiCoreBoard(batch: ViewerBatch): Promise<RankedBoardEntry[]> {
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

async function getVisibleCohortAttempts(cohort: Map<number, string>, products: UserProduct[]) {
  const eligibleTests = (await db.select().from(tests).where(eq(tests.status, 'published')))
    .filter(isTestBoardEligible)
    .filter(t => isTestAllowedForProducts(t, products));
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

export async function getLatestTestBoard(batch: ViewerBatch): Promise<LatestTestBoard> {
  const cohort = await getCohort(batch);
  if (cohort.size === 0) return { entries: [], testTitle: null };

  const { attempts, testById } = await getVisibleCohortAttempts(cohort, batch.products);
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

export async function getAllTestsBoard(batch: ViewerBatch): Promise<RankedBoardEntry[]> {
  const cohort = await getCohort(batch);
  if (cohort.size === 0) return [];

  const { attempts, testById } = await getVisibleCohortAttempts(cohort, batch.products);
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
