/**
 * Word Hunt — shared "public game state" builder.
 *
 * Used by GET /state and by /guess and /revise (which return the same shape
 * after mutating state), so clue-unlock and reveal logic lives in one place.
 */

import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { vocabGameSessions, vocabGameGuesses, vocabUserProgress, type VocabGameRound } from '@/lib/db/schema';
import { normalizeWord } from './word-family';
import type {
  RoundContent, UnlockedClues, PublicGuess, PublicReveal,
  GameStateResponse, GuessRelation, SentenceStatus, SessionStatus,
} from './types';

export async function buildGameStateResponse(
  userId:    number,
  round:     VocabGameRound,
  content:   RoundContent,
  date:      string,
  isCatchUp: boolean,
): Promise<GameStateResponse> {
  const [session] = await db
    .select()
    .from(vocabGameSessions)
    .where(and(eq(vocabGameSessions.userId, userId), eq(vocabGameSessions.roundId, round.id)))
    .limit(1);

  let sessionPublic: GameStateResponse['session'] = null;
  let wrongCount = 0;
  let publicGuesses: PublicGuess[] = [];

  if (session) {
    const guesses = await db
      .select()
      .from(vocabGameGuesses)
      .where(eq(vocabGameGuesses.sessionId, session.id))
      .orderBy(vocabGameGuesses.guessNumber);

    publicGuesses = guesses.map(g => ({
      guessNumber:          g.guessNumber,
      word:                 g.word,
      sentence:             g.sentence,
      sentenceStatus:       g.sentenceStatus as SentenceStatus,
      sentenceFeedback:     g.sentenceFeedback,
      relation:             g.relation as GuessRelation | null,
      relationFeedback:     g.relationFeedback,
      sentencePointsEarned: g.sentencePointsEarned,
    }));

    wrongCount = session.status === 'won' ? Math.max(0, session.guessCount - 1) : session.guessCount;

    sessionPublic = {
      status:         session.status as SessionStatus,
      guessCount:     session.guessCount,
      wordPoints:     session.wordPoints,
      sentencePoints: session.sentencePoints,
      guesses:        publicGuesses,
    };
  }

  const unlockedClues: UnlockedClues = {};
  if (wrongCount >= 1) unlockedClues.clue1Distinction = content.clue1Distinction;
  if (wrongCount >= 2) unlockedClues.clue2Characteristics = content.clue2Characteristics;
  if (wrongCount >= 3) {
    unlockedClues.clue3Note = content.clue3Note;
    unlockedClues.clue4ContextSentence = content.clue4ContextSentence;
  }
  if (wrongCount >= 4) {
    unlockedClues.clue5FirstLetter = content.clue5FirstLetter;
    unlockedClues.clue5Extra = content.clue5Extra;
  }
  if (wrongCount >= 5) unlockedClues.clue6Choices = content.clue6Choices;

  let reveal: PublicReveal | null = null;
  if (session && (session.status === 'won' || session.status === 'lost')) {
    let closestGuess: PublicReveal['closestGuess'];
    const RANK: GuessRelation[] = ['very_close', 'related', 'same_topic', 'opposite', 'unrelated'];
    for (const rank of RANK) {
      const match = publicGuesses.find(g => g.relation === rank);
      if (!match) continue;
      const authored = content.relatedGuesses.find(r => normalizeWord(r.word) === normalizeWord(match.word));
      if (authored) { closestGuess = authored; break; }
    }
    reveal = {
      word:            content.word,
      definition:      content.definition,
      modelSentence:   content.modelSentence,
      ...(session.status === 'lost' ? { failExplanation: content.failExplanation } : {}),
      ...(closestGuess ? { closestGuess } : {}),
    };
  }

  const [progress] = await db
    .select({ totalPoints: vocabUserProgress.totalPoints })
    .from(vocabUserProgress)
    .where(eq(vocabUserProgress.userId, userId))
    .limit(1);

  return {
    date,
    isCatchUp,
    topic:       content.topic,
    wordType:    content.wordType,
    letterCount: content.word.length,
    tone:        content.tone,
    session:     sessionPublic,
    unlockedClues,
    reveal,
    totalPoints: progress?.totalPoints ?? 0,
  };
}
