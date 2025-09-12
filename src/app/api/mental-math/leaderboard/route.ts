import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import mongoose from 'mongoose';
import MathScore from '@/lib/models/MathScore';
import { isEmailAuthorized } from '@/data/authorizedEmails';

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

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is authorized
    const isAuthorized = isEmailAuthorized(session.user.email.toLowerCase());
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    await connectToMongoDB();

    // Get top individual scores (excluding admin scores from leaderboard display)
    const individualScores = await MathScore.find({ isAdmin: { $ne: true } })
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

    // Get accumulated scores by player (excluding admins)
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

    return NextResponse.json({
      individual: individualScores,
      accumulated: accumulatedScores
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
  }
}