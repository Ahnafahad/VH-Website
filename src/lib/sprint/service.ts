/**
 * Server-side data service for Sprint. Never leaks another student's identity
 * beyond what the leaderboard already shows (name only).
 */

import { db } from '@/lib/db';
import {
  sprintSets, sprintQuestions, sprintAttempts, sprintAnswers, users,
  type SprintSet, type SprintAttempt, type LmsSubject,
} from '@/lib/db/schema';
import { and, eq, inArray, desc, asc, sql } from 'drizzle-orm';
import { ApiException } from '@/lib/api-utils';
import type {
  SprintOption, SprintSetListEntry, SprintTakingQuestion,
  SprintSubmitAnswer, SprintAttemptResult, SprintLeaderboardRow,
} from './types';

// ─── Lookups ──────────────────────────────────────────────────────────────────

export async function getActiveSet(setId: number): Promise<SprintSet | null> {
  const set = await db.select().from(sprintSets).where(eq(sprintSets.id, setId)).get();
  return set && set.status === 'active' ? set : null;
}

export async function getSet(setId: number): Promise<SprintSet | null> {
  return (await db.select().from(sprintSets).where(eq(sprintSets.id, setId)).get()) ?? null;
}

export async function getUserAttempt(setId: number, userId: number): Promise<SprintAttempt | null> {
  return (await db.select().from(sprintAttempts)
    .where(and(eq(sprintAttempts.setId, setId), eq(sprintAttempts.userId, userId))).get()) ?? null;
}

// ─── Listing (for a student) ───────────────────────────────────────────────────

export async function listActiveSetsForUser(userId: number): Promise<SprintSetListEntry[]> {
  const sets = await db.select().from(sprintSets).where(eq(sprintSets.status, 'active'));
  if (sets.length === 0) return [];

  const setIds = sets.map(s => s.id);
  const [questionCounts, myAttempts] = await Promise.all([
    db.select({ setId: sprintQuestions.setId, count: sql<number>`count(*)` })
      .from(sprintQuestions).where(inArray(sprintQuestions.setId, setIds)).groupBy(sprintQuestions.setId),
    db.select().from(sprintAttempts)
      .where(and(inArray(sprintAttempts.setId, setIds), eq(sprintAttempts.userId, userId))),
  ]);
  const countBySet = new Map(questionCounts.map(c => [c.setId, c.count]));
  const attemptBySet = new Map(myAttempts.map(a => [a.setId, a]));

  return sets
    .sort((a, b) => a.subject.localeCompare(b.subject) || a.title.localeCompare(b.title))
    .map(s => {
      const attempt = attemptBySet.get(s.id) ?? null;
      return {
        id: s.id,
        subject: s.subject as LmsSubject,
        title: s.title,
        questionCount: countBySet.get(s.id) ?? 0,
        attempt: attempt && {
          totalCorrect: attempt.totalCorrect,
          totalQuestions: attempt.totalQuestions,
          totalTimeMs: attempt.totalTimeMs,
        },
      };
    });
}

// ─── Taking a set ───────────────────────────────────────────────────────────────

export async function getSetQuestionsForTaking(setId: number): Promise<SprintTakingQuestion[]> {
  const rows = await db.select().from(sprintQuestions).where(eq(sprintQuestions.setId, setId));
  return rows
    .sort((a, b) => a.number - b.number)
    .map(q => ({
      id: q.id,
      number: q.number,
      stem: q.stem,
      options: JSON.parse(q.options) as SprintOption[],
      correctKey: q.correctKey,
      explanation: q.explanation,
    }));
}

