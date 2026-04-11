import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateAuth, createErrorResponse } from '@/lib/api-utils';

export async function GET() {
  try {
    await validateAuth();

    // Individual: top 3 scores per player → globally top 10
    const indResult = await db.$client.execute(`
      WITH ranked AS (
        SELECT player_name, player_email, score, questions_correct, questions_answered,
               accuracy, difficulty, operations, played_at, time_limit,
               ROW_NUMBER() OVER (PARTITION BY player_email ORDER BY score DESC, played_at DESC) AS rn
        FROM math_scores WHERE is_admin = 0
      )
      SELECT player_name, score, questions_correct, questions_answered,
             accuracy, difficulty, operations, played_at, time_limit
      FROM ranked WHERE rn <= 3
      ORDER BY score DESC, played_at DESC LIMIT 10
    `);

    // Accumulated: sum per player
    const accResult = await db.$client.execute(`
      SELECT player_name AS playerName,
             SUM(score) AS totalScore, COUNT(*) AS gamesPlayed,
             ROUND(AVG(score)) AS averageScore, MAX(score) AS bestScore,
             ROUND(CAST(SUM(questions_correct) AS REAL) / SUM(questions_answered) * 100, 1) AS overallAccuracy
      FROM math_scores WHERE is_admin = 0
      GROUP BY player_email ORDER BY totalScore DESC LIMIT 20
    `);

    const individual = indResult.rows.map((r: Record<string, unknown>) => ({
      playerName:        r.player_name,
      score:             r.score,
      questionsCorrect:  r.questions_correct,
      questionsAnswered: r.questions_answered,
      accuracy:          r.accuracy,
      difficulty:        r.difficulty,
      operations:        r.operations ? JSON.parse(r.operations as string) : [],
      playedAt:          r.played_at,
      timeLimit:         r.time_limit,
    }));

    const accumulated = accResult.rows.map((r: Record<string, unknown>) => ({
      playerName:      r.playerName,
      totalScore:      r.totalScore,
      gamesPlayed:     r.gamesPlayed,
      averageScore:    r.averageScore,
      bestScore:       r.bestScore,
      overallAccuracy: r.overallAccuracy,
    }));

    return NextResponse.json({
      individual,
      accumulated,
      isEmpty:  individual.length === 0 && accumulated.length === 0,
      message:  individual.length === 0 ? 'No scores yet. Be the first to play!' : `${accumulated.length} players competing`,
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}
