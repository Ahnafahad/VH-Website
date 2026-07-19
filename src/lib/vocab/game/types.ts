/**
 * Word Hunt — shared types.
 *
 * RoundContent is the exact shape stored (JSON-stringified) in
 * vocab_game_rounds.content. Everything else here is API payload shaping.
 */

export interface RoundContent {
  word:              string;
  intendedMeaning:   string;
  definition:        string;
  wordType:          string;
  tone:              'positive' | 'negative' | 'neutral';
  topic:             string;
  acceptedAnswers:   string[];
  clue1Distinction:  string;
  clue2Characteristics: string[];
  clue3Note:         string;
  clue4ContextSentence: string;
  clue5FirstLetter:  string;
  clue5Extra:        string;
  clue6Choices:      string[];
  relatedGuesses:    { word: string; distinction: string }[];
  modelSentence:     string;
  failExplanation:   string;
}

export type SentenceStatus =
  | 'pending' | 'accepted_clear' | 'accepted_basic' | 'accepted_revised' | 'rejected';

export type GuessRelation =
  | 'correct' | 'very_close' | 'related' | 'same_topic' | 'opposite' | 'unrelated';

export type SessionStatus = 'in_progress' | 'won' | 'lost';

export interface UnlockedClues {
  clue1Distinction?:     string;
  clue2Characteristics?: string[];
  clue3Note?:            string;
  clue4ContextSentence?: string;
  clue5FirstLetter?:     string;
  clue5Extra?:           string;
  clue6Choices?:         string[];
}

export interface PublicGuess {
  guessNumber:          number;
  word:                 string;
  sentence:             string;
  sentenceStatus:       SentenceStatus;
  sentenceFeedback:     string | null;
  relation:             GuessRelation | null;
  relationFeedback:     string | null;
  sentencePointsEarned: number;
}

export interface PublicReveal {
  word:            string;
  definition:      string;
  modelSentence:   string;
  failExplanation?: string;
  closestGuess?:   { word: string; distinction: string };
}

export interface GameStateResponse {
  date:      string;
  isCatchUp: boolean;
  topic:     string;
  wordType:  string;
  letterCount: number;
  tone:      'positive' | 'negative' | 'neutral';
  session: null | {
    status:         SessionStatus;
    guessCount:     number;
    wordPoints:     number;
    sentencePoints: number;
    guesses:        PublicGuess[];
  };
  unlockedClues: UnlockedClues;
  reveal:        PublicReveal | null;
  totalPoints:   number;
}
