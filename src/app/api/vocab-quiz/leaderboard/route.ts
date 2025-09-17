import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import VocabScore from '@/lib/models/VocabScore';
import { validateAuth, createErrorResponse } from '@/lib/api-utils';

export async function GET() {
  console.log('Vocab Quiz Leaderboard API called');
  try {
    // Validate authentication and authorization
    const user = await validateAuth();
    console.log('User authenticated:', user.email);

    // Connect to database with error handling
    console.log('Connecting to MongoDB...');
    await connectToDatabase();
    console.log('MongoDB connected successfully');

    // Get accumulated total questions answered by player (excluding admin scores)
    console.log('Running vocab leaderboard aggregation...');
    const leaderboard = await VocabScore.aggregate([
      {
        $match: { isAdmin: { $ne: true } }
      },
      {
        $group: {
          _id: '$playerEmail',
          playerName: { $first: '$playerName' },
          totalQuestionsAnswered: { $sum: '$questionsAnswered' },
          totalQuestionsCorrect: { $sum: '$questionsCorrect' },
          gamesPlayed: { $sum: 1 },
          averageAccuracy: { 
            $avg: { 
              $multiply: [
                { $divide: ['$questionsCorrect', '$questionsAnswered'] }, 
                100
              ]
            }
          },
          lastPlayed: { $max: '$playedAt' },
          uniqueSectionsPlayed: { $addToSet: '$selectedSections' }
        }
      },
      {
        $sort: { totalQuestionsAnswered: -1 }
      },
      {
        $limit: 50
      },
      {
        $project: {
          _id: 0,
          playerName: 1,
          totalQuestionsAnswered: 1,
          totalQuestionsCorrect: 1,
          gamesPlayed: 1,
          averageAccuracy: { $round: ['$averageAccuracy', 1] },
          lastPlayed: 1,
          uniqueSectionsCount: { $size: '$uniqueSectionsPlayed' }
        }
      }
    ]);
    console.log('Vocab leaderboard aggregation complete, found:', leaderboard.length, 'entries');

    console.log('Preparing vocab response...');
    const response = {
      leaderboard: leaderboard || [],
      isEmpty: leaderboard.length === 0,
      message: leaderboard.length === 0 ? 'No quiz scores yet. Be the first to take a quiz!' : `${leaderboard.length} players on leaderboard`
    };

    console.log('Returning vocab response:', response.isEmpty ? 'Empty leaderboard' : 'With data');
    return NextResponse.json(response);
  } catch (error) {
    return createErrorResponse(error);
  }
}