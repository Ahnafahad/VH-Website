/**
 * LexiCore breakdown for one student — extracted so both the admin progress
 * page (progress.ts) and the student-facing metrics mirror (student-metrics.ts)
 * call the same function instead of forking the query.
 */

import { db } from '@/lib/db';
import {
  vocabUserProgress, vocabQuizAnswers, vocabQuizSessions, vocabUserWordRecords,
} from '@/lib/db/schema';
import { and, eq, count } from 'drizzle-orm';
import type { LexicoreBreakdown } from './progress-types';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function getLexicoreBreakdown(userId: number): Promise<LexicoreBreakdown> {
  const progress = await db.select().from(vocabUserProgress)
    .where(eq(vocabUserProgress.userId, userId)).get();

  const quizAnswers = await db.select().from(vocabQuizAnswers)
    .where(eq(vocabQuizAnswers.userId, userId));
  const quizPoints = quizAnswers.reduce((sum, a) => sum + a.pointsEarned, 0);
  const quizCorrect = quizAnswers.filter(a => a.isCorrect).length;
  const quizAccuracy = quizAnswers.length > 0
    ? round2((quizCorrect / quizAnswers.length) * 100)
    : null;

  const [quizSessionsRow] = await db.select({ total: count() }).from(vocabQuizSessions)
    .where(and(eq(vocabQuizSessions.userId, userId), eq(vocabQuizSessions.status, 'complete')));
  const quizzesCompleted = quizSessionsRow?.total ?? 0;

  const [wordsMasteredRow] = await db.select({ total: count() }).from(vocabUserWordRecords)
    .where(and(eq(vocabUserWordRecords.userId, userId), eq(vocabUserWordRecords.masteryLevel, 'mastered')));
  const wordsMastered = wordsMasteredRow?.total ?? 0;

  const [wordsSeenRow] = await db.select({ total: count() }).from(vocabUserWordRecords)
    .where(eq(vocabUserWordRecords.userId, userId));
  const wordsSeen = wordsSeenRow?.total ?? 0;

  const totalPoints = progress?.totalPoints ?? 0;
  const wordPoints = Math.max(0, totalPoints - quizPoints);

  return {
    totalPoints,
    quizPoints,
    wordPoints,
    quizzesCompleted,
    quizAccuracy,
    wordsMastered,
    wordsSeen,
    streakDays: progress?.streakDays ?? 0,
    longestStreak: progress?.longestStreak ?? 0,
    weeklyPoints: progress?.weeklyPoints ?? 0,
    hasProgress: !!progress,
  };
}
