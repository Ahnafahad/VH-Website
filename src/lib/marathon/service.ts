/**
 * Server-side data service for the Math Marathon module.
 * Used by API routes and server components. Never leaks correctKey/solution
 * to a taker before submit.
 */

import { db } from '@/lib/db';
import {
  marathonChapters, marathonDays, marathonQuestions, marathonAssignments,
  marathonAttempts, marathonAnswers, marathonPauseEvents,
  type UserWithProducts, type MarathonChapter, type MarathonDay,
  type MarathonAssignment, type MarathonAttempt,
  type TestOption,
} from '@/lib/db/schema';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { ApiException } from '@/lib/api-utils';
import { assignmentMatchesUser, isMarathonStaff } from './access';
import { isUltimateTesterEmail } from '@/lib/auth/roles';
import { earliestStartDate, effectiveDayState } from './unlock';
import { scoreMarathonAttempt } from './scoring';
import { isSlow, median } from './time-flags';
import type {
  MarathonChapterListEntry, MarathonAttemptPayload, MarathonResultsPayload,
  MarathonQuestionResult, SubtopicStat,
} from './types';

const MAX_PAUSES = 2;

// ─── Lookups ──────────────────────────────────────────────────────────────────

export async function getChapterBySlug(slug: string): Promise<MarathonChapter | null> {
  return (await db.select().from(marathonChapters).where(eq(marathonChapters.slug, slug)).get()) ?? null;
}

export async function getAssignmentsForChapter(chapterId: number): Promise<MarathonAssignment[]> {
  return db.select().from(marathonAssignments).where(eq(marathonAssignments.chapterId, chapterId));
}

export async function getDayByNumber(chapterId: number, dayNumber: number): Promise<MarathonDay | null> {
  return (await db.select().from(marathonDays)
    .where(and(eq(marathonDays.chapterId, chapterId), eq(marathonDays.dayNumber, dayNumber))).get()) ?? null;
}

export async function getUserAttempt(dayId: number, userId: number): Promise<MarathonAttempt | null> {
  return (await db.select().from(marathonAttempts)
    .where(and(eq(marathonAttempts.dayId, dayId), eq(marathonAttempts.userId, userId))).get()) ?? null;
}

// ─── Overview (chapter + day list for a student) ──────────────────────────────

export async function getMarathonOverviewForUser(user: UserWithProducts): Promise<MarathonChapterListEntry[]> {
  const bypass = isMarathonStaff(user) || isUltimateTesterEmail(user.email);
  const chapters = bypass
    ? await db.select().from(marathonChapters)
    : await db.select().from(marathonChapters).where(eq(marathonChapters.status, 'published'));
  if (chapters.length === 0) return [];

  const chapterIds = chapters.map(c => c.id);
  const [allAssignments, allDays] = await Promise.all([
    db.select().from(marathonAssignments).where(inArray(marathonAssignments.chapterId, chapterIds)),
    db.select().from(marathonDays).where(inArray(marathonDays.chapterId, chapterIds)),
  ]);

  const dayIds = allDays.map(d => d.id);
  const myAttempts = dayIds.length
    ? await db.select().from(marathonAttempts)
        .where(and(inArray(marathonAttempts.dayId, dayIds), eq(marathonAttempts.userId, user.id)))
    : [];
  const attemptByDay = new Map(myAttempts.map(a => [a.dayId, a]));

  const now = new Date();
  const result: MarathonChapterListEntry[] = [];
  for (const chapter of chapters) {
    const mine = allAssignments.filter(a => a.chapterId === chapter.id && assignmentMatchesUser(a, user));
    if (mine.length === 0 && !bypass) continue; // not assigned to this student at all
    const startDate = mine.length > 0 ? earliestStartDate(mine.map(a => a.startDate))! : now;

    const days = allDays
      .filter(d => d.chapterId === chapter.id)
      .sort((a, b) => a.dayNumber - b.dayNumber)
      .map(d => {
        const attempt = attemptByDay.get(d.id) ?? null;
        return {
          id: d.id,
          dayNumber: d.dayNumber,
          totalQuestions: d.totalQuestions,
          state: bypass ? 'unlocked' as const : effectiveDayState(startDate, d.dayNumber, now),
          unlocksAt: startDate.getTime() + (d.dayNumber - 1) * 86_400_000,
          attempt: attempt && {
            id: attempt.id,
            status: attempt.status as 'in_progress' | 'submitted',
            correct: attempt.totalCorrect,
            submittedAt: attempt.submittedAt?.getTime() ?? null,
          },
        };
      });

    result.push({
      id: chapter.id,
      slug: chapter.slug,
      title: chapter.title,
      totalDays: chapter.totalDays,
      questionsPerDay: chapter.questionsPerDay,
      days,
    });
  }
  return result;
}

