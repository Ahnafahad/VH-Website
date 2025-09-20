import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import MathScore from '@/lib/models/MathScore';
import { validateAuth, createErrorResponse } from '@/lib/api-utils';

export async function GET() {
  console.log('Mental Math Leaderboard API called');
  try {
    // Validate authentication and authorization
    const user = await validateAuth();
    console.log('User authenticated:', user.email);

    // Connect to database with error handling
    console.log('Connecting to MongoDB...');
    await connectToDatabase();
    console.log('MongoDB connected successfully');

    // Get top individual scores (excluding admin scores)
    console.log('Querying individual scores...');
    const individualScores = await MathScore.find({ isAdmin: { $ne: true } })
      .sort({ score: -1, playedAt: -1 })
      .limit(10)
      .select({
        playerName: 1,
        score: 1,
        questionsCorrect: 1,
        questionsAnswered: 1,
        accuracy: 1,
        difficulty: 1,
        operations: 1,
        playedAt: 1
      })
      .lean();
    console.log('Individual scores found:', individualScores.length);

    // Get accumulated scores by player (excluding admin scores)
    console.log('Running aggregation for accumulated scores...');
    const accumulatedScores = await MathScore.aggregate([
      {
        $match: { isAdmin: { $ne: true } }
      },
      {
        $group: {
          _id: '$playerEmail',
          playerName: { $first: '$playerName' },
          totalScore: { $sum: '$score' },
          gamesPlayed: { $sum: 1 },
          averageScore: { $avg: '$score' },
          bestScore: { $max: '$score' },
          totalCorrect: { $sum: '$questionsCorrect' },
          totalAnswered: { $sum: '$questionsAnswered' }
        }
      },
      {
        $sort: { totalScore: -1 }
      },
      {
        $limit: 20
      },
      {
        $project: {
          _id: 0,
          playerName: 1,
          totalScore: 1,
          gamesPlayed: 1,
          averageScore: { $round: ['$averageScore', 0] },
          bestScore: 1,
          overallAccuracy: {
            $round: [
              { $multiply: [{ $divide: ['$totalCorrect', '$totalAnswered'] }, 100] },
              1
            ]
          }
        }
      }
    ]);
    console.log('Accumulated scores found:', accumulatedScores.length);

    console.log('Preparing response...');
    const response = {
      individual: individualScores || [],
      accumulated: accumulatedScores || [],
      isEmpty: (individualScores.length === 0 && accumulatedScores.length === 0),
      message: (individualScores.length === 0 && accumulatedScores.length === 0) ?
        'No math scores yet. Be the first to play!' :
        `${Math.max(individualScores.length, accumulatedScores.length)} players competing`
    };

    console.log('Returning successful response:', response.isEmpty ? 'Empty leaderboard' : 'With data');
    return NextResponse.json(response);
  } catch (error) {
    return createErrorResponse(error);
  }
}