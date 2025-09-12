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

export async function POST(request: NextRequest) {
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

    await vocabScore.save();

    return NextResponse.json({ 
      success: true, 
      message: 'Vocab quiz score saved successfully',
      isAdmin 
    });
  } catch (error) {
    console.error('Error saving vocab score:', error);
    return NextResponse.json({ error: 'Failed to save score' }, { status: 500 });
  }
}