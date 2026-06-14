import type { MathOperation } from '@/lib/db/schema';
import type { Question } from '@/lib/math/problem-gen';

export type { Question };
export type { MathOperation };

export type LegacyTier  = 'easy' | 'medium' | 'hard' | 'extreme';
export type GameMode    = LegacyTier | 'auto';

export interface GameResult {
  score:             number;
  questionsCorrect:  number;
  questionsAnswered: number;
  accuracy:          number;
  difficulty:        LegacyTier;   // concrete tier used for legacy scoring row
  operations:        MathOperation[];
  timeLimit:         number;
  playerName?:       string;
  playedAt:          Date;
  isSuspicious?:     boolean;
}

export interface LeaderboardEntry {
  playerName:        string;
  score:             number;
  questionsCorrect:  number;
  questionsAnswered: number;
  accuracy:          number;
  difficulty:        string;
  operations?:       MathOperation[];
  timeLimit?:        number;
  playedAt:          Date;
  isSuspicious?:     boolean;
}

export interface AccumulatedScore {
  playerName:       string;
  totalScore:       number;
  gamesPlayed:      number;
  averageScore:     number;
  bestScore:        number;
  overallAccuracy:  number;
  hasSuspiciousGames?: boolean;
}

export interface LeaderboardData {
  individual:  LeaderboardEntry[];
  accumulated: AccumulatedScore[];
}