// ─── Taking a day ─────────────────────────────────────────────────────────────

export interface TakingQuestion {
  id: number; number: number; stem: string; options: TestOption[]; imageUrl: string | null;
}

export async function getDayQuestionsForTaking(dayId: number): Promise<TakingQuestion[]> {
  const rows = await db.select().from(marathonQuestions).where(eq(marathonQuestions.dayId, dayId));
  return rows
    .sort((a, b) => a.number - b.number)
    .map(q => ({
      id: q.id,
      number: q.number,
      stem: q.stem,
      options: JSON.parse(q.options) as TestOption[],
      imageUrl: q.imageUrl,
    }));
}

export async function startOrResumeAttempt(dayId: number, userId: number): Promise<{ attempt: MarathonAttempt; resumed: boolean }> {
  const existing = await getUserAttempt(dayId, userId);
  if (existing) {
    if (existing.status === 'submitted') {
      throw new ApiException('You have already submitted this day', 409, 'ALREADY_SUBMITTED');
    }
    return { attempt: existing, resumed: true };
  }
  const [created] = await db.insert(marathonAttempts).values({
    dayId, userId, status: 'in_progress', startedAt: new Date(),
  }).returning();
  return { attempt: created, resumed: false };
}

export async function buildAttemptPayload(
  chapter: MarathonChapter, day: MarathonDay, attempt: MarathonAttempt,
): Promise<MarathonAttemptPayload> {
  const [questions, answerRows] = await Promise.all([
    getDayQuestionsForTaking(day.id),
    db.select().from(marathonAnswers).where(eq(marathonAnswers.attemptId, attempt.id)),
  ]);
  return {
    chapter: { slug: chapter.slug, title: chapter.title },
    day: { id: day.id, dayNumber: day.dayNumber, totalQuestions: day.totalQuestions },
    attempt: {
      id: attempt.id,
      startedAt: attempt.startedAt.getTime(),
      pauseCount: attempt.pauseCount,
      pausedAt: attempt.pausedAt?.getTime() ?? null,
      totalPausedMs: attempt.totalPausedMs,
    },
    questions,
    answers: answerRows.map(a => ({
      questionId: a.questionId, selectedKey: a.selectedKey, visited: a.visited, timeSpentMs: a.timeSpentMs,
    })),
  };
}

// ─── In-flight mutations ──────────────────────────────────────────────────────

export async function requireInProgressAttempt(dayId: number, userId: number): Promise<MarathonAttempt> {
  const attempt = await getUserAttempt(dayId, userId);
  if (!attempt || attempt.status !== 'in_progress') {
    throw new ApiException('No in-progress attempt', 409, 'NO_ATTEMPT');
  }
  return attempt;
}

export async function upsertAnswer(attemptId: number, questionId: number, selectedKey: string | null): Promise<void> {
  const existing = await db.select().from(marathonAnswers)
    .where(and(eq(marathonAnswers.attemptId, attemptId), eq(marathonAnswers.questionId, questionId))).get();
  if (existing) {
    await db.update(marathonAnswers).set({ selectedKey }).where(eq(marathonAnswers.id, existing.id));
  } else {
    await db.insert(marathonAnswers).values({ attemptId, questionId, selectedKey, visited: true, visitCount: 1, firstVisitedAt: new Date(), lastVisitedAt: new Date() });
  }
}

/** Accumulates live stopwatch time onto one question. deltaMs comes from the client heartbeat. */
export async function addQuestionTime(attemptId: number, questionId: number, deltaMs: number): Promise<void> {
  if (deltaMs <= 0) return;
  const now = new Date();
  const existing = await db.select().from(marathonAnswers)
    .where(and(eq(marathonAnswers.attemptId, attemptId), eq(marathonAnswers.questionId, questionId))).get();
  if (existing) {
    await db.update(marathonAnswers).set({
      timeSpentMs: sql`${marathonAnswers.timeSpentMs} + ${deltaMs}`,
      visitCount: sql`${marathonAnswers.visitCount} + 1`,
      visited: true,
      lastVisitedAt: now,
    }).where(eq(marathonAnswers.id, existing.id));
  } else {
    await db.insert(marathonAnswers).values({
      attemptId, questionId, selectedKey: null, visited: true,
      timeSpentMs: deltaMs, visitCount: 1, firstVisitedAt: now, lastVisitedAt: now,
    });
  }
}

export async function pauseAttempt(attempt: MarathonAttempt): Promise<{ pausedAt: Date; pauseCount: number }> {
  if (attempt.pausedAt) return { pausedAt: attempt.pausedAt, pauseCount: attempt.pauseCount }; // already paused, idempotent
  if (attempt.pauseCount >= MAX_PAUSES) {
    throw new ApiException(`You've used both of your pauses for this day`, 409, 'NO_PAUSES_LEFT');
  }
  const now = new Date();
  const pauseCount = attempt.pauseCount + 1;
  await db.insert(marathonPauseEvents).values({ attemptId: attempt.id, pausedAt: now });
  await db.update(marathonAttempts)
    .set({ pausedAt: now, pauseCount })
    .where(eq(marathonAttempts.id, attempt.id));
  return { pausedAt: now, pauseCount };
}

