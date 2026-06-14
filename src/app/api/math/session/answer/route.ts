/**
 * POST /api/math/session/answer
 *
 * Body: {
 *   sessionId, operation, difficulty, num1, num2, correctAnswer,
 *   userAnswer (null when skipped/timeout), wasSkipped, wasSuspicious, responseTimeMs, pointsEarned,
 *   selectedOps, timePenaltySeconds
 * }
 * Returns: { isCorrect, nextQuestion, allocatedSeconds, skill, levelUpCrossings }
 */

import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import {
  db, users, mathSessions, mathQuestionAttempts,
  type MathOperation,
} from '@/lib/db';
import { safeApiHandler, validateAuth, ApiException } from '@/lib/api-utils';
import { applyAttempt, skillLevelCrossings } from '@/lib/math/adaptive/engine';
import { buildAdaptiveState, nextResolved } from '@/lib/math/session-helpers';
import type { AttemptSignal } from '@/lib/math/adaptive/state';

interface AnswerBody {
  sessionId:          number;
  operation:          MathOperation;
  difficulty:         number;
  num1:               number;
  num2:               number;
  correctAnswer:      number;
  userAnswer:         number | null;
  wasSkipped:         boolean;
  wasSuspicious:      boolean;
  responseTimeMs:     number;
  pointsEarned:       number;
  selectedOps:        MathOperation[];
  timePenaltySeconds: number;
  allocatedMs:        number;
}

export async function POST(request: NextRequest): Promise<Response> {
  return safeApiHandler(async () => {
    const { email } = await validateAuth();
    const b = (await request.json()) as AnswerBody;

    if (typeof b.sessionId !== 'number') throw new ApiException('sessionId required', 400);

    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    if (!user) throw new ApiException('User not found', 404);

    const [session] = await db
      .select()
      .from(mathSessions)
      .where(eq(mathSessions.id, b.sessionId))
      .limit(1);
    if (!session || session.userId !== user.id) throw new ApiException('Session not found', 404);
    if (session.status !== 'in_progress') throw new ApiException('Session already finalized', 409);

    const isCorrect = !b.wasSkipped && b.userAnswer === b.correctAnswer;

    // Persist attempt
    await db.insert(mathQuestionAttempts).values({
      sessionId:      session.id,
      userId:         user.id,
      operation:      b.operation,
      difficulty:     b.difficulty,
      num1:           b.num1,
      num2:           b.num2,
      correctAnswer:  b.correctAnswer,
      userAnswer:     b.userAnswer,
      isCorrect,
      wasSkipped:     b.wasSkipped,
      responseTimeMs: Math.max(0, Math.round(b.responseTimeMs)),
      wasSuspicious:  b.wasSuspicious,
      pointsEarned:   Math.round(b.pointsEarned),
    });

    // Rebuild adaptive state from session's endingSkill, apply update
    const prevSkill = session.endingSkill ? JSON.parse(session.endingSkill) : undefined;
    const prevState = buildAdaptiveState(prevSkill ? {
      skillAddition:       prevSkill.addition       ?? 2.5,
      skillSubtraction:    prevSkill.subtraction    ?? 2.5,
      skillMultiplication: prevSkill.multiplication ?? 2.5,
      skillDivision:       prevSkill.division       ?? 2.5,
    } : null);

    const signal: AttemptSignal = {
      operation:      b.operation,
      difficulty:     b.difficulty,
      isCorrect,
      wasSkipped:     b.wasSkipped,
      wasSuspicious:  b.wasSuspicious,
      responseTimeMs: b.responseTimeMs,
    };
    const nextState = applyAttempt(prevState, signal, { expectedTimeMs: b.allocatedMs });
    const crossings = skillLevelCrossings(prevState, nextState);

    // Pick next question from updated state
    const resolved = nextResolved({
      adaptive:      session.adaptive,
      selectedOps:   b.selectedOps,
      state:         nextState,
      difficulty:    session.startDifficulty,
      prevQuestions: [],
      timePenalty:   b.timePenaltySeconds,
    });

    // Running totals + ending skill
    await db.update(mathSessions)
      .set({
        questionsAnswered: session.questionsAnswered + 1,
        questionsCorrect:  session.questionsCorrect + (isCorrect ? 1 : 0),
        totalScore:        session.totalScore + Math.round(b.pointsEarned),
        endingSkill:       JSON.stringify(nextState.skill),
      })
      .where(eq(mathSessions.id, session.id));

    return {
      isCorrect,
      nextQuestion: {
        operation:     resolved.operation,
        difficulty:    resolved.difficulty,
        num1:          resolved.question.num1,
        num2:          resolved.question.num2,
        symbol:        resolved.question.symbol,
        answer:        resolved.question.answer,
      },
      allocatedSeconds:  resolved.allocatedSeconds,
      skill:             nextState.skill,
      levelUpCrossings:  crossings,
    };
  });
}
