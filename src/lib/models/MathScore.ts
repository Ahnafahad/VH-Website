import mongoose from 'mongoose';

export interface IMathScore extends mongoose.Document {
  playerEmail?: string;
  playerName?: string;
  score: number;
  questionsCorrect: number;
  questionsAnswered: number;
  accuracy: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'extreme';
  operations: string[];
  timeLimit: number;
  playedAt: Date;
  isAdmin?: boolean;
}

const MathScoreSchema = new mongoose.Schema<IMathScore>({
  playerEmail: {
    type: String,
    required: false,
    index: true
  },
  playerName: {
    type: String,
    required: false,
    default: 'Anonymous'
  },
  score: {
    type: Number,
    required: true,
    index: -1 // Descending index for leaderboard
  },
  questionsCorrect: {
    type: Number,
    required: true,
    min: 0
  },
  questionsAnswered: {
    type: Number,
    required: true,
    min: 0
  },
  accuracy: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  difficulty: {
    type: String,
    required: true,
    enum: ['easy', 'medium', 'hard', 'extreme']
  },
  operations: [{
    type: String,
    required: true,
    enum: ['addition', 'subtraction', 'multiplication', 'division']
  }],
  timeLimit: {
    type: Number,
    required: true,
    min: 0.5
  },
  playedAt: {
    type: Date,
    default: Date.now,
    index: -1
  },
  isAdmin: {
    type: Boolean,
    default: false
  }
});

// Create compound indexes for better query performance
MathScoreSchema.index({ score: -1, playedAt: -1 });
MathScoreSchema.index({ playerEmail: 1, score: -1 });
MathScoreSchema.index({ isAdmin: 1, score: -1 });

export default mongoose.models.MathScore || mongoose.model<IMathScore>('MathScore', MathScoreSchema);