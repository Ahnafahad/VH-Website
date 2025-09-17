import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import mongoose from 'mongoose';
import MathScore from '@/lib/models/MathScore';
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
  console.log('Mental Math Leaderboard API called');
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

    // Get top individual scores (TEMPORARILY INCLUDING admin scores for testing)
    console.log('Querying individual scores...');
    const individualScores = await MathScore.find({})
      .sort({ score: -1, playedAt: -1 })
      .limit(20)
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

    // Get accumulated scores by player (TEMPORARILY INCLUDING admins for testing)
    console.log('Running aggregation for accumulated scores...');
    const accumulatedScores = await MathScore.aggregate([
      {
        $match: {}
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
    console.error('ERROR in mental-math leaderboard API:', error);
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