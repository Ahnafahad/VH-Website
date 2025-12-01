import mongoose, { Schema, Document } from 'mongoose';

// Interface for lecture progress data
interface ILectureProgress {
  totalQuestions: number;
  masteredCount: number;
  completionCount: number;
  lastPlayed: Date;
}

// Main interface for AccountingProgress document
export interface IAccountingProgress extends Document {
  playerEmail: string;
  masteredQuestions: Set<string>;
  lectureProgress: Map<number, ILectureProgress>;
  totalMastered: number;
  totalQuestions: number;
  lastUpdated: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Schema definition
const AccountingProgressSchema = new Schema<IAccountingProgress>(
  {
    playerEmail: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    masteredQuestions: {
      type: Schema.Types.Mixed,
      default: () => new Set<string>(),
      get: (val: any) => val instanceof Set ? val : new Set(val || []),
      set: (val: any) => val instanceof Set ? val : new Set(val || [])
    },
    lectureProgress: {
      type: Map,
      of: {
        totalQuestions: { type: Number, required: true },
        masteredCount: { type: Number, required: true },
        completionCount: { type: Number, default: 0 },
        lastPlayed: { type: Date, required: true }
      },
      default: () => new Map()
    },
    totalMastered: {
      type: Number,
      default: 0,
      min: 0,
      max: 281
    },
    totalQuestions: {
      type: Number,
      default: 281,
      immutable: true
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret: any) {
        // Convert Set to Array for JSON serialization
        if (ret.masteredQuestions instanceof Set) {
          ret.masteredQuestions = Array.from(ret.masteredQuestions);
        }
        // Convert Map to Object for JSON serialization
        if (ret.lectureProgress instanceof Map) {
          const obj: any = {};
          ret.lectureProgress.forEach((value: any, key: any) => {
            obj[key] = value;
          });
          ret.lectureProgress = obj;
        }
        return ret;
      }
    }
  }
);

// Indexes for performance
AccountingProgressSchema.index({ playerEmail: 1 }, { unique: true });
AccountingProgressSchema.index({ lastUpdated: -1 });
AccountingProgressSchema.index({ totalMastered: -1 });

// Pre-save hook to update lastUpdated timestamp
AccountingProgressSchema.pre('save', function (next) {
  this.lastUpdated = new Date();
  next();
});

// Export model
export default mongoose.models.AccountingProgress ||
  mongoose.model<IAccountingProgress>('AccountingProgress', AccountingProgressSchema);
