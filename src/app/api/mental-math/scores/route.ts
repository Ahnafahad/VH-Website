import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import mongoose from 'mongoose';
import MathScore from '@/lib/models/MathScore';
import { isEmailAuthorized, isAdminEmail } from '@/data/authorizedEmails';

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

export async function POST(request: NextRequest) {
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

    const data = await request.json();
    
    // Validate required fields
    const {
      score,
      questionsCorrect,
      questionsAnswered,
      accuracy,
      difficulty,
      operations,
      timeLimit
    } = data;

    if (
      typeof score !== 'number' ||
      typeof questionsCorrect !== 'number' ||
      typeof questionsAnswered !== 'number' ||
      typeof accuracy !== 'number' ||
      !difficulty ||
      !Array.isArray(operations) ||
      typeof timeLimit !== 'number'
    ) {
      return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
    }

    // Check if user is admin (admins won't appear in leaderboard)
    const isAdmin = isAdminEmail(session.user.email);

    // Create new score entry
    const mathScore = new MathScore({
      playerEmail: session.user.email,
      playerName: session.user.name || 'Anonymous',
      score,
      questionsCorrect,
      questionsAnswered,
      accuracy,
      difficulty,
      operations,
      timeLimit,
      playedAt: new Date(),
      isAdmin
    });

    const savedScore = await mathScore.save();
    console.log('Math score saved:', savedScore._id);

    return NextResponse.json({ 
      success: true, 
      message: 'Score saved successfully',
      isAdmin,
      scoreId: savedScore._id
    });
  } catch (error) {
    console.error('Error saving math score:', error);
    return NextResponse.json({ error: 'Failed to save score' }, { status: 500 });
  }
}