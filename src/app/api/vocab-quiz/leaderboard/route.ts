import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import mongoose from 'mongoose';
import VocabScore from '@/lib/models/VocabScore';
import { isEmailAuthorized } from '@/data/authorizedEmails';

// Connect to MongoDB
async function connectToMongoDB() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI as string);
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is authorized
    const isAuthorized = isEmailAuthorized(session.user.email.toLowerCase());
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    await connectToMongoDB();

    // Get accumulated total questions answered by player (excluding admins)
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

    return NextResponse.json({
      leaderboard: leaderboard
    });
  } catch (error) {
    console.error('Error fetching vocab leaderboard:', error);
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
  }
}