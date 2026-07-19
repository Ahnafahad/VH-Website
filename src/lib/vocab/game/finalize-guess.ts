/**
 * Word Hunt — shared "finalize an accepted guess" writer.
 *
 * Used by both /guess (new sentence accepted first try) and /revise
 * (pending sentence accepted after revision) once the judge has accepted
 * the sentence and the deterministic answer check has run. Handles the
 * DB transaction (with Turso conflict retry), point awards, session
 * completion, badge check, and public response shape.
 */

import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  vocabGameGuesses,
  vocabGameSessions,
  vocabUserProgress,
  type VocabGameRound,
  type VocabGameSession,
} from '@/lib/db/schema';
import { ApiException } from '@/lib/api-utils';
import { WORD_POINTS, applyCatchUp } from './scoring';
import { checkBadges } from '@/lib/vocab/badges/checker';
import { buildGameStateResponse } from './state-builder';
import type { GameStateResponse, GuessRelation, RoundContent, SessionStatus } from './types';

const MAX_TX_ATTEMPTS = 3;

function isTursoConflict(err: unknown): boolean {
  let e: unknown = err;
  for (let depth = 0; depth < 4 && e; depth++) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/SERVER_ERROR|returned HTTP status 4\d\d|SQLITE_BUSY|database is locked|write conflict/i.test(msg)) {
      return true;
    }
    e = e instanceof Error ? (e as { cause?: unknown }).cause : undefined;
  }
  return false;
}

export interface FinalizeAcceptedGuessParams {
  userId:           number;
  activeSession:    VocabGameSession;
  round:             VocabGameRound;
  content:           RoundContent;
  date:              string;
  isCatchUp:         boolean;
  guessNumber:       number;
  word:              string;
  normalizedWord:    string;
  sentence:          string;
  sentenceStatus:    'accepted_clear' | 'accepted_basic' | 'accepted_revised';
  sentenceFeedback:  string;
  sentencePoints:    number;
  relation:          GuessRelation;
  relationFeedback:  string;
  isCorrectWord:     boolean;
  revisionCountDelta?: number; // set to 1 when called from /revise
}

export async function finalizeAcceptedGuess(params: FinalizeAcceptedGuessParams): Promise<
  GameStateResponse & { accepted: true; guessResult: { relation: GuessRelation; relationFeedback: string; correct: boolean }; earnedBadges: unknown[] }
> {
  const {
    userId, activeSession, round, content, date, isCatchUp,
    guessNumber, word, normalizedWord, sentence, sentenceStatus,
    sentenceFeedback, sentencePoints, relation, relationFeedback, isCorrectWord,
    revisionCountDelta = 0,
  } = params;

  let wordPointsEarned = 0;
  let newStatus: SessionStatus = 'in_progress';
  if (isCorrectWord) {
    newStatus = 'won';
    wordPointsEarned = applyCatchUp(WORD_POINTS[guessNumber - 1] ?? 0, isCatchUp);
  } else if (guessNumber >= 6) {
    newStatus = 'lost';
  }

  const now = new Date();

  for (let attempt = 1; attempt <= MAX_TX_ATTEMPTS; attempt++) {
    try {
      await db.transaction(async (tx) => {
        // Re-check inside the transaction: guards against a concurrent
        // duplicate submission racing past the caller's pre-judge checks.
        const [freshSession] = await tx
          .select({ status: vocabGameSessions.status, guessCount: vocabGameSessions.guessCount })
          .from(vocabGameSessions)
          .where(eq(vocabGameSessions.id, activeSession.id))
          .limit(1);
        if (!freshSession || freshSession.status !== 'in_progress' || freshSession.guessCount !== activeSession.guessCount) {
          throw new ApiException('Round state changed — please refresh and try again', 409);
        }

        await tx
          .insert(vocabGameGuesses)
          .values({
            sessionId:      activeSession.id,
            userId,
            guessNumber,
            word,
            normalizedWord,
            sentence,
            sentenceStatus,
            sentenceFeedback,
            revisionCount:  revisionCountDelta,
            relation,
            relationFeedback,
            sentencePointsEarned: sentencePoints,
            updatedAt:      now,
          })
          .onConflictDoUpdate({
            target: [vocabGameGuesses.sessionId, vocabGameGuesses.guessNumber],
            set: {
              word,
              normalizedWord,
              sentence,
              sentenceStatus,
              sentenceFeedback,
              revisionCount:  sql`revision_count + ${revisionCountDelta}`,
              relation,
              relationFeedback,
              sentencePointsEarned: sentencePoints,
              updatedAt:      now,
            },
          });

        await tx
          .update(vocabGameSessions)
          .set({
            status:         newStatus,
            guessCount:     guessNumber,
            wordPoints:     activeSession.wordPoints + wordPointsEarned,
            sentencePoints: activeSession.sentencePoints + sentencePoints,
            ...(newStatus !== 'in_progress' ? { completedAt: now } : {}),
          })
          .where(eq(vocabGameSessions.id, activeSession.id));

        const totalAward = sentencePoints + wordPointsEarned;
        if (totalAward > 0) {
          await tx
            .update(vocabUserProgress)
            .set({
              totalPoints:  sql`total_points + ${totalAward}`,
              weeklyPoints: sql`weekly_points + ${totalAward}`,
              updatedAt:    now,
            })
            .where(eq(vocabUserProgress.userId, userId));
        }
      });
      break;
    } catch (err) {
      if (err instanceof ApiException) throw err;
      if (attempt === MAX_TX_ATTEMPTS || !isTursoConflict(err)) throw err;
      await new Promise((r) => setTimeout(r, 25 * attempt));
    }
  }

  const earnedBadges = newStatus !== 'in_progress'
    ? await checkBadges(userId, 'game_complete', { sessionId: activeSession.id }).catch(() => [])
    : [];

  const stateAfter = await buildGameStateResponse(userId, round, content, date, isCatchUp);
  return {
    ...stateAfter,
    accepted: true,
    guessResult: { relation, relationFeedback, correct: isCorrectWord },
    earnedBadges,
  };
}
