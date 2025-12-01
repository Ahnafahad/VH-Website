import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import AccountingScore from '@/lib/models/AccountingScore';
import User from '@/lib/models/User';
import { isAdminEmail } from '@/lib/db-access-control';
import { validateAuth, createErrorResponse, ApiException } from '@/lib/api-utils';

export async function POST(request: NextRequest) {
  try {
    // 1. Validate authentication
    const user = await validateAuth();

    // 2. Connect to database
    await connectToDatabase();

    // 3. Check if user is admin first (admins have access to everything)
    const isAdmin = await isAdminEmail(user.email);

    // 4. Check FBS access for non-admin users
    const dbUser = await User.findOne({ email: user.email.toLowerCase() });
    if (!isAdmin && !dbUser?.accessTypes?.FBS) {
      throw new ApiException(
        'This game is only available to FBS students',
        403,
        'FBS_ACCESS_REQUIRED'
      );
    }

    // 5. Parse and validate request body
    const data = await request.json();

    const {
      simpleScore,
      dynamicScore,
      totalSpeedBonus,
      lectureCoverageBonus,
      questionsAnswered,
      correctAnswers,
      wrongAnswers,
      skippedAnswers,
      accuracy,
      selectedLectures,
      timeTaken,
      questionResults
    } = data;

    // 6. Validation
    const validationErrors: string[] = [];

    if (typeof simpleScore !== 'number') {
      validationErrors.push('simpleScore must be a number');
    }
    if (typeof dynamicScore !== 'number') {
      validationErrors.push('dynamicScore must be a number');
    }
    if (typeof totalSpeedBonus !== 'number' || totalSpeedBonus < 0) {
      validationErrors.push('totalSpeedBonus must be non-negative');
    }
    if (typeof lectureCoverageBonus !== 'number' || lectureCoverageBonus < 0) {
      validationErrors.push('lectureCoverageBonus must be non-negative');
    }
    if (typeof questionsAnswered !== 'number' || questionsAnswered !== 16) {
      validationErrors.push('questionsAnswered must be exactly 16');
    }
    if (typeof correctAnswers !== 'number' || correctAnswers < 0) {
      validationErrors.push('correctAnswers must be non-negative');
    }
    if (typeof wrongAnswers !== 'number' || wrongAnswers < 0) {
      validationErrors.push('wrongAnswers must be non-negative');
    }
    if (typeof skippedAnswers !== 'number' || skippedAnswers < 0) {
      validationErrors.push('skippedAnswers must be non-negative');
    }
    if (correctAnswers + wrongAnswers + skippedAnswers !== questionsAnswered) {
      validationErrors.push('correct + wrong + skipped must equal questionsAnswered');
    }
    if (!Array.isArray(selectedLectures) || selectedLectures.length === 0) {
      validationErrors.push('selectedLectures must be a non-empty array');
    }
    if (typeof accuracy !== 'number' || accuracy < 0 || accuracy > 100) {
      validationErrors.push('accuracy must be between 0 and 100');
    }
    if (typeof timeTaken !== 'number' || timeTaken < 0) {
      validationErrors.push('timeTaken must be non-negative');
    }

    // Verify simple score calculation (allow small floating point differences)
    const expectedSimpleScore = Math.max(0, correctAnswers * 1.0 + wrongAnswers * (-0.25));
    if (Math.abs(simpleScore - expectedSimpleScore) > 0.01) {
      validationErrors.push(`simpleScore mismatch: expected ${expectedSimpleScore.toFixed(2)}, got ${simpleScore.toFixed(2)}`);
    }

    // Verify lecture coverage bonus
    const expectedLectureBonus = selectedLectures.length * 0.1;
    if (Math.abs(lectureCoverageBonus - expectedLectureBonus) > 0.01) {
      validationErrors.push(`lectureCoverageBonus mismatch: expected ${expectedLectureBonus.toFixed(2)}, got ${lectureCoverageBonus.toFixed(2)}`);
    }

    // Verify dynamic score is at least simple score (bonuses can only add, not subtract)
    if (dynamicScore < simpleScore - 0.01) {
      validationErrors.push('dynamicScore cannot be less than simpleScore');
    }

    // Validate questionResults if provided
    if (questionResults && !Array.isArray(questionResults)) {
      validationErrors.push('questionResults must be an array');
    }

    if (validationErrors.length > 0) {
      throw new ApiException(
        `Validation failed: ${validationErrors.join(', ')}`,
        400,
        'VALIDATION_ERROR'
      );
    }

    // 7. Update question mastery for non-admin users
    let masteryFeedback = null;
    if (!isAdmin && questionResults && questionResults.length > 0) {
      try {
        const { updateQuestionMastery, getAccountingQuestions } = await import('@/lib/accounting-utils');
        const allLectures = await getAccountingQuestions();

        masteryFeedback = await updateQuestionMastery(
          user.email,
          questionResults,
          allLectures
        );
      } catch (error) {
        console.error('Error updating question mastery:', error);
        // Don't fail the entire request if mastery update fails
      }
    }

    // 8. Don't save admin scores to database
    if (isAdmin) {
      return NextResponse.json({
        success: true,
        message: 'Admin score not saved (admin scores are excluded from leaderboard)',
        isAdmin: true,
        scoreId: 'admin-not-saved',
        simpleScore,
        dynamicScore,
        mastery: masteryFeedback ? {
          newlyMastered: masteryFeedback.newlyMastered.length,
          lecturesCompleted: masteryFeedback.lecturesCompleted,
          totalMastered: masteryFeedback.totalMastered,
          totalQuestions: 281
        } : null
      });
    }

    // 8. Create score entry for non-admin users
    const accountingScore = new AccountingScore({
      playerEmail: user.email,
      playerName: user.name || dbUser.name || 'Anonymous',
      simpleScore,
      dynamicScore,
      totalSpeedBonus,
      lectureCoverageBonus,
      questionsAnswered,
      correctAnswers,
      wrongAnswers,
      skippedAnswers,
      accuracy,
      selectedLectures,
      timeTaken,
      playedAt: new Date(),
      isAdmin: false  // Always false since we skip admins above
    });

    const savedScore = await accountingScore.save();

    // 9. Return success with mastery feedback
    return NextResponse.json({
      success: true,
      message: 'Accounting game score saved successfully',
      isAdmin: false,
      scoreId: savedScore._id,
      simpleScore: savedScore.simpleScore,
      dynamicScore: savedScore.dynamicScore,
      mastery: masteryFeedback ? {
        newlyMastered: masteryFeedback.newlyMastered.length,
        lecturesCompleted: masteryFeedback.lecturesCompleted,
        totalMastered: masteryFeedback.totalMastered,
        totalQuestions: 281
      } : null
    });

  } catch (error) {
    return createErrorResponse(error);
  }
}
