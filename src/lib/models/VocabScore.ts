import mongoose from 'mongoose';

export interface IVocabScore extends mongoose.Document {
  playerEmail?: string;
  playerName?: string;
  questionsAnswered: number;
  questionsCorrect: number;
  totalSections: number;
  selectedSections: number[];
  difficulty: string;
  playedAt: Date;
  isAdmin?: boolean;
}

const VocabScoreSchema = new mongoose.Schema<IVocabScore>({
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
  questionsAnswered: {
    type: Number,
    required: true,
    min: 0
  },
  questionsCorrect: {
    type: Number,
    required: true,
    min: 0
  },
  totalSections: {
    type: Number,
    required: true,
    min: 1
  },
  selectedSections: [{
    type: Number,
    required: true
  }],
  difficulty: {
    type: String,
    required: true
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

// Create indexes for better query performance
VocabScoreSchema.index({ questionsAnswered: -1, playedAt: -1 });
VocabScoreSchema.index({ playerEmail: 1, questionsAnswered: -1 });
VocabScoreSchema.index({ isAdmin: 1, questionsAnswered: -1 });

export default mongoose.models.VocabScore || mongoose.model<IVocabScore>('VocabScore', VocabScoreSchema);