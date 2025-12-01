import mongoose from 'mongoose';

export interface IAccountingScore extends mongoose.Document {
  // User identification
  playerEmail: string;
  playerName?: string;

  // Score data (dual scoring system)
  simpleScore: number;              // Simple: +1 correct, -0.25 wrong
  dynamicScore: number;             // Dynamic: simple + bonuses
  totalSpeedBonus: number;          // Total speed bonus earned
  lectureCoverageBonus: number;     // Bonus for lecture coverage

  questionsAnswered: number;        // Always 16 questions
  correctAnswers: number;           // Count of correct
  wrongAnswers: number;             // Count of wrong
  skippedAnswers: number;           // Count of skipped
  accuracy: number;                 // Percentage

  // Game metadata
  selectedLectures: number[];       // [1, 2, 5]
  timeTaken: number;                // Total seconds for all questions

  // Timestamps
  playedAt: Date;

  // Admin flag
  isAdmin?: boolean;
}

const AccountingScoreSchema = new mongoose.Schema<IAccountingScore>({
  playerEmail: {
    type: String,
    required: true,
    index: true,
    lowercase: true
  },
  playerName: {
    type: String,
    required: false,
    default: 'Anonymous'
  },
  simpleScore: {
    type: Number,
    required: true
  },
  dynamicScore: {
    type: Number,
    required: true,
    index: -1  // Descending for leaderboard (primary score)
  },
  totalSpeedBonus: {
    type: Number,
    required: true,
    default: 0
  },
  lectureCoverageBonus: {
    type: Number,
    required: true,
    default: 0
  },
  questionsAnswered: {
    type: Number,
    required: true,
    min: 1,
    default: 16  // Always 16 questions
  },
  correctAnswers: {
    type: Number,
    required: true,
    min: 0
  },
  wrongAnswers: {
    type: Number,
    required: true,
    min: 0
  },
  skippedAnswers: {
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
  selectedLectures: [{
    type: Number,
    required: true,
    min: 1,
    max: 12
  }],
  timeTaken: {
    type: Number,
    required: true,
    min: 0
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

// Compound indexes for performance (using dynamicScore as primary)
AccountingScoreSchema.index({ dynamicScore: -1, playedAt: -1 });
AccountingScoreSchema.index({ playerEmail: 1, dynamicScore: -1 });
AccountingScoreSchema.index({ playerEmail: 1, playedAt: -1 });
AccountingScoreSchema.index({ selectedLectures: 1 });

export default mongoose.models.AccountingScore ||
  mongoose.model<IAccountingScore>('AccountingScore', AccountingScoreSchema);
