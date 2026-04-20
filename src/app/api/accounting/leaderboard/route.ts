import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isAdminEmail } from '@/lib/db-access-control';
import { validateAuth, createErrorResponse, ApiException } from '@/lib/api-utils';

export async function GET() {
  try {
    const user = await validateAuth();
    const isAdmin = await isAdminEmail(user.email);

    if (!isAdmin) {
      throw new ApiException('This game is only available to staff right now', 403, 'FBS_ACCESS_REQUIRED');
    }

    const singularResult = await db.$client.execute(`
      SELECT player_email AS playerEmail, player_name AS playerName,
             ROUND(MAX(dynamic_score), 2) AS bestDynamicScore,
             ROUND(simple_score, 2) AS bestSimpleScore,
             questions_answered AS questionsAnswered,
             correct_answers AS correctAnswers,
             ROUND(accuracy, 1) AS accuracy,
             json_array_length(selected_lectures) AS selectedLecturesCount,
             time_taken AS timeTaken, played_at AS playedAt
      FROM accounting_scores WHERE is_admin = 0
      GROUP BY player_email ORDER BY bestDynamicScore DESC, accuracy DESC LIMIT 20
    `);

    const cumulativeResult = await db.$client.execute(`
      SELECT player_email AS playerEmail, player_name AS playerName,
             ROUND(SUM(dynamic_score), 2) AS totalDynamicScore,
             ROUND(SUM(simple_score), 2)  AS totalSimpleScore,
             COUNT(*) AS gamesPlayed,
             SUM(questions_answered) AS totalQuestions,
             SUM(correct_answers) AS totalCorrect,
             ROUND(AVG(accuracy), 1) AS averageAccuracy,
             MAX(played_at) AS lastPlayed
      FROM accounting_scores WHERE is_admin = 0
      GROUP BY player_email ORDER BY totalDynamicScore DESC, averageAccuracy DESC LIMIT 20
    `);

    return NextResponse.json({
      singular:        singularResult.rows,
      cumulative:      cumulativeResult.rows,
      isEmpty:         singularResult.rows.length === 0 && cumulativeResult.rows.length === 0,
      singularCount:   singularResult.rows.length,
      cumulativeCount: cumulativeResult.rows.length,
      message:         singularResult.rows.length === 0
        ? 'No scores yet. Be the first to play!'
        : `Leaderboards loaded: ${singularResult.rows.length} singular, ${cumulativeResult.rows.length} cumulative`,
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}
