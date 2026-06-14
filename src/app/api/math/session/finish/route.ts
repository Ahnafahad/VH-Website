/**
 * POST /api/math/session/finish
 *
 * Body: { sessionId }
 * Returns: { session, progress, legacyScoreId }
 *
 * Finalizes the session, upserts progress, dual-writes a row to legacy mathScores
 * so /api/mental-math/leaderboard keeps returning entries.
 */

import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import {
  db, users, mathSessions, mathScores, mathUserProgress,
} from '@/lib/db';
import { safeApiHandler, validateAuth, ApiException } from '@/lib/api-utils';
import { isAdminEmail } from '@/lib/db-access-control';
import { bucketDifficulty } from '@/lib/math/constants';

interface FinishBody { sessionId: number }

export async function POST(request: NextRequest): Promise<Response> {
  return safeApiHandler(async () => {
    const { email, name } = await validateAuth();
    const body = (await request.json()) as FinishBody;

    if (typeof body.sessionId !== 'number') throw new ApiException('sessionId required', 400);

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    if (!user) throw new ApiException('User not found', 404);

    const [session] = await db
      .select()
      .from(mathSessions)
      .where(eq(mathSessions.id, body.sessionId))
      .limit(1);
    if (!session || session.userId !== user.id) throw new ApiException('Session not found', 404);

    if (session.status === 'complete') {
      return { session, alreadyFinal: true };
    }

    const finishedAt = new Date();
    const operations: string[] = JSON.parse(session.operations);
    const skill = session.endingSkill
      ? JSON.parse(session.endingSkill)
      : { addition: 2.5, subtraction: 2.5, multiplication: 2.5, division: 2.5 };

    const accuracy = session.questionsAnswered > 0
      ? Math.round((session.questionsCorrect / session.questionsAnswered) * 100)
      : 0;

    // Finalize session
    await db.update(mathSessions)
      .set({ status: 'complete', finishedAt, endingSkill: JSON.stringify(skill) })
      .where(eq(mathSessions.id, session.id));

    // Upsert progress
    const [existingProgress] = await db
      .select()
      .from(mathUserProgress)
      .where(eq(mathUserProgress.userId, user.id))
      .limit(1);

    if (existingProgress) {
      const newTotalQuestions = existingProgress.totalQuestions + session.questionsAnswered;
      const newTotalCorrect   = existingProgress.totalCorrect   + session.questionsCorrect;
      const newAccuracy       = newTotalQuestions > 0 ? newTotalCorrect / newTotalQuestions : 0;
      await db.update(mathUserProgress)
        .set({
          totalGames:          existingProgress.totalGames + 1,
          totalQuestions:      newTotalQuestions,
          totalCorrect:        newTotalCorrect,
          overallAccuracy:     newAccuracy,
          bestScore:           Math.max(existingProgress.bestScore, session.totalScore),
          skillAddition:       skill.addition,
          skillSubtraction:    skill.subtraction,
          skillMultiplication: skill.multiplication,
          skillDivision:       skill.division,
          preferredDifficulty: session.startDifficulty,
          updatedAt:           new Date(),
        })
        .where(eq(mathUserProgress.userId, user.id));
    } else {
      await db.insert(mathUserProgress).values({
        userId:              user.id,
        totalGames:          1,
        totalQuestions:      session.questionsAnswered,
        totalCorrect:        session.questionsCorrect,
        overallAccuracy:     session.questionsAnswered > 0 ? session.questionsCorrect / session.questionsAnswered : 0,
        bestScore:           session.totalScore,
        skillAddition:       skill.addition,
        skillSubtraction:    skill.subtraction,
        skillMultiplication: skill.multiplication,
        skillDivision:       skill.division,
        preferredDifficulty: session.startDifficulty,
      });
    }

    // Dual-write legacy mathScores for leaderboard back-compat
    const legacyDifficulty = bucketDifficulty(session.startDifficulty);
    const isAdmin = await isAdminEmail(email);

    let legacyScoreId: number | null = null;
    if (session.questionsAnswered > 0) {
      const [legacy] = await db.insert(mathScores).values({
        playerEmail:       email,
        playerName:        name || 'Anonymous',
        score:             session.totalScore,
        questionsCorrect:  session.questionsCorrect,
        questionsAnswered: session.questionsAnswered,
        accuracy,
        difficulty:        legacyDifficulty,
        operations:        session.operations,
        timeLimit:         session.timeLimit,
        isAdmin,
        playedAt:          finishedAt,
      }).returning({ id: mathScores.id });
      legacyScoreId = legacy.id;
    }

    return {
      session: {
        id: session.id,
        totalScore: session.totalScore,
        questionsAnswered: session.questionsAnswered,
        questionsCorrect:  session.questionsCorrect,
        accuracy,
        endingSkill: skill,
      },
      legacyScoreId,
    };
  });
}
