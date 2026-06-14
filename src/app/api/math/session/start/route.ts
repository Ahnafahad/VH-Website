/**
 * POST /api/math/session/start
 *
 * Body: { operations: MathOperation[], difficulty: number | LegacyTier, timeLimit: number, adaptive: boolean }
 * Returns: { sessionId, firstQuestion, allocatedSeconds, skill }
 */

import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import {
  db, users, mathSessions, mathUserProgress,
  type MathOperation,
} from '@/lib/db';
import { safeApiHandler, validateAuth, ApiException } from '@/lib/api-utils';
import { OPERATIONS } from '@/lib/math/constants';
import { buildAdaptiveState, nextResolved, resolveDifficulty } from '@/lib/math/session-helpers';
import type { LegacyTier } from '@/components/math/types';

interface StartBody {
  operations: MathOperation[];
  difficulty: number | LegacyTier;
  timeLimit:  number;
  adaptive:   boolean;
}

export async function POST(request: NextRequest): Promise<Response> {
  return safeApiHandler(async () => {
    const { email } = await validateAuth();
    const body = (await request.json()) as StartBody;

    const errors: string[] = [];
    if (!Array.isArray(body.operations) || body.operations.length === 0) errors.push('operations must be non-empty');
    else if (body.operations.some((op) => !OPERATIONS.includes(op))) errors.push('invalid operation');
    if (typeof body.timeLimit !== 'number' || body.timeLimit < 0.5 || body.timeLimit > 10) errors.push('timeLimit must be 0.5–10');
    if (typeof body.adaptive !== 'boolean') errors.push('adaptive must be boolean');
    if (errors.length) throw new ApiException(`Validation failed: ${errors.join(', ')}`, 400);

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    if (!user) throw new ApiException('User not found', 404);

    const [progress] = await db
      .select()
      .from(mathUserProgress)
      .where(eq(mathUserProgress.userId, user.id))
      .limit(1);

    const startDifficulty = resolveDifficulty(body.difficulty);
    const state = buildAdaptiveState(progress ?? null);

    const resolved = nextResolved({
      adaptive:      body.adaptive,
      selectedOps:   body.operations,
      state,
      difficulty:    startDifficulty,
      prevQuestions: [],
    });

    const [session] = await db.insert(mathSessions).values({
      userId:          user.id,
      operations:      JSON.stringify(body.operations),
      startDifficulty,
      adaptive:        body.adaptive,
      timeLimit:       body.timeLimit,
      endingSkill:     JSON.stringify(state.skill),
      status:          'in_progress',
    }).returning({ id: mathSessions.id });

    return {
      sessionId:        session.id,
      firstQuestion: {
        operation:  resolved.operation,
        difficulty: resolved.difficulty,
        num1:       resolved.question.num1,
        num2:       resolved.question.num2,
        symbol:     resolved.question.symbol,
        answer:     resolved.question.answer,  // client needs this to check correctness immediately
      },
      allocatedSeconds: resolved.allocatedSeconds,
      skill:            state.skill,
    };
  });
}