export async function resumeAttempt(attempt: MarathonAttempt): Promise<void> {
  if (!attempt.pausedAt) return; // not paused, idempotent
  const now = new Date();
  const pausedMs = now.getTime() - attempt.pausedAt.getTime();
  const openEvent = await db.select().from(marathonPauseEvents)
    .where(and(eq(marathonPauseEvents.attemptId, attempt.id), sql`${marathonPauseEvents.resumedAt} IS NULL`))
    .orderBy(sql`${marathonPauseEvents.pausedAt} DESC`).get();
  if (openEvent) {
    await db.update(marathonPauseEvents).set({ resumedAt: now }).where(eq(marathonPauseEvents.id, openEvent.id));
  }
  await db.update(marathonAttempts)
    .set({ pausedAt: null, totalPausedMs: attempt.totalPausedMs + Math.max(0, pausedMs) })
    .where(eq(marathonAttempts.id, attempt.id));
}

export async function submitAttempt(attempt: MarathonAttempt, day: MarathonDay): Promise<{ totalCorrect: number; totalWrong: number; totalSkipped: number }> {
  // Auto-resume if still paused so the pause doesn't leak into active time.
  let totalPausedMs = attempt.totalPausedMs;
  const now = new Date();
  if (attempt.pausedAt) {
    totalPausedMs += Math.max(0, now.getTime() - attempt.pausedAt.getTime());
  }

  const [questions, answerRows] = await Promise.all([
    db.select({ id: marathonQuestions.id, correctKey: marathonQuestions.correctKey })
      .from(marathonQuestions).where(eq(marathonQuestions.dayId, day.id)),
    db.select().from(marathonAnswers).where(eq(marathonAnswers.attemptId, attempt.id)),
  ]);
  const answerMap = new Map<number, string | null>(answerRows.map(a => [a.questionId, a.selectedKey]));
  const score = scoreMarathonAttempt(questions, answerMap);

  const totalActiveMs = Math.max(0, now.getTime() - attempt.startedAt.getTime() - totalPausedMs);

  await db.update(marathonAttempts).set({
    status: 'submitted',
    submittedAt: now,
    pausedAt: null,
    totalPausedMs,
    totalActiveMs,
    totalCorrect: score.totalCorrect,
    totalWrong: score.totalWrong,
    totalSkipped: score.totalSkipped,
  }).where(eq(marathonAttempts.id, attempt.id));

  return { totalCorrect: score.totalCorrect, totalWrong: score.totalWrong, totalSkipped: score.totalSkipped };
}

// ─── Results (own day, after submit) ──────────────────────────────────────────

export async function getDayResults(
  chapter: MarathonChapter, day: MarathonDay, userId: number,
): Promise<MarathonResultsPayload | null> {
  const myAttempt = await getUserAttempt(day.id, userId);
  if (!myAttempt || myAttempt.status !== 'submitted') return null;

  const [questions, submittedAttempts] = await Promise.all([
    db.select().from(marathonQuestions).where(eq(marathonQuestions.dayId, day.id)),
    db.select().from(marathonAttempts).where(and(eq(marathonAttempts.dayId, day.id), eq(marathonAttempts.status, 'submitted'))),
  ]);
  const attemptIds = submittedAttempts.map(a => a.id);
  const allAnswers = attemptIds.length
    ? await db.select().from(marathonAnswers).where(inArray(marathonAnswers.attemptId, attemptIds))
    : [];
  const myAnswers = allAnswers.filter(a => a.attemptId === myAttempt.id);
  const myAnswerByQuestion = new Map(myAnswers.map(a => [a.questionId, a]));

  const questionResults: MarathonQuestionResult[] = questions
    .sort((a, b) => a.number - b.number)
    .map(q => {
      const answersForQ = allAnswers.filter(a => a.questionId === q.id);
      let correctCount = 0, wrongCount = 0, skippedCount = 0;
      const otherTimes: number[] = [];
      for (const a of answersForQ) {
        if (!a.selectedKey) skippedCount++;
        else if (a.selectedKey === q.correctKey) correctCount++;
        else wrongCount++;
        if (a.attemptId !== myAttempt.id && a.timeSpentMs > 0) otherTimes.push(a.timeSpentMs);
      }
      const mine = myAnswerByQuestion.get(q.id);
      const myTime = mine?.timeSpentMs ?? 0;
      return {
        id: q.id,
        number: q.number,
        stem: q.stem,
        options: JSON.parse(q.options) as TestOption[],
        imageUrl: q.imageUrl,
        correctKey: q.correctKey,
        solution: q.solution,
        primaryTag: q.primaryTagCode ? { code: q.primaryTagCode, label: q.primaryTagLabel ?? q.primaryTagCode } : null,
        secondaryTag: q.secondaryTagCode ? { code: q.secondaryTagCode, label: q.secondaryTagLabel ?? q.secondaryTagCode } : null,
        selectedKey: mine?.selectedKey ?? null,
        isCorrect: mine?.selectedKey ? mine.selectedKey === q.correctKey : null,
        timeSpentMs: myTime,
        isSlow: isSlow(myTime, otherTimes),
        classStats: { correctCount, wrongCount, skippedCount, medianTimeMs: median(otherTimes) },
      };
    });

  const otherTotalTimes = submittedAttempts
    .filter(a => a.id !== myAttempt.id && a.totalActiveMs != null)
    .map(a => a.totalActiveMs!);

  const subtopicWeakness = await getSubtopicWeakness(chapter.id, userId);

  return {
    chapter: { slug: chapter.slug, title: chapter.title },
    day: { dayNumber: day.dayNumber, totalQuestions: day.totalQuestions },
    attempt: {
      id: myAttempt.id,
      totalCorrect: myAttempt.totalCorrect ?? 0,
      totalWrong: myAttempt.totalWrong ?? 0,
      totalSkipped: myAttempt.totalSkipped ?? 0,
      totalActiveMs: myAttempt.totalActiveMs ?? 0,
      isOverallSlow: isSlow(myAttempt.totalActiveMs ?? 0, otherTotalTimes),
      submittedAt: myAttempt.submittedAt!.getTime(),
    },
    questions: questionResults,
    subtopicWeakness,
  };
}

