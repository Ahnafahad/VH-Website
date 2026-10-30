/**
 * Server-side data for mock exams. A mock is a normal `tests` row (is_mock = true): taking it, the
 * answer autosave, anti-cheat and offline answer-entry all reuse the tests module unchanged. This file
 * adds the mock-specific parts: the student list, the provisional/official result views (combined with
 * the essays), the leaderboard, and the staff overview.
 */

import { db } from '@/lib/db';
import {
  tests, testWindows, testAttempts, essaySeries, essaySubmissions, users, userAccess,
  type Test, type UserWithProducts,
} from '@/lib/db/schema';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { canAccessTest, isTestStaff } from '@/lib/tests/access';
import { effectiveWindowState } from '@/lib/tests/windows';
import { computeRanks, type AttemptScore } from '@/lib/tests/scoring';
import { getPublishedTestBySlug, getTestResults } from '@/lib/tests/service';
import { parseEssays } from '@/lib/essays/prompts';
import { resolveFileUrl } from '@/lib/storage/r2';
import { computeMissedChances } from './missed-chances';
import { mockPhase } from './state';
import type {
  MockAdminEntry, MockAdminOverview, MockEssayLine, MockLeaderboardRow, MockListEntry,
  MockMcqSummary, MockResult, MockWindowDTO,
} from './types';

const LEADERBOARD_SIZE = 10;

function windowDTO(w: typeof testWindows.$inferSelect, now: Date): MockWindowDTO {
  return {
    id: w.id, mode: w.mode, opensAt: w.opensAt.getTime(), closesAt: w.closesAt.getTime(),
    durationMinutes: w.durationMinutes, state: effectiveWindowState(w, now),
  };
}

function mcqSummary(a: { totalScore: number | null; totalCorrect: number | null; totalWrong: number | null; totalUnattempted: number | null; sectionScores: string | null }, maxScore: number): MockMcqSummary {
  const sections = a.sectionScores ? (JSON.parse(a.sectionScores) as AttemptScore['sections']) : [];
  return {
    score: a.totalScore ?? 0,
    maxScore,
    correct: a.totalCorrect ?? 0,
    wrong: a.totalWrong ?? 0,
    unattempted: a.totalUnattempted ?? 0,
    sections: sections.map(s => ({
      title: s.title, score: s.score, maxScore: s.maxScore,
      correct: s.correct, wrong: s.wrong, unattempted: s.unattempted,
    })),
  };
}

// ─── Student: list ────────────────────────────────────────────────────────────

export async function getMockListForUser(user: UserWithProducts): Promise<MockListEntry[]> {
  const now = new Date();
  const rows = (await db.select().from(tests).where(and(eq(tests.isMock, true), eq(tests.status, 'published'))))
    .filter(t => canAccessTest(user, t));
  if (rows.length === 0) return [];

  const testIds = rows.map(t => t.id);
  const seriesIds = [...new Set(rows.map(t => t.essaySeriesId).filter((x): x is number => x != null))];
  const [windows, attempts, series, subs] = await Promise.all([
    db.select().from(testWindows).where(inArray(testWindows.testId, testIds)),
    db.select().from(testAttempts).where(and(inArray(testAttempts.testId, testIds), eq(testAttempts.userId, user.id))),
    seriesIds.length ? db.select().from(essaySeries).where(inArray(essaySeries.id, seriesIds)) : Promise.resolve([]),
    seriesIds.length
      ? db.select({ seriesId: essaySubmissions.seriesId, essayIndex: essaySubmissions.essayIndex })
          .from(essaySubmissions)
          .where(and(inArray(essaySubmissions.seriesId, seriesIds), eq(essaySubmissions.userId, user.id)))
      : Promise.resolve([]),
  ]);

  return rows.map(t => {
    const tWindows = windows.filter(w => w.testId === t.id).sort((a, b) => a.opensAt.getTime() - b.opensAt.getTime());
    const attempt = attempts.find(a => a.testId === t.id) ?? null;
    const s = series.find(x => x.id === t.essaySeriesId);
    return {
      slug: t.slug,
      bucket: t.bucket,
      title: t.title,
      examCode: t.examCode,
      totalQuestions: t.totalQuestions,
      totalMarks: t.totalMarks,
      windows: tWindows.map(w => windowDTO(w, now)),
      attempt: attempt && { status: attempt.status, mode: attempt.mode, submittedAt: attempt.submittedAt?.getTime() ?? null },
      phase: mockPhase(t, tWindows, attempt, now),
      essay: s ? {
        seriesId: s.id,
        title: s.title,
        deadline: s.deadline.getTime(),
        essayCount: parseEssays(s).length,
        submitted: subs.filter(x => x.seriesId === s.id).length,
        maxMarks: s.totalMarks,
      } : null,
    };
  });
}

