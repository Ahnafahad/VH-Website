import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import mongoose from 'mongoose';
import VocabScore from '@/lib/models/VocabScore';
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
      questionsAnswered,
      questionsCorrect,
      totalSections,
      selectedSections,
      difficulty
    } = data;

    if (
      typeof questionsAnswered !== 'number' ||
      typeof questionsCorrect !== 'number' ||
      typeof totalSections !== 'number' ||
      !Array.isArray(selectedSections) ||
      !difficulty
    ) {
      return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
    }

    // Check if user is admin (admins won't appear in leaderboard)
    const adminEmails = ['ahnaf816@gmail.com', 'hasanxsarower@gmail.com'];
    const isAdmin = adminEmails.includes(session.user.email.toLowerCase());

    // Create new vocab score entry
    const vocabScore = new VocabScore({
      playerEmail: session.user.email,
      playerName: session.user.name || 'Anonymous',
      questionsAnswered,
      questionsCorrect,
      totalSections,
      selectedSections,
      difficulty,
      playedAt: new Date(),
      isAdmin
    });

    const savedScore = await vocabScore.save();
    console.log('Vocab score saved:', savedScore._id);

    return NextResponse.json({ 
      success: true, 
      message: 'Vocab quiz score saved successfully',
      isAdmin,
      scoreId: savedScore._id
    });
  } catch (error) {
    console.error('Error saving vocab score:', error);
    return NextResponse.json({ error: 'Failed to save score' }, { status: 500 });
  }
}