import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateAuth, createErrorResponse } from '@/lib/api-utils';

export async function GET() {
  try {
    await validateAuth();

    const result = await db.$client.execute(`
      SELECT player_name AS playerName,
             SUM(questions_answered) AS totalQuestionsAnswered,
             SUM(questions_correct)  AS totalQuestionsCorrect,
             COUNT(*) AS gamesPlayed,
             ROUND(CAST(SUM(questions_correct) AS REAL) / SUM(questions_answered) * 100, 1) AS averageAccuracy,
             MAX(played_at) AS lastPlayed
      FROM vocab_scores WHERE is_admin = 0
      GROUP BY player_email ORDER BY totalQuestionsAnswered DESC LIMIT 10
    `);

    const leaderboard = result.rows.map((r: Record<string, unknown>) => ({
      playerName:             r.playerName,
      totalQuestionsAnswered: r.totalQuestionsAnswered,
      totalQuestionsCorrect:  r.totalQuestionsCorrect,
      gamesPlayed:            r.gamesPlayed,
      averageAccuracy:        r.averageAccuracy,
      lastPlayed:             r.lastPlayed,
    }));

    return NextResponse.json({
      leaderboard,
      isEmpty: leaderboard.length === 0,
      message: leaderboard.length === 0 ? 'No scores yet. Be the first!' : `${leaderboard.length} players on leaderboard`,
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}
