import type { ReadingSpeedQuestionType } from '@/data/reading-speed-passages';

/** Sent to the client before reading starts — no correctIndex. */
export interface ReadingSpeedPassageForTaking {
  id: string;
  title: string;
  body: string;
  wordCount: number;
  questions: { id: string; question: string; options: string[] }[];
}

export interface ReadingSpeedSubmitAnswer {
  questionId: string;
  selectedIndex: number | null;
}

export interface ReadingSpeedQuestionResult {
  questionId: string;
  type: ReadingSpeedQuestionType;
  question: string;
  options: string[];
  correctIndex: number;
  selectedIndex: number | null;
  isCorrect: boolean;
}

export type ReadingSpeedConfidence = 'high' | 'good' | 'low';

export interface ReadingSpeedAttemptResult {
  passageTitle: string;
  wordCount: number;
  rawWpm: number;
  correctCount: number;
  totalQuestions: number;
  comprehensionPct: number;
  verified: boolean;
  confidence: ReadingSpeedConfidence;
  questionResults: ReadingSpeedQuestionResult[];
}

export interface ReadingSpeedLeaderboardRow {
  rank: number;
  userId: number;
  name: string;
  bestWpm: number;
  isMe: boolean;
}

export interface ReadingSpeedAdminAttemptRow {
  id: number;
  userId: number;
  name: string;
  email: string;
  passageTitle: string;
  rawWpm: number;
  correctCount: number;
  totalQuestions: number;
  verified: boolean;
  createdAt: number;
}