export async function submitAttempt(
  set: SprintSet, userId: number, answers: SprintSubmitAnswer[],
): Promise<SprintAttemptResult> {
  const questions = await db.select().from(sprintQuestions).where(eq(sprintQuestions.setId, set.id));
  if (questions.length === 0) throw new ApiException('This set has no questions', 409, 'NO_QUESTIONS');

  const answerByQuestion = new Map(answers.map(a => [a.questionId, a]));

  let totalCorrect = 0;
  let totalTimeMs = 0;
  const answerRows = questions.map(q => {
    const a = answerByQuestion.get(q.id);
    const selectedKey = a?.selectedKey ?? null;
    const isCorrect = selectedKey !== null && selectedKey === q.correctKey;
    if (isCorrect) totalCorrect++;
    const timeSpentMs = Math.max(0, a?.timeSpentMs ?? 0);
    totalTimeMs += timeSpentMs;
    return { questionId: q.id, selectedKey, isCorrect, timeSpentMs };
  });

  try {
    const [attempt] = await db.insert(sprintAttempts).values({
      setId: set.id, userId,
      totalCorrect, totalQuestions: questions.length, totalTimeMs,
    }).returning();
    await db.insert(sprintAnswers).values(answerRows.map(a => ({ ...a, attemptId: attempt.id })));
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (/UNIQUE constraint failed/i.test(msg)) {
      throw new ApiException('You have already submitted this set', 409, 'ALREADY_SUBMITTED');
    }
    throw error;
  }

  return { totalCorrect, totalQuestions: questions.length, totalTimeMs };
}

// ─── Leaderboard (per set, top 5 + viewer's own row) ───────────────────────────

export async function getLeaderboard(setId: number, userId: number): Promise<SprintLeaderboardRow[]> {
  const rows = await db.select({
    userId: sprintAttempts.userId, name: users.name,
    totalCorrect: sprintAttempts.totalCorrect, totalQuestions: sprintAttempts.totalQuestions,
    totalTimeMs: sprintAttempts.totalTimeMs,
  }).from(sprintAttempts)
    .innerJoin(users, eq(users.id, sprintAttempts.userId))
    .where(eq(sprintAttempts.setId, setId))
    .orderBy(desc(sprintAttempts.totalCorrect), asc(sprintAttempts.totalTimeMs));

  const ranked: SprintLeaderboardRow[] = rows.map((r, i) => ({
    rank: i + 1,
    userId: r.userId,
    name: r.name,
    totalCorrect: r.totalCorrect,
    totalQuestions: r.totalQuestions,
    totalTimeMs: r.totalTimeMs,
    isMe: r.userId === userId,
  }));

  const top5 = ranked.slice(0, 5);
  const mine = ranked.find(r => r.isMe);
  if (mine && !top5.some(r => r.isMe)) top5.push(mine);
  return top5;
}

// ─── Admin ──────────────────────────────────────────────────────────────────────

export interface SprintSetAdminEntry {
  id: number;
  subject: LmsSubject;
  title: string;
  status: string;
  questionCount: number;
  attemptCount: number;
}

export async function listAllSetsForAdmin(): Promise<SprintSetAdminEntry[]> {
  const sets = await db.select().from(sprintSets);
  if (sets.length === 0) return [];
  const setIds = sets.map(s => s.id);

  const [questionCounts, attemptCounts] = await Promise.all([
    db.select({ setId: sprintQuestions.setId, count: sql<number>`count(*)` })
      .from(sprintQuestions).where(inArray(sprintQuestions.setId, setIds)).groupBy(sprintQuestions.setId),
    db.select({ setId: sprintAttempts.setId, count: sql<number>`count(*)` })
      .from(sprintAttempts).where(inArray(sprintAttempts.setId, setIds)).groupBy(sprintAttempts.setId),
  ]);
  const qCountBySet = new Map(questionCounts.map(c => [c.setId, c.count]));
  const aCountBySet = new Map(attemptCounts.map(c => [c.setId, c.count]));

  return sets
    .sort((a, b) => a.subject.localeCompare(b.subject) || a.title.localeCompare(b.title))
    .map(s => ({
      id: s.id,
      subject: s.subject as LmsSubject,
      title: s.title,
      status: s.status,
      questionCount: qCountBySet.get(s.id) ?? 0,
      attemptCount: aCountBySet.get(s.id) ?? 0,
    }));
}

export async function setSetStatus(id: number, status: 'draft' | 'active'): Promise<void> {
  await db.update(sprintSets).set({ status }).where(eq(sprintSets.id, id));
}

export async function deleteSet(id: number): Promise<void> {
  const attempt = await db.select({ id: sprintAttempts.id }).from(sprintAttempts)
    .where(eq(sprintAttempts.setId, id)).get();
  if (attempt) {
    throw new ApiException('This set has student attempts and cannot be deleted', 409, 'HAS_ATTEMPTS');
  }
  await db.delete(sprintSets).where(eq(sprintSets.id, id));
}
