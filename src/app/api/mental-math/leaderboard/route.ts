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

    // Get top 3 individual scores per player (excluding admin scores)
    console.log('Querying individual scores with max 3 per player...');
    const individualScores = await MathScore.aggregate([
      {
        $match: { isAdmin: { $ne: true } }
      },
      {
        $sort: { score: -1, playedAt: -1 }
      },
      {
        $group: {
          _id: '$playerEmail',
          playerName: { $first: '$playerName' },
          topScores: {
            $push: {
              score: '$score',
              questionsCorrect: '$questionsCorrect',
              questionsAnswered: '$questionsAnswered',
              accuracy: '$accuracy',
              difficulty: '$difficulty',
              operations: '$operations',
              playedAt: '$playedAt',
              timeLimit: '$timeLimit',
              isSuspicious: '$isSuspicious'
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          playerName: 1,
          topScores: { $slice: ['$topScores', 3] } // Limit to top 3 scores per player
        }
      },
      {
        $unwind: '$topScores'
      },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: ['$topScores', { playerName: '$playerName' }]
          }
        }
      },
      {
        $sort: { score: -1, playedAt: -1 }
      },
      {
        $limit: 10 // Show top 10 individual games total
      }
    ]);
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