// ─── Student: result ──────────────────────────────────────────────────────────

/** Graded essay marks for a series: userId → sum of graded `total`s. */
async function essayTotalsByUser(seriesId: number): Promise<Map<number, number>> {
  const rows = await db.select({ userId: essaySubmissions.userId, total: sql<number>`sum(${essaySubmissions.total})`.mapWith(Number) })
    .from(essaySubmissions)
    .where(and(eq(essaySubmissions.seriesId, seriesId), eq(essaySubmissions.status, 'graded')))
    .groupBy(essaySubmissions.userId);
  return new Map(rows.map(r => [r.userId, r.total ?? 0]));
}

async function buildLeaderboard(test: Test, viewer: UserWithProducts, essayTotals: Map<number, number>) {
  const submitted = await db.select().from(testAttempts)
    .where(and(eq(testAttempts.testId, test.id), eq(testAttempts.status, 'submitted')));
  if (submitted.length === 0) return { rows: [] as MockLeaderboardRow[], byUser: new Map<number, { rank: number; percentile: number }>(), outOf: 0 };

  const people = await db.select({ id: users.id, name: users.name, batch: users.batch })
    .from(users).where(inArray(users.id, submitted.map(a => a.userId)));
  const personById = new Map(people.map(p => [p.id, p]));
  const batch = test.mockBatch ?? viewer.batch ?? null;
  const cohort = submitted.filter(a => (personById.get(a.userId)?.batch ?? null) === batch || a.userId === viewer.id);

  const totalOf = (a: typeof cohort[number]) => Math.round(((a.totalScore ?? 0) + (essayTotals.get(a.userId) ?? 0)) * 100) / 100;
  const ranked = computeRanks(cohort.map(a => ({ attemptId: a.id, totalScore: totalOf(a) })));
  const attemptById = new Map(cohort.map(a => [a.id, a]));

  const byUser = new Map<number, { rank: number; percentile: number }>();
  const rows: MockLeaderboardRow[] = [];
  for (const r of ranked) {
    const a = attemptById.get(r.attemptId)!;
    byUser.set(a.userId, { rank: r.rank, percentile: r.percentile });
    if (rows.length < LEADERBOARD_SIZE) {
      rows.push({
        rank: r.rank, name: personById.get(a.userId)?.name ?? 'Student',
        mcq: a.totalScore ?? 0, essay: essayTotals.get(a.userId) ?? 0, total: r.totalScore,
      });
    }
  }
  return { rows, byUser, outOf: cohort.length };
}

/** Provisional/official result for the caller. Staff always get the official view (preview). */
export async function getMockResult(user: UserWithProducts, slug: string): Promise<MockResult | null> {
  const found = await getPublishedTestBySlug(slug);
  if (!found || !found.test.isMock || !canAccessTest(user, found.test)) return null;
  const { test, windows } = found;

  const attempt = await db.select().from(testAttempts)
    .where(and(eq(testAttempts.testId, test.id), eq(testAttempts.userId, user.id))).get() ?? null;
  const phase = isTestStaff(user) ? 'official' : mockPhase(test, windows, attempt, new Date());

  if (phase === 'locked') return { phase, title: test.title };
  if (phase === 'provisional') {
    return { phase, title: test.title, examCode: test.examCode, mcq: mcqSummary(attempt!, test.totalMarks) };
  }

  const results = await getTestResults(test.id, user.id);
  const series = test.essaySeriesId
    ? await db.select().from(essaySeries).where(eq(essaySeries.id, test.essaySeriesId)).get() ?? null
    : null;
  const prompts = series ? parseEssays(series) : [];
  const essayMax = prompts.reduce((s, p) => s + p.max, 0);
  const essayTotals = series ? await essayTotalsByUser(series.id) : new Map<number, number>();

  let essays: MockEssayLine[] | null = null;
  if (series) {
    const mine = await db.select().from(essaySubmissions)
      .where(and(eq(essaySubmissions.seriesId, series.id), eq(essaySubmissions.userId, user.id)));
    essays = prompts.map((p, i) => {
      const sub = mine.find(m => m.essayIndex === i + 1);
      return {
        index: i + 1, max: p.max,
        total: sub?.status === 'graded' ? sub.total : null,
        status: sub ? (sub.status as MockEssayLine['status']) : 'not_submitted',
      };
    });
  }

  const board = await buildLeaderboard(test, user, essayTotals);
  const myEssay = essayTotals.get(user.id) ?? 0;
  const me = results?.me ?? null;
  const myRank = board.byUser.get(user.id);

  return {
    phase: 'official',
    title: test.title,
    examCode: test.examCode,
    mcq: me && attempt ? mcqSummary(attempt, test.totalMarks) : null,
    essays,
    essayTotal: series ? myEssay : null,
    essayMax,
    combined: me ? Math.round((me.totalScore + myEssay) * 100) / 100 : null,
    maxTotal: test.totalMarks + essayMax,
    me: me && myRank ? { ...myRank, outOf: board.outOf } : null,
    leaderboard: board.rows,
    missed: me && results ? computeMissedChances({
      sections: results.sections.map(s => ({
        id: s.id, title: s.title, penaltyPerWrong: s.penaltyPerWrong,
        questions: s.questions.map(q => ({ id: q.id, number: q.number })),
      })),
      analytics: results.questionAnalytics,
      responses: me.responses,
    }) : null,
    solutionUrl: await resolveFileUrl(test.solutionPdfKey),
    reviewHref: `/tests/${test.bucket}/${test.slug}/results`,
  };
}