/** Per-subtopic accuracy across every submitted day the student has done in this chapter. */
export async function getSubtopicWeakness(chapterId: number, userId: number): Promise<SubtopicStat[]> {
  const days = await db.select({ id: marathonDays.id }).from(marathonDays).where(eq(marathonDays.chapterId, chapterId));
  const dayIds = days.map(d => d.id);
  if (dayIds.length === 0) return [];

  const [myAttempts, questions] = await Promise.all([
    db.select().from(marathonAttempts)
      .where(and(inArray(marathonAttempts.dayId, dayIds), eq(marathonAttempts.userId, userId), eq(marathonAttempts.status, 'submitted'))),
    db.select().from(marathonQuestions).where(inArray(marathonQuestions.dayId, dayIds)),
  ]);
  const attemptIds = myAttempts.map(a => a.id);
  if (attemptIds.length === 0) return [];

  const myAnswers = await db.select().from(marathonAnswers).where(inArray(marathonAnswers.attemptId, attemptIds));
  const questionById = new Map(questions.map(q => [q.id, q]));

  const stats = new Map<string, { label: string; correct: number; total: number }>();
  const bump = (code: string | null, label: string | null, correct: boolean) => {
    if (!code) return;
    const entry = stats.get(code) ?? { label: label ?? code, correct: 0, total: 0 };
    entry.total++;
    if (correct) entry.correct++;
    stats.set(code, entry);
  };

  for (const a of myAnswers) {
    if (!a.selectedKey) continue; // skipped questions don't count toward accuracy
    const q = questionById.get(a.questionId);
    if (!q) continue;
    const correct = a.selectedKey === q.correctKey;
    bump(q.primaryTagCode, q.primaryTagLabel, correct);
    bump(q.secondaryTagCode, q.secondaryTagLabel, correct);
  }

  return [...stats.entries()]
    .map(([code, s]) => ({ code, label: s.label, correct: s.correct, total: s.total, accuracy: Math.round((s.correct / s.total) * 100) }))
    .sort((a, b) => a.accuracy - b.accuracy);
}

// ─── Admin: chapters & assignments ────────────────────────────────────────────

export async function listAllChapters(): Promise<MarathonChapter[]> {
  return db.select().from(marathonChapters);
}

export async function setChapterStatus(chapterId: number, status: 'draft' | 'published'): Promise<void> {
  await db.update(marathonChapters).set({ status }).where(eq(marathonChapters.id, chapterId));
}

export async function createAssignment(input: {
  chapterId: number; product: string; batch: string | null; startDate: Date; assignedBy: number;
}): Promise<MarathonAssignment> {
  const [row] = await db.insert(marathonAssignments).values(input).returning();
  return row;
}

export async function listAssignmentsWithChapter() {
  const rows = await db.select({
    assignment: marathonAssignments,
    chapter: marathonChapters,
  }).from(marathonAssignments).innerJoin(marathonChapters, eq(marathonAssignments.chapterId, marathonChapters.id));
  return rows;
}
