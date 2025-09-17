import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import mongoose from 'mongoose';
import VocabScore from '@/lib/models/VocabScore';
import { isEmailAuthorized } from '@/lib/generated-access-control';

// Connect to MongoDB
async function connectToMongoDB() {
  try {
    if (mongoose.connection.readyState === 0) {
      if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI is not defined');
      }
      await mongoose.connect(process.env.MONGODB_URI);
    }
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

export async function GET() {
  console.log('Vocab Quiz Leaderboard API called');
  try {
    console.log('Getting server session...');
    const session = await getServerSession(authOptions);
    console.log('Session result:', session ? 'Found session' : 'No session', session?.user?.email);

    if (!session?.user?.email) {
      console.log('No session or email, returning 401');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is authorized
    console.log('Checking email authorization for:', session.user.email.toLowerCase());
    const isAuthorized = isEmailAuthorized(session.user.email.toLowerCase());
    console.log('Authorization result:', isAuthorized);

    if (!isAuthorized) {
      console.log('User not authorized, returning 403');
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    console.log('Connecting to MongoDB...');
    await connectToMongoDB();
    console.log('MongoDB connected successfully');

    // Get accumulated total questions answered by player (TEMPORARILY INCLUDING admins for testing)
    console.log('Running vocab leaderboard aggregation...');
    const leaderboard = await VocabScore.aggregate([
      {
        $match: {}
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
    console.error('ERROR in vocab-quiz leaderboard API:', error);
    console.error('Error type:', typeof error);

    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error('Error message:', errorMessage);
    if (errorStack) {
      console.error('Error stack:', errorStack);
    }

    // Return more detailed error info in development
    const isDev = process.env.NODE_ENV === 'development';
    return NextResponse.json({
      error: 'Failed to fetch leaderboard',
      details: isDev ? {
        message: errorMessage,
        stack: errorStack,
        type: typeof error
      } : undefined
    }, { status: 500 });
  }
}