// ─── Staff: overview ──────────────────────────────────────────────────────────

export async function getMockAdminOverview(): Promise<MockAdminOverview> {
  const now = new Date();
  const all = await db.select().from(tests);
  const mockRows = all.filter(t => t.isMock);
  const allSeries = await db.select({ id: essaySeries.id, title: essaySeries.title }).from(essaySeries);

  const mocks: MockAdminEntry[] = [];
  if (mockRows.length > 0) {
    const ids = mockRows.map(t => t.id);
    const seriesIds = mockRows.map(t => t.essaySeriesId).filter((x): x is number => x != null);
    const [windows, counts, scanned, subs, access] = await Promise.all([
      db.select().from(testWindows).where(inArray(testWindows.testId, ids)),
      db.select({ testId: testAttempts.testId, status: testAttempts.status, n: sql<number>`count(*)`.mapWith(Number) })
        .from(testAttempts).where(inArray(testAttempts.testId, ids)).groupBy(testAttempts.testId, testAttempts.status),
      db.select({ testId: testAttempts.testId, n: sql<number>`count(*)`.mapWith(Number) })
        .from(testAttempts).where(and(inArray(testAttempts.testId, ids), eq(testAttempts.resultSource, 'omr')))
        .groupBy(testAttempts.testId),
      seriesIds.length
        ? db.select({ seriesId: essaySubmissions.seriesId, status: essaySubmissions.status, n: sql<number>`count(*)`.mapWith(Number) })
            .from(essaySubmissions).where(inArray(essaySubmissions.seriesId, seriesIds))
            .groupBy(essaySubmissions.seriesId, essaySubmissions.status)
        : Promise.resolve([]),
      // expected sitters: active IBA students, narrowed per mock by batch below
      db.select({ userId: userAccess.userId, batch: users.batch })
        .from(userAccess).innerJoin(users, eq(users.id, userAccess.userId))
        .where(and(eq(userAccess.product, 'iba'), eq(userAccess.active, true), eq(users.role, 'student'))),
    ]);

    for (const t of mockRows) {
      const s = allSeries.find(x => x.id === t.essaySeriesId);
      const c = (status: string) => counts.find(x => x.testId === t.id && x.status === status)?.n ?? 0;
      const e = (status: string) => subs.find(x => x.seriesId === t.essaySeriesId && x.status === status)?.n ?? 0;
      mocks.push({
        id: t.id, slug: t.slug, bucket: t.bucket, title: t.title, status: t.status,
        examCode: t.examCode, mockBatch: t.mockBatch, essaySeriesId: t.essaySeriesId,
        hasSolution: !!t.solutionPdfKey,
        resultsPublishedAt: t.resultsPublishedAt?.getTime() ?? null,
        totalQuestions: t.totalQuestions, totalMarks: t.totalMarks,
        windows: windows.filter(w => w.testId === t.id).sort((a, b) => a.opensAt.getTime() - b.opensAt.getTime()).map(w => windowDTO(w, now)),
        cohortSize: new Set(access.filter(a => !t.mockBatch || a.batch === t.mockBatch).map(a => a.userId)).size,
        attempts: { inProgress: c('in_progress'), submitted: c('submitted'), banned: c('banned'), scanned: scanned.find(x => x.testId === t.id)?.n ?? 0 },
        essay: s ? { title: s.title, submitted: e('submitted'), graded: e('graded'), rejected: e('rejected') } : null,
      });
    }
  }

  return {
    mocks,
    candidates: all.filter(t => !t.isMock && !t.isDiagnostic)
      .map(t => ({ id: t.id, title: t.title, slug: t.slug, status: t.status }))
      .sort((a, b) => b.id - a.id),
    essaySeries: allSeries.sort((a, b) => b.id - a.id),
  };
}
