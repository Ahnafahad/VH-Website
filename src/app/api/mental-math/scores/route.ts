import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import MathScore from '@/lib/models/MathScore';
import { isAdminEmail } from '@/lib/db-access-control';
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
      score,
      questionsCorrect,
      questionsAnswered,
      accuracy,
      difficulty,
      operations,
      timeLimit
    } = data;

    const validationErrors: string[] = [];

    if (typeof score !== 'number' || score < 0) {
      validationErrors.push('score must be a non-negative number');
    }
    if (typeof questionsCorrect !== 'number' || questionsCorrect < 0) {
      validationErrors.push('questionsCorrect must be a non-negative number');
    }
    if (typeof questionsAnswered !== 'number' || questionsAnswered < 1) {
      validationErrors.push('questionsAnswered must be a positive number');
    }
    if (typeof accuracy !== 'number' || accuracy < 0 || accuracy > 100) {
      validationErrors.push('accuracy must be a number between 0 and 100');
    }
    if (!difficulty || !['easy', 'medium', 'hard', 'extreme'].includes(difficulty)) {
      validationErrors.push('difficulty must be one of: easy, medium, hard, extreme');
    }
    if (!Array.isArray(operations) || operations.length === 0) {
      validationErrors.push('operations must be a non-empty array');
    }
    if (typeof timeLimit !== 'number' || timeLimit < 0.5) {
      validationErrors.push('timeLimit must be at least 0.5 seconds');
    }

    if (validationErrors.length > 0) {
      throw new ApiException(
        `Validation failed: ${validationErrors.join(', ')}`,
        400,
        'VALIDATION_ERROR'
      );
    }

    // Check if user is admin
    const isAdmin = await isAdminEmail(user.email);

    // Create new score entry
    const mathScore = new MathScore({
      playerEmail: user.email,
      playerName: user.name || 'Anonymous',
      score,
      questionsCorrect,
      questionsAnswered,
      accuracy,
      difficulty,
      operations,
      timeLimit,
      playedAt: new Date(),
      isAdmin
    });

    const savedScore = await mathScore.save();

    return NextResponse.json({
      success: true,
      message: 'Score saved successfully',
      isAdmin,
      scoreId: savedScore._id
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}