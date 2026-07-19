/**
 * POST /api/vocab/game/guess
 *
 * Submits a word + sentence guess for a Word Hunt round. The judge is called
 * exactly once: it verdicts the sentence AND (informationally) the guessed
 * word's relation to the hidden word. If the sentence isn't accepted, the
 * guess stays pending — no attempt is consumed, no clue unlocks, and the
 * student must call /revise with a new sentence for the same word.
 *
 * Body: { date: string, word: string, sentence: string }
 * Returns: GameStateResponse & { accepted: boolean, sentenceFeedback?: string,
 *   guessResult?: { relation, relationFeedback, correct }, earnedBadges?: EarnedBadge[] }
 */

import { NextRequest } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users, vocabGameRounds, vocabGameSessions, vocabGameGuesses } from '@/lib/db/schema';
import { safeApiHandler, validateAuth, ApiException } from '@/lib/api-utils';
import { logVocabErrorSafe } from '@/lib/vocab/error-log';
import { isFutureDate, isPastDate } from '@/lib/vocab/game/dates';
import { normalizeWord, sameFamily } from '@/lib/vocab/game/word-family';
import { SENTENCE_POINTS_CLEAR, SENTENCE_POINTS_BASIC, applyCatchUp } from '@/lib/vocab/game/scoring';
import { judgeGuess } from '@/lib/vocab/game/judge';
import { buildGameStateResponse } from '@/lib/vocab/game/state-builder';
import { finalizeAcceptedGuess } from '@/lib/vocab/game/finalize-guess';
import type { RoundContent, GuessRelation } from '@/lib/vocab/game/types';

export async function POST(req: NextRequest) {
  return safeApiHandler(async () => {
    const { email } = await validateAuth();

    const body = await req.json() as unknown;
    if (typeof body !== 'object' || body === null) {
      throw new ApiException('Invalid request body', 400);
    }
    const { date, word, sentence } = body as Record<string, unknown>;
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new ApiException('date (YYYY-MM-DD) is required', 400);
    }
    if (typeof word !== 'string' || word.trim() === '') {
      throw new ApiException('word is required', 400);
    }
    if (typeof sentence !== 'string' || sentence.trim() === '') {
      throw new ApiException('sentence is required', 400);
    }
    if (isFutureDate(date)) throw new ApiException('Round not available yet', 403);

    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (!user) throw new ApiException('User not found', 404);

    const [round] = await db.select().from(vocabGameRounds).where(eq(vocabGameRounds.roundDate, date)).limit(1);
    if (!round) throw new ApiException('No round for this date', 404);

    const content = JSON.parse(round.content) as RoundContent;
    const isCatchUp = isPastDate(date);

    // ── Ensure a session exists (create on first guess) ────────────────────
    let [session] = await db
      .select()
      .from(vocabGameSessions)
      .where(and(eq(vocabGameSessions.userId, user.id), eq(vocabGameSessions.roundId, round.id)))
      .limit(1);

    if (!session) {
      const [inserted] = await db
        .insert(vocabGameSessions)
        .values({ userId: user.id, roundId: round.id, isCatchUp })
        .onConflictDoNothing()
        .returning();
      session = inserted ?? (await db
        .select()
        .from(vocabGameSessions)
        .where(and(eq(vocabGameSessions.userId, user.id), eq(vocabGameSessions.roundId, round.id)))
        .limit(1))[0];
    }
    if (!session) throw new ApiException('Could not start round session', 500);
    const activeSession = session;

    if (activeSession.status !== 'in_progress') throw new ApiException('Round already completed', 409);
    if (activeSession.guessCount >= 6) throw new ApiException('No attempts remaining', 409);

    const existingGuesses = await db
      .select()
      .from(vocabGameGuesses)
      .where(eq(vocabGameGuesses.sessionId, activeSession.id))
      .orderBy(vocabGameGuesses.guessNumber);

    const pending = existingGuesses.find(g => g.sentenceStatus === 'pending');
    if (pending) {
      throw new ApiException('You have a pending guess awaiting a revised sentence — use revise instead', 400);
    }

    const normalizedWord = normalizeWord(word);
    for (const g of existingGuesses) {
      if (sameFamily(normalizedWord, g.normalizedWord)) {
        throw new ApiException(`You've already guessed "${g.word}" (same word family) this round`, 400);
      }
    }

    // ── Judge the sentence + relation ONCE ──────────────────────────────────
    let judgeResult;
    try {
      judgeResult = await judgeGuess({
        guessedWord:     word.trim(),
        sentence:        sentence.trim(),
        hiddenWord:      content.word,
        intendedMeaning: content.intendedMeaning,
        definition:      content.definition,
        characteristics: content.clue2Characteristics,
        relatedGuesses:  content.relatedGuesses,
      });
    } catch (err) {
      logVocabErrorSafe({
        source:   'api',
        severity: 'error',
        context:  'vocab_game_judge',
        message:  err instanceof Error ? err.message : String(err),
        detail: { stack: err instanceof Error ? err.stack : undefined },
        userEmail: email,
      });
      throw new ApiException('Could not evaluate your sentence — please try again', 503);
    }

    const nextGuessNumber = activeSession.guessCount + 1;

    if (judgeResult.sentence.verdict === 'reject') {
      // Not accepted — attempt NOT consumed. Store/refresh the pending row.
      await db
        .insert(vocabGameGuesses)
        .values({
          sessionId:      activeSession.id,
          userId:         user.id,
          guessNumber:    nextGuessNumber,
          word:           word.trim(),
          normalizedWord,
          sentence:       sentence.trim(),
          sentenceStatus: 'pending',
          sentenceFeedback: judgeResult.sentence.feedback,
        })
        .onConflictDoUpdate({
          target: [vocabGameGuesses.sessionId, vocabGameGuesses.guessNumber],
          set: {
            word:             word.trim(),
            normalizedWord,
            sentence:         sentence.trim(),
            sentenceStatus:   'pending',
            sentenceFeedback: judgeResult.sentence.feedback,
            updatedAt:        new Date(),
          },
        });

      const stateAfter = await buildGameStateResponse(user.id, round, content, date, isCatchUp);
      return { ...stateAfter, accepted: false, sentenceFeedback: judgeResult.sentence.feedback };
    }

    // Sentence accepted — deterministic answer check overrides the AI relation.
    const isCorrectWord =
      content.acceptedAnswers.some(a => normalizeWord(a) === normalizedWord) ||
      content.acceptedAnswers.some(a => sameFamily(a, normalizedWord));
    const relation: GuessRelation = isCorrectWord ? 'correct' : judgeResult.relation.value;
    const relationFeedback = isCorrectWord
      ? `Correct! "${word.trim()}" is the hidden word.`
      : judgeResult.relation.feedback;

    const sentenceStatus = judgeResult.sentence.verdict === 'clear' ? 'accepted_clear' : 'accepted_basic';
    const sentencePointsRaw = judgeResult.sentence.verdict === 'clear' ? SENTENCE_POINTS_CLEAR : SENTENCE_POINTS_BASIC;
    const sentencePoints = applyCatchUp(sentencePointsRaw, isCatchUp);

    return finalizeAcceptedGuess({
      userId: user.id,
      activeSession,
      round,
      content,
      date,
      isCatchUp,
      guessNumber: nextGuessNumber,
      word: word.trim(),
      normalizedWord,
      sentence: sentence.trim(),
      sentenceStatus,
      sentenceFeedback: judgeResult.sentence.feedback,
      sentencePoints,
      relation,
      relationFeedback,
      isCorrectWord,
    });
  }, '/api/vocab/game/guess');
}
