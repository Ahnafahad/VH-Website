import { NextRequest, NextResponse } from 'next/server';
import { db, accountingScores } from '@/lib/db';
import { isAdminEmail } from '@/lib/db-access-control';
import { validateAuth, createErrorResponse, ApiException } from '@/lib/api-utils';

export async function POST(request: NextRequest) {
  try {
    const user = await validateAuth();
    const isAdmin = await isAdminEmail(user.email);

    if (!isAdmin) {
      throw new ApiException('This game is only available to staff right now', 403, 'FBS_ACCESS_REQUIRED');
    }

    const data = await request.json();
    const {
      simpleScore, dynamicScore, totalSpeedBonus, lectureCoverageBonus,
      questionsAnswered, correctAnswers, wrongAnswers, skippedAnswers,
      accuracy, selectedLectures, timeTaken, questionResults,
    } = data;

    const errors: string[] = [];
    if (typeof simpleScore !== 'number')                                     errors.push('simpleScore must be a number');
    if (typeof dynamicScore !== 'number')                                    errors.push('dynamicScore must be a number');
    if (typeof totalSpeedBonus !== 'number' || totalSpeedBonus < 0)          errors.push('totalSpeedBonus must be >= 0');
    if (typeof lectureCoverageBonus !== 'number' || lectureCoverageBonus<0)  errors.push('lectureCoverageBonus must be >= 0');
    if (typeof questionsAnswered !== 'number' || questionsAnswered !== 16)   errors.push('questionsAnswered must be 16');
    if (typeof correctAnswers !== 'number' || correctAnswers < 0)            errors.push('correctAnswers must be >= 0');
    if (typeof wrongAnswers !== 'number' || wrongAnswers < 0)                errors.push('wrongAnswers must be >= 0');
    if (typeof skippedAnswers !== 'number' || skippedAnswers < 0)            errors.push('skippedAnswers must be >= 0');
    if (correctAnswers + wrongAnswers + skippedAnswers !== questionsAnswered) errors.push('correct+wrong+skipped must equal questionsAnswered');
    if (!Array.isArray(selectedLectures) || selectedLectures.length === 0)   errors.push('selectedLectures must be non-empty');
    if (typeof accuracy !== 'number' || accuracy < 0 || accuracy > 100)      errors.push('accuracy must be 0-100');
    if (typeof timeTaken !== 'number' || timeTaken < 0)                      errors.push('timeTaken must be >= 0');

    const expectedSimple = Math.max(0, correctAnswers * 1.0 + wrongAnswers * (-0.25));
    if (Math.abs(simpleScore - expectedSimple) > 0.01) {
      errors.push(`simpleScore mismatch: expected ${expectedSimple.toFixed(2)}, got ${simpleScore.toFixed(2)}`);
    }
    const expectedLectureBonus = selectedLectures.length * 0.1;
    if (Math.abs(lectureCoverageBonus - expectedLectureBonus) > 0.01) {
      errors.push(`lectureCoverageBonus mismatch: expected ${expectedLectureBonus.toFixed(2)}`);
    }
    if (dynamicScore < simpleScore - 0.01) {
      errors.push('dynamicScore cannot be less than simpleScore');
    }
    if (errors.length) throw new ApiException(`Validation failed: ${errors.join(', ')}`, 400);

    // Update mastery for non-admin users
    let masteryFeedback = null;
    if (!isAdmin && questionResults?.length > 0) {
      try {
        const { updateQuestionMastery, getAccountingQuestions } = await import('@/lib/accounting-utils');
        const allLectures = await getAccountingQuestions();
        masteryFeedback = await updateQuestionMastery(user.email, questionResults, allLectures);
      } catch (e) {
        console.error('Mastery update failed:', e);
      }
    }

    // Admin scores not saved
    if (isAdmin) {
      return NextResponse.json({
        success: true,
        isAdmin: true,
        scoreId: 'admin-not-saved',
        simpleScore,
        dynamicScore,
        mastery: masteryFeedback ? {
          newlyMastered:     masteryFeedback.newlyMastered.length,
          lecturesCompleted: masteryFeedback.lecturesCompleted,
          totalMastered:     masteryFeedback.totalMastered,
          totalQuestions:    281,
        } : null,
      });
    }

    const [saved] = await db.insert(accountingScores).values({
      playerEmail:          user.email,
      playerName:           user.name || 'Anonymous',
      simpleScore,
      dynamicScore,
      totalSpeedBonus,
      lectureCoverageBonus,
      questionsAnswered,
      correctAnswers,
      wrongAnswers,
      skippedAnswers,
      accuracy,
      selectedLectures:     JSON.stringify(selectedLectures),
      timeTaken,
      isAdmin:              false,
      playedAt:             new Date(),
    }).returning({ id: accountingScores.id, simpleScore: accountingScores.simpleScore, dynamicScore: accountingScores.dynamicScore });

    return NextResponse.json({
      success: true,
      isAdmin: false,
      scoreId:      saved.id,
      simpleScore:  saved.simpleScore,
      dynamicScore: saved.dynamicScore,
      mastery: masteryFeedback ? {
        newlyMastered:     masteryFeedback.newlyMastered.length,
        lecturesCompleted: masteryFeedback.lecturesCompleted,
        totalMastered:     masteryFeedback.totalMastered,
        totalQuestions:    281,
      } : null,
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}
