import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import AccountingScore from '@/lib/models/AccountingScore';
import User from '@/lib/models/User';
import { validateAuth, createErrorResponse, ApiException } from '@/lib/api-utils';

export async function GET() {
  try {
    // 1. Validate authentication
    const user = await validateAuth();

    // 2. Connect to database
    await connectToDatabase();

    // 3. Check FBS access
    const dbUser = await User.findOne({ email: user.email.toLowerCase() });
    if (!dbUser?.accessTypes?.FBS) {
      throw new ApiException(
        'This game is only available to FBS students',
        403,
        'FBS_ACCESS_REQUIRED'
      );
    }

    // 4. Aggregate SINGULAR leaderboard (best single game by dynamic score)
    const singularLeaderboard = await AccountingScore.aggregate([
      {
        $match: { isAdmin: { $ne: true } }
      },
      {
        $sort: { dynamicScore: -1, playedAt: -1 }
      },
      {
        $group: {
          _id: '$playerEmail',
          playerName: { $first: '$playerName' },
          bestDynamicScore: { $first: '$dynamicScore' },
          bestSimpleScore: { $first: '$simpleScore' },
          questionsAnswered: { $first: '$questionsAnswered' },
          correctAnswers: { $first: '$correctAnswers' },
          accuracy: { $first: '$accuracy' },
          selectedLecturesCount: { $first: { $size: '$selectedLectures' } },
          timeTaken: { $first: '$timeTaken' },
          playedAt: { $first: '$playedAt' }
        }
      },
      {
        $sort: {
          bestDynamicScore: -1,
          accuracy: -1,
          playedAt: -1
        }
      },
      {
        $limit: 20
      },
      {
        $project: {
          _id: 0,
          playerEmail: '$_id',
          playerName: 1,
          bestDynamicScore: { $round: ['$bestDynamicScore', 2] },
          bestSimpleScore: { $round: ['$bestSimpleScore', 2] },
          questionsAnswered: 1,
          correctAnswers: 1,
          accuracy: { $round: ['$accuracy', 1] },
          selectedLecturesCount: 1,
          timeTaken: 1,
          playedAt: 1
        }
      }
    ]);

    // 5. Aggregate CUMULATIVE leaderboard (sum of all dynamic scores)
    const cumulativeLeaderboard = await AccountingScore.aggregate([
      {
        $match: { isAdmin: { $ne: true } }
      },
      {
        $group: {
          _id: '$playerEmail',
          playerName: { $first: '$playerName' },
          totalDynamicScore: { $sum: '$dynamicScore' },
          totalSimpleScore: { $sum: '$simpleScore' },
          gamesPlayed: { $sum: 1 },
          totalQuestions: { $sum: '$questionsAnswered' },
          totalCorrect: { $sum: '$correctAnswers' },
          averageAccuracy: { $avg: '$accuracy' },
          lastPlayed: { $max: '$playedAt' },
          uniqueLectures: { $addToSet: '$selectedLectures' }
        }
      },
      {
        $addFields: {
          // Flatten uniqueLectures array of arrays into single array
          flatLectures: {
            $reduce: {
              input: '$uniqueLectures',
              initialValue: [],
              in: { $setUnion: ['$$value', '$$this'] }
            }
          }
        }
      },
      {
        $addFields: {
          lecturesCoveredCount: { $size: '$flatLectures' }
        }
      },
      {
        $sort: {
          totalDynamicScore: -1,
          averageAccuracy: -1,
          gamesPlayed: -1
        }
      },
      {
        $limit: 20
      },
      {
        $project: {
          _id: 0,
          playerEmail: '$_id',
          playerName: 1,
          totalDynamicScore: { $round: ['$totalDynamicScore', 2] },
          totalSimpleScore: { $round: ['$totalSimpleScore', 2] },
          gamesPlayed: 1,
          totalQuestions: 1,
          totalCorrect: 1,
          averageAccuracy: { $round: ['$averageAccuracy', 1] },
          lastPlayed: 1,
          lecturesCoveredCount: 1
        }
      }
    ]);

    // 6. Return both leaderboards
    return NextResponse.json({
      singular: singularLeaderboard || [],
      cumulative: cumulativeLeaderboard || [],
      isEmpty: singularLeaderboard.length === 0 && cumulativeLeaderboard.length === 0,
      singularCount: singularLeaderboard.length,
      cumulativeCount: cumulativeLeaderboard.length,
      message: (singularLeaderboard.length === 0 && cumulativeLeaderboard.length === 0)
        ? 'No scores yet. Be the first to play!'
        : `Leaderboards loaded: ${singularLeaderboard.length} singular, ${cumulativeLeaderboard.length} cumulative`
    });

  } catch (error) {
    return createErrorResponse(error);
  }
}
