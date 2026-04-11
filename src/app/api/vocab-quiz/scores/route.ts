import { NextRequest, NextResponse } from 'next/server';
import { db, vocabScores } from '@/lib/db';
import { isAdminEmail } from '@/lib/db-access-control';
import { validateAuth, createErrorResponse, ApiException } from '@/lib/api-utils';

export async function POST(request: NextRequest) {
  try {
    const user = await validateAuth();
    const data = await request.json();
    const { questionsAnswered, questionsCorrect, totalSections, selectedSections, difficulty } = data;

    const errors: string[] = [];
    if (typeof questionsAnswered !== 'number' || questionsAnswered < 1)   errors.push('questionsAnswered must be >= 1');
    if (typeof questionsCorrect !== 'number' || questionsCorrect < 0)     errors.push('questionsCorrect must be >= 0');
    if (typeof totalSections !== 'number' || totalSections < 1)           errors.push('totalSections must be >= 1');
    if (!Array.isArray(selectedSections) || selectedSections.length === 0) errors.push('selectedSections must be non-empty');
    if (!['easy', 'medium', 'hard', 'mixed'].includes(difficulty))        errors.push('invalid difficulty');
    if (questionsCorrect > questionsAnswered)                              errors.push('questionsCorrect cannot exceed questionsAnswered');
    if (errors.length) throw new ApiException(`Validation failed: ${errors.join(', ')}`, 400);

    const isAdmin = await isAdminEmail(user.email);

    const [saved] = await db.insert(vocabScores).values({
      playerEmail:       user.email,
      playerName:        user.name || 'Anonymous',
      questionsAnswered,
      questionsCorrect,
      totalSections,
      selectedSections:  JSON.stringify(selectedSections),
      difficulty,
      isAdmin,
      playedAt:          new Date(),
    }).returning({ id: vocabScores.id });

    return NextResponse.json({ success: true, isAdmin, scoreId: saved.id });
  } catch (error) {
    return createErrorResponse(error);
  }
}
