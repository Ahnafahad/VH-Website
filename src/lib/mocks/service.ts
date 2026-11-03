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
import { effectiveWindowState, resultsVisible } from '@/lib/tests/windows';
import { applyWindowOverrides, applyEssayDeadlineOverrides } from '@/lib/tests/window-overrides';
import { MOCK_TRIAL, inMockTrialAccess } from './trial';
import { computeRanks, type AttemptScore } from '@/lib/tests/scoring';
import { getPublishedTestBySlug, getTestResults } from '@/lib/tests/service';
import { parseEssays } from '@/lib/essays/prompts';
import { resolveFileUrl } from '@/lib/storage/r2';
import { computeMissedChances } from './missed-chances';
import { getEssayGate } from './electives';
import { mockPhase } from './state';
import type {
  MockAdminEntry, MockAdminOverview, MockEssayLine, MockLeaderboardRow, MockListEntry,
  MockMcqSummary, MockResult, MockWindowDTO,
} from './types';

const LEADERBOARD_SIZE = 10;

/** Every window of the mock has closed (a mock with no windows has not "ended"). */
function isMockEnded(windows: (typeof testWindows.$inferSelect)[], now: Date): boolean {
  return windows.length > 0 && windows.every(w => effectiveWindowState(w, now) === 'closed');
}

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
    // Elective mocks score only the sections the student sat, so their maximum is smaller than the paper's.
    maxScore: sections.length ? sections.reduce((n, s) => n + s.maxScore, 0) : maxScore,
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

/** Mock 1 trial walk-ins get a student ID to write on their OMR/essay sheets: '0' + 5 digits, last 5 unique
 * across every ID (same rule as scripts/assign-iba-2026-student-ids.mjs) so OMR import matches them. */
export async function ensureStudentId(user: UserWithProducts): Promise<string | null> {
  if (user.studentId || isTestStaff(user) || !inMockTrialAccess()) return user.studentId ?? null;
  const used = new Set((await db.select({ sid: users.studentId }).from(users))
    .map(r => r.sid).filter((x): x is string => !!x && /^\d{5,6}$/.test(x)).map(x => Number(x) % 100000));
  for (let i = 0; i < 20; i++) {
    const n = Math.floor(Math.random() * 100000);
    if (used.has(n)) continue;
    const sid = '0' + String(n).padStart(5, '0');
    try {
      const [row] = await db.update(users).set({ studentId: sid })
        .where(and(eq(users.id, user.id), sql`${users.studentId} IS NULL`)).returning({ sid: users.studentId });
      if (row) return sid;
      return (await db.select({ sid: users.studentId }).from(users).where(eq(users.id, user.id)).get())?.sid ?? null;
    } catch { /* unique clash with a concurrent sign-up: try another */ }
  }
  return null;
}

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

  // Per-student extensions (staff-set in lms_settings) so the hub matches the test page.
  const myWindows = await applyWindowOverrides(user.id, windows);
  const mySeries = await applyEssayDeadlineOverrides(user.id, series);

  return Promise.all(rows.map(async t => {
    const tWindows = myWindows.filter(w => w.testId === t.id).sort((a, b) => a.opensAt.getTime() - b.opensAt.getTime());
    const attempt = attempts.find(a => a.testId === t.id) ?? null;
    const s = mySeries.find(x => x.id === t.essaySeriesId);
    const prompts = s ? parseEssays(s) : [];
    const gate = s && t.electiveCount != null ? await getEssayGate(user.id, s.id) : null;
    const mine = (i: number) => !gate || gate.allowed.has(i + 1);
    const ended = isMockEnded(tWindows, now);
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
      hasElectives: t.electiveCount != null,
      essay: s ? {
        seriesId: s.id,
        title: s.title,
        deadline: s.deadline.getTime(),
        essayCount: prompts.filter((_, i) => mine(i)).length,
        submitted: subs.filter(x => x.seriesId === s.id && mine(x.essayIndex - 1)).length,
        maxMarks: prompts.reduce((n, p, i) => (mine(i) ? n + p.max : n), 0),
      } : null,
      ended,
      reviewHref: resultsVisible(t, tWindows, now) ? `/tests/${t.bucket}/${t.slug}/results` : null,
      solutionUrl: ended || t.resultsPublishedAt ? await resolveFileUrl(t.solutionPdfKey) : null,
    };
  }));
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

interface UserRank { rank: number; percentile: number; mcq: number; essay: number; total: number; online: boolean }

