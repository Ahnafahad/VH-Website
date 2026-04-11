import { NextRequest, NextResponse } from 'next/server';
import { db, mathScores } from '@/lib/db';
import { isAdminEmail } from '@/lib/db-access-control';
import { validateAuth, createErrorResponse, ApiException } from '@/lib/api-utils';

export async function POST(request: NextRequest) {
  try {
    const user = await validateAuth();
    const data = await request.json();
    const { score, questionsCorrect, questionsAnswered, accuracy, difficulty, operations, timeLimit } = data;

    const errors: string[] = [];
    if (typeof score !== 'number' || score < 0)                                errors.push('score must be >= 0');
    if (typeof questionsCorrect !== 'number' || questionsCorrect < 0)          errors.push('questionsCorrect must be >= 0');
    if (typeof questionsAnswered !== 'number' || questionsAnswered < 1)        errors.push('questionsAnswered must be >= 1');
    if (typeof accuracy !== 'number' || accuracy < 0 || accuracy > 100)       errors.push('accuracy must be 0-100');
    if (!['easy', 'medium', 'hard', 'extreme'].includes(difficulty))           errors.push('invalid difficulty');
    if (!Array.isArray(operations) || operations.length === 0)                 errors.push('operations must be non-empty array');
    if (typeof timeLimit !== 'number' || timeLimit < 0.5)                      errors.push('timeLimit must be >= 0.5');
    if (errors.length) throw new ApiException(`Validation failed: ${errors.join(', ')}`, 400);

    const isAdmin = await isAdminEmail(user.email);

    const [saved] = await db.insert(mathScores).values({
      playerEmail:       user.email,
      playerName:        user.name || 'Anonymous',
      score,
      questionsCorrect,
      questionsAnswered,
      accuracy,
      difficulty,
      operations:        JSON.stringify(operations),
      timeLimit,
      isAdmin,
      playedAt:          new Date(),
    }).returning({ id: mathScores.id });

    return NextResponse.json({ success: true, isAdmin, scoreId: saved.id });
  } catch (error) {
    return createErrorResponse(error);
  }
}
