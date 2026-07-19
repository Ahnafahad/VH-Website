// Shared types for Word Charge — the connotation classification game.
// Contract between /api/vocab/word-charge/* routes and the game client.

export type Connotation = 'positive' | 'negative';

export interface ChargeWord {
  id: number;
  word: string;
  connotation: Connotation;
  definition: string;
  exampleSentence: string;
  partOfSpeech: string;
  synonyms: string[];
  antonyms: string[];
}

export interface ChargeStartResponse {
  roundId: number;
  words: ChargeWord[];
  personalBest: number; // 0 when never played
  totalPoints: number;  // central point total at round start
}

export interface ChargeAnswer {
  wordId: number;
  choice: Connotation | null; // null = skipped after help, never classified
  usedHelp: boolean;
}

export interface ChargeFinishRequest {
  roundId: number;
  answers: ChargeAnswer[];
  bestStreak: number;
}

export interface ChargeFinishResponse {
  pointsEarned: number;
  totalPoints: number; // updated central total
  correct: number;
  wrong: number;
  helped: number;      // answers where help was used
  skipped: number;     // choice === null
  bestStreak: number;  // server-recomputed
  personalBest: number;
  isNewBest: boolean;
}

export interface ChargeSummaryResponse {
  personalBest: number;
  roundsPlayed: number;
  lastPlayedAt: string | null; // ISO
}
