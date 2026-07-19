/**
 * POST /api/vocab/game/revise
 *
 * Re-judges the sentence for the current pending guess (same word — only the
 * sentence changes). On acceptance, sentence points are always the
 * 'accepted_revised' value, then the guess is finalized exactly like an
 * accepted first-try guess (consume attempt, relation, win/loss, points,
 * badges).
 *
 * Body: { date: string, sentence: string }
 * Returns: same shape as POST /guess
 */

import { NextRequest } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users, vocabGameRounds, vocabGameSessions, vocabGameGuesses } from '@/lib/db/schema';
import { safeApiHandler, validateAuth, ApiException } from '@/lib/api-utils';
import { logVocabErrorSafe } from '@/lib/vocab/error-log';
import { isFutureDate, isPastDate } from '@/lib/vocab/game/dates';
import { normalizeWord, sameFamily } from '@/lib/vocab/game/word-family';
import { SENTENCE_POINTS_REVISED, applyCatchUp } from '@/lib/vocab/game/scoring';
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
    const { date, sentence } = body as Record<string, unknown>;
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new ApiException('date (YYYY-MM-DD) is required', 400);
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

    const [activeSession] = await db
      .select()
      .from(vocabGameSessions)
      .where(and(eq(vocabGameSessions.userId, user.id), eq(vocabGameSessions.roundId, round.id)))
      .limit(1);
    if (!activeSession) throw new ApiException('No session for this round yet', 404);
    if (activeSession.status !== 'in_progress') throw new ApiException('Round already completed', 409);

    const [pending] = await db
      .select()
      .from(vocabGameGuesses)
      .where(and(eq(vocabGameGuesses.sessionId, activeSession.id), eq(vocabGameGuesses.sentenceStatus, 'pending')))
      .limit(1);
    if (!pending) throw new ApiException('No pending guess to revise', 400);

    // ── Judge the sentence + relation ONCE ──────────────────────────────────
    let judgeResult;
    try {
      judgeResult = await judgeGuess({
        guessedWord:      pending.word,
        sentence:         sentence.trim(),
        hiddenWord:       content.word,
        intendedMeaning:  content.intendedMeaning,
        definition:       content.definition,
        characteristics:  content.clue2Characteristics,
        relatedGuesses:   content.relatedGuesses,
        previousFeedback: pending.sentenceFeedback ?? undefined,
      });
    } catch (err) {
      logVocabErrorSafe({
        source:   'api',
        severity: 'error',
        context:  'vocab_game_judge_revise',
        message:  err instanceof Error ? err.message : String(err),
        detail: { stack: err instanceof Error ? err.stack : undefined },
        userEmail: email,
      });
      throw new ApiException('Could not evaluate your sentence — please try again', 503);
    }

    if (judgeResult.sentence.verdict === 'reject') {
      // Still not accepted — attempt NOT consumed. Refresh the pending row.
      await db
        .update(vocabGameGuesses)
        .set({
          sentence:         sentence.trim(),
          sentenceFeedback: judgeResult.sentence.feedback,
          revisionCount:    pending.revisionCount + 1,
          updatedAt:        new Date(),
        })
        .where(eq(vocabGameGuesses.id, pending.id));

      const stateAfter = await buildGameStateResponse(user.id, round, content, date, isCatchUp);
      return { ...stateAfter, accepted: false, sentenceFeedback: judgeResult.sentence.feedback };
    }

    // Accepted after revision — points are always the 'accepted_revised' rate.
    const normalizedWord = pending.normalizedWord;
    const isCorrectWord =
      content.acceptedAnswers.some(a => normalizeWord(a) === normalizedWord) ||
      content.acceptedAnswers.some(a => sameFamily(a, normalizedWord));
    const relation: GuessRelation = isCorrectWord ? 'correct' : judgeResult.relation.value;
    const relationFeedback = isCorrectWord
      ? `Correct! "${pending.word}" is the hidden word.`
      : judgeResult.relation.feedback;

    const sentencePoints = applyCatchUp(SENTENCE_POINTS_REVISED, isCatchUp);

    return finalizeAcceptedGuess({
      userId: user.id,
      activeSession,
      round,
      content,
      date,
      isCatchUp,
      guessNumber: pending.guessNumber,
      word: pending.word,
      normalizedWord,
      sentence: sentence.trim(),
      sentenceStatus: 'accepted_revised',
      sentenceFeedback: judgeResult.sentence.feedback,
      sentencePoints,
      relation,
      relationFeedback,
      isCorrectWord,
      revisionCountDelta: 1,
    });
  }, '/api/vocab/game/revise');
}
