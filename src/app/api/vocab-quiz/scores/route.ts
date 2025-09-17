import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import VocabScore from '@/lib/models/VocabScore';
import { isAdminEmail } from '@/lib/generated-access-control';
import { validateAuth, createErrorResponse, ApiException } from '@/lib/api-utils';

export async function POST(request: NextRequest) {
  try {
    // Validate authentication and authorization
    const user = await validateAuth();

    // Connect to database with error handling
    await connectToDatabase();

    const data = await request.json();

    // Validate required fields with detailed error messages
    const {
      questionsAnswered,
      questionsCorrect,
      totalSections,
      selectedSections,
      difficulty
    } = data;

    const validationErrors: string[] = [];

    if (typeof questionsAnswered !== 'number' || questionsAnswered < 1) {
      validationErrors.push('questionsAnswered must be a positive number');
    }
    if (typeof questionsCorrect !== 'number' || questionsCorrect < 0) {
      validationErrors.push('questionsCorrect must be a non-negative number');
    }
    if (typeof totalSections !== 'number' || totalSections < 1) {
      validationErrors.push('totalSections must be a positive number');
    }
    if (!Array.isArray(selectedSections) || selectedSections.length === 0) {
      validationErrors.push('selectedSections must be a non-empty array');
    }
    if (!difficulty || !['easy', 'medium', 'hard'].includes(difficulty)) {
      validationErrors.push('difficulty must be one of: easy, medium, hard');
    }
    if (questionsCorrect > questionsAnswered) {
      validationErrors.push('questionsCorrect cannot exceed questionsAnswered');
    }

    if (validationErrors.length > 0) {
      throw new ApiException(
        `Validation failed: ${validationErrors.join(', ')}`,
        400,
        'VALIDATION_ERROR'
      );
    }

    // Check if user is admin
    const isAdmin = isAdminEmail(user.email);

    // Create new vocab score entry
    const vocabScore = new VocabScore({
      playerEmail: user.email,
      playerName: user.name || 'Anonymous',
      questionsAnswered,
      questionsCorrect,
      totalSections,
      selectedSections,
      difficulty,
      playedAt: new Date(),
      isAdmin
    });

    const savedScore = await vocabScore.save();

    return NextResponse.json({
      success: true,
      message: 'Vocab quiz score saved successfully',
      isAdmin,
      scoreId: savedScore._id
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}