async function buildLeaderboard(test: Test, viewer: Pick<UserWithProducts, 'id'> | null, essayTotals: Map<number, number>) {
  // A rejected OMR paper keeps its results but is not ranked.
  const submitted = (await db.select().from(testAttempts)
    .where(and(eq(testAttempts.testId, test.id), eq(testAttempts.status, 'submitted'))))
    .filter(a => a.omrStatus !== 'rejected');
  if (submitted.length === 0) return { rows: [] as MockLeaderboardRow[], byUser: new Map<number, UserRank>(), outOf: 0 };

  const people = await db.select({ id: users.id, name: users.name, batch: users.batch })
    .from(users).where(inArray(users.id, submitted.map(a => a.userId)));
  const personById = new Map(people.map(p => [p.id, p]));
  // One ranking for everyone who sat it; only a batch-scoped mock is ranked within its batch.
  const batch = test.id === MOCK_TRIAL.testId ? null : test.mockBatch ?? null; // trial sitters rank with the cohort
  const cohort = batch === null ? submitted : submitted.filter(a => (personById.get(a.userId)?.batch ?? null) === batch || a.userId === viewer?.id);

  const totalOf = (a: typeof cohort[number]) => Math.round(((a.totalScore ?? 0) + (essayTotals.get(a.userId) ?? 0)) * 100) / 100;
  const ranked = computeRanks(cohort.map(a => ({ attemptId: a.id, totalScore: totalOf(a) })));
  const attemptById = new Map(cohort.map(a => [a.id, a]));

  const byUser = new Map<number, UserRank>();
  const rows: MockLeaderboardRow[] = [];
  for (const r of ranked) {
    const a = attemptById.get(r.attemptId)!;
    byUser.set(a.userId, {
      rank: r.rank, percentile: r.percentile,
      mcq: a.totalScore ?? 0, essay: essayTotals.get(a.userId) ?? 0, total: r.totalScore,
      online: a.resultSource !== 'omr',
    });
    if (rows.length < LEADERBOARD_SIZE) {
      rows.push({
        rank: r.rank, name: personById.get(a.userId)?.name ?? 'Student',
        mcq: a.totalScore ?? 0, essay: essayTotals.get(a.userId) ?? 0, total: r.totalScore,
        online: a.resultSource !== 'omr',
      });
    }
  }
  return { rows, byUser, outOf: cohort.length };
}

/** Provisional/official result for the caller. Staff always get the official view (preview). */
export async function getMockResult(user: UserWithProducts, slug: string): Promise<MockResult | null> {
  const found = await getPublishedTestBySlug(slug);
  if (!found || !found.test.isMock || !canAccessTest(user, found.test)) return null;
  const test = found.test;
  const windows = await applyWindowOverrides(user.id, found.windows);

  const attempt = await db.select().from(testAttempts)
    .where(and(eq(testAttempts.testId, test.id), eq(testAttempts.userId, user.id))).get() ?? null;
  const phase = isTestStaff(user) ? 'official' : mockPhase(test, windows, attempt, new Date());

  if (phase === 'locked') return { phase, title: test.title };
  if (phase === 'provisional') {
    return {
      phase, title: test.title, examCode: test.examCode, mcq: mcqSummary(attempt!, test.totalMarks),
      solutionUrl: await resolveFileUrl(test.solutionPdfKey),
      reviewHref: `/tests/${test.bucket}/${test.slug}/results`,
    };
  }

  const results = await getTestResults(test.id, user.id);
  const series = test.essaySeriesId
    ? await db.select().from(essaySeries).where(eq(essaySeries.id, test.essaySeriesId)).get() ?? null
    : null;
  const gate = series && test.electiveCount != null ? await getEssayGate(user.id, series.id) : null;
  const prompts = series ? parseEssays(series) : [];
  const sat = (i: number) => !gate || gate.allowed.has(i + 1);
  const essayMax = prompts.reduce((s, p, i) => (sat(i) ? s + p.max : s), 0);
  const essayTotals = series ? await essayTotalsByUser(series.id) : new Map<number, number>();

  let essays: MockEssayLine[] | null = null;
  if (series) {
    const mine = await db.select().from(essaySubmissions)
      .where(and(eq(essaySubmissions.seriesId, series.id), eq(essaySubmissions.userId, user.id)));
    essays = prompts.flatMap((p, i) => {
      if (!sat(i)) return [];
      const sub = mine.find(m => m.essayIndex === i + 1);
      return [{
        index: i + 1, max: p.max,
        total: sub?.status === 'graded' ? sub.total : null,
        status: sub ? (sub.status as MockEssayLine['status']) : 'not_submitted',
      }];
    });
  }

  const board = await buildLeaderboard(test, user, essayTotals);
  const myEssay = essayTotals.get(user.id) ?? 0;
  const me = results?.me ?? null;
  const myRank = board.byUser.get(user.id);
  const mcq = me && attempt ? mcqSummary(attempt, test.totalMarks) : null;

  return {
    phase: 'official',
    title: test.title,
    examCode: test.examCode,
    mcq,
    essays,
    essayTotal: series ? myEssay : null,
    essayMax,
    combined: me ? Math.round((me.totalScore + myEssay) * 100) / 100 : null,
    maxTotal: (mcq?.maxScore ?? test.totalMarks) + essayMax,
    me: me && myRank ? { rank: myRank.rank, percentile: myRank.percentile, outOf: board.outOf, online: myRank.online } : null,
    omrStatus: attempt?.omrStatus ?? null,
    hasOmrImage: !!attempt?.omrImageKey,
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
    reviewHref: `/tests/${test.bucket.replace('_', '-')}/${test.slug}/results`,
  };
}

/** Everyone's combined (MCQ + essay) rank for a mock: used for the "your final rank is out" emails. */
export async function getMockRanking(test: Test) {
  const essayTotals = test.essaySeriesId ? await essayTotalsByUser(test.essaySeriesId) : new Map<number, number>();
  const board = await buildLeaderboard(test, null, essayTotals);
  const essays = test.essaySeriesId
    ? parseEssays((await db.select().from(essaySeries).where(eq(essaySeries.id, test.essaySeriesId)).get())!)
    : [];
  return { byUser: board.byUser, outOf: board.outOf, maxTotal: test.totalMarks + essays.reduce((s, e) => s + e.max, 0) };
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
      // expected sitters: active Mock Access holders, narrowed per mock by batch below
      db.select({ userId: userAccess.userId, batch: users.batch })
        .from(userAccess).innerJoin(users, eq(users.id, userAccess.userId))
        .where(and(eq(userAccess.product, 'mock'), eq(userAccess.active, true), eq(users.role, 'student'))),
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
