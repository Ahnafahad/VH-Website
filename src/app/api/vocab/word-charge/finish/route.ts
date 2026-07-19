/**
 * POST /api/vocab/word-charge/finish
 *
 * Accepts: ChargeFinishRequest
 * Server-recomputes all scoring; idempotent if round already finished.
 * Returns: ChargeFinishResponse
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  users, vocabChargeRounds, vocabWords,
  vocabUserWordRecords, vocabUserProgress,
} from '@/lib/db/schema';
import { safeApiHandler, validateAuth, ApiException } from '@/lib/api-utils';
import { chargeDelta, masteryLevel } from '@/lib/vocab/mastery-score';

const answerSchema = z.object({
  wordId:    z.number().int().positive(),
  choice:    z.enum(['positive', 'negative']).nullable(),
  usedHelp:  z.boolean(),
});

const bodySchema = z.object({
  roundId:    z.number().int().positive(),
  answers:    z.array(answerSchema),
  bestStreak: z.number().int().min(0),
});

export async function POST(req: NextRequest) {
  return safeApiHandler(async () => {
    const { email } = await validateAuth();

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiException('Bad request', 400);
    const { roundId, answers: clientAnswers } = parsed.data;

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (!user) throw new ApiException('User not found', 404);

    // Load round
    const [round] = await db
      .select()
      .from(vocabChargeRounds)
      .where(
        and(
          eq(vocabChargeRounds.id, roundId),
          eq(vocabChargeRounds.userId, user.id),
        ),
      )
      .limit(1);
    if (!round) throw new ApiException('Round not found', 404);

    // Returns the stored result for an already-finished round (idempotent replay).
    async function storedResponse(finished: typeof round) {
      const [progress] = await db
        .select({ totalPoints: vocabUserProgress.totalPoints })
        .from(vocabUserProgress)
        .where(eq(vocabUserProgress.userId, user.id))
        .limit(1);
      const totalPoints = progress?.totalPoints ?? 0;

      // Recompute personalBest from stored round data
      const allFinished = await db
        .select({ pts: vocabChargeRounds.pointsEarned })
        .from(vocabChargeRounds)
        .where(
          and(
            eq(vocabChargeRounds.userId, user.id),
            eq(vocabChargeRounds.status, 'finished'),
          ),
        );
      const personalBest = allFinished.reduce((m, r) => Math.max(m, r.pts), 0);

      const answers = finished.answers ? (JSON.parse(finished.answers) as typeof clientAnswers) : [];
      const skipped = answers.filter(a => a.choice === null).length;
      const helped  = answers.filter(a => a.usedHelp).length;

      return {
        pointsEarned: finished.pointsEarned,
        totalPoints,
        correct:      finished.correctCount,
        wrong:        finished.wrongCount,
        helped,
        skipped,
        bestStreak:   finished.bestStreak,
        personalBest,
        isNewBest:    false,
      };
    }

    // Idempotent: if already finished, return stored result
    if (round.status === 'finished') {
      return storedResponse(round);
    }

    const roundWordIds: number[] = JSON.parse(round.wordIds);
    const roundWordSet = new Set(roundWordIds);

    // Deduplicate answers: first occurrence per wordId wins
    const seen    = new Set<number>();
    const answers: (typeof clientAnswers[0])[] = [];
    for (const a of clientAnswers) {
      if (!seen.has(a.wordId) && roundWordSet.has(a.wordId)) {
        seen.add(a.wordId);
        answers.push(a);
      }
    }

    // Load word connotations for answered words
    const answeredIds = answers.map(a => a.wordId);
    const wordRows = answeredIds.length > 0
      ? await db
          .select({ id: vocabWords.id, connotation: vocabWords.connotation })
          .from(vocabWords)
          .where(
            // Use OR-chain for small sets — avoids inArray import complexity
            sql`${vocabWords.id} IN (${sql.raw(answeredIds.join(','))})`,
          )
      : [];
    const connotationMap = new Map(wordRows.map(w => [w.id, w.connotation]));

    // Server-side recompute: points + streak
    const POINTS_CORRECT       = 5;
    const POINTS_HELPED        = 2;
    const STREAK_MILESTONE_BONUS = 10;
    const STREAK_MILESTONE      = 5;

    let streak      = 0;
    let bestStreak  = 0;
    let points      = 0;
    let correctCount = 0;
    let wrongCount   = 0;
    let helpedCount  = 0;
    let skippedCount = 0;

    // Per-answer scoring
    type ScoredAnswer = {
      wordId:       number;
      choice:       'positive' | 'negative' | null;
      usedHelp:     boolean;
      isCorrect:    boolean | null; // null = skipped
      pointsEarned: number;
    };
    const scoredAnswers: ScoredAnswer[] = [];

    for (const a of answers) {
      const trueConnotation = connotationMap.get(a.wordId);
      // Skip if word not found or connotation not charged
      if (!trueConnotation || (trueConnotation !== 'positive' && trueConnotation !== 'negative')) {
        skippedCount++;
        scoredAnswers.push({ ...a, isCorrect: null, pointsEarned: 0 });
        continue;
      }

      if (a.choice === null) {
        // Skipped (choice = null after help)
        skippedCount++;
        // usedHelp already true on skipped answers
        if (a.usedHelp) helpedCount++;
        // streak does NOT reset on skip
        scoredAnswers.push({ ...a, isCorrect: null, pointsEarned: 0 });
        continue;
      }

      const isCorrect = a.choice === trueConnotation;

      if (a.usedHelp) helpedCount++;

      if (isCorrect) {
        correctCount++;
        streak++;
        if (streak > bestStreak) bestStreak = streak;

        const base = a.usedHelp ? POINTS_HELPED : POINTS_CORRECT;
        let earned = base;

        // Streak milestone bonus at every 5th consecutive correct
        if (streak % STREAK_MILESTONE === 0) {
          earned += STREAK_MILESTONE_BONUS;
        }
        points += earned;
        scoredAnswers.push({ ...a, isCorrect: true, pointsEarned: earned });
      } else {
        wrongCount++;
        streak = 0; // reset on wrong
        scoredAnswers.push({ ...a, isCorrect: false, pointsEarned: 0 });
      }
    }

    const now = new Date();

    // Transaction: update round + upsert word records + update progress.
    // The status==='active' condition on the round update makes concurrent
    // duplicate finishes (double-tap, beacon + retry race) lose cleanly:
    // the loser rolls back and replays the stored result.
    const ALREADY_FINISHED = 'CHARGE_ALREADY_FINISHED';
    try {
      await db.transaction(async (tx) => {
      // 1. Finish round (only if still active — concurrency guard)
      const updated = await tx
        .update(vocabChargeRounds)
        .set({
          status:       'finished',
          answers:      JSON.stringify(answers),
          correctCount,
          wrongCount,
          helpedCount,
          skippedCount,
          bestStreak,
          pointsEarned: points,
          finishedAt:   now,
        })
        .where(
          and(
            eq(vocabChargeRounds.id, roundId),
            eq(vocabChargeRounds.status, 'active'),
          ),
        );
      if (updated.rowsAffected === 0) throw new Error(ALREADY_FINISHED);

      // 2. Upsert word records per answered word
      for (const sa of scoredAnswers) {
        if (sa.isCorrect === null && !sa.usedHelp) {
          // Pure skip with no help — still update lastSeenAt
          const [existing] = await tx
            .select()
            .from(vocabUserWordRecords)
            .where(
              and(
                eq(vocabUserWordRecords.userId, user.id),
                eq(vocabUserWordRecords.wordId, sa.wordId),
              ),
            )
            .limit(1);
          if (existing) {
            await tx
              .update(vocabUserWordRecords)
              .set({ lastSeenAt: now, lastInteractionAt: now, updatedAt: now })
              .where(eq(vocabUserWordRecords.id, existing.id));
          }
          continue;
        }

        const [existing] = await tx
          .select()
          .from(vocabUserWordRecords)
          .where(
            and(
              eq(vocabUserWordRecords.userId, user.id),
              eq(vocabUserWordRecords.wordId, sa.wordId),
            ),
          )
          .limit(1);

        // Compute mastery delta: help delta first (if usedHelp), then correct/wrong
        let score = existing?.masteryScore ?? 0;
        if (sa.usedHelp) {
          score += chargeDelta('help', score);
        }
        if (sa.isCorrect === true) {
          score += chargeDelta('correct', score);
        } else if (sa.isCorrect === false) {
          score += chargeDelta('wrong', score);
        }
        const newLevel = masteryLevel(score);

        if (existing) {
          const wasCorrect  = sa.isCorrect === true;
          const wasWrong    = sa.isCorrect === false;
          const newTotal    = (existing.totalAttempts   ?? 0) + (sa.isCorrect !== null ? 1 : 0);
          const newCorrect  = (existing.correctAttempts ?? 0) + (wasCorrect ? 1 : 0);
          const newAccuracy = newTotal > 0 ? newCorrect / newTotal : 0;
          const newConsecC  = wasCorrect ? (existing.consecutiveCorrect ?? 0) + 1 : (wasWrong ? 0 : existing.consecutiveCorrect ?? 0);
          const newConsecW  = wasWrong   ? (existing.consecutiveWrong   ?? 0) + 1 : (wasCorrect ? 0 : existing.consecutiveWrong ?? 0);

          await tx
            .update(vocabUserWordRecords)
            .set({
              masteryScore:       score,
              masteryLevel:       newLevel,
              totalAttempts:      newTotal,
              correctAttempts:    newCorrect,
              accuracyRate:       newAccuracy,
              consecutiveCorrect: newConsecC,
              consecutiveWrong:   newConsecW,
              lastSeenAt:         now,
              lastInteractionAt:  now,
              updatedAt:          now,
            })
            .where(eq(vocabUserWordRecords.id, existing.id));
        } else {
          const wasCorrect = sa.isCorrect === true;
          const wasWrong   = sa.isCorrect === false;
          await tx.insert(vocabUserWordRecords).values({
            userId:             user.id,
            wordId:             sa.wordId,
            masteryScore:       score,
            masteryLevel:       newLevel,
            totalAttempts:      sa.isCorrect !== null ? 1 : 0,
            correctAttempts:    wasCorrect ? 1 : 0,
            accuracyRate:       wasCorrect ? 1 : 0,
            consecutiveCorrect: wasCorrect ? 1 : 0,
            consecutiveWrong:   wasWrong   ? 1 : 0,
            lastSeenAt:         now,
            lastInteractionAt:  now,
            timesAsDistractor:  0,
            longGapCorrect:     false,
            createdAt:          now,
            updatedAt:          now,
          });
        }
      }

      // 3. Award points to vocabUserProgress
      if (points > 0) {
        const [prog] = await tx
          .select({ id: vocabUserProgress.id })
          .from(vocabUserProgress)
          .where(eq(vocabUserProgress.userId, user.id))
          .limit(1);
        if (prog) {
          await tx
            .update(vocabUserProgress)
            .set({
              totalPoints:  sql`${vocabUserProgress.totalPoints}  + ${points}`,
              weeklyPoints: sql`${vocabUserProgress.weeklyPoints} + ${points}`,
              updatedAt:    now,
            })
            .where(eq(vocabUserProgress.userId, user.id));
        }
      }
      });
    } catch (err) {
      if (err instanceof Error && err.message === ALREADY_FINISHED) {
        const [finished] = await db
          .select()
          .from(vocabChargeRounds)
          .where(eq(vocabChargeRounds.id, roundId))
          .limit(1);
        if (finished) return storedResponse(finished);
      }
      throw err;
    }

    // Fetch updated total
    const [progress] = await db
      .select({ totalPoints: vocabUserProgress.totalPoints })
      .from(vocabUserProgress)
      .where(eq(vocabUserProgress.userId, user.id))
      .limit(1);
    const totalPoints = progress?.totalPoints ?? 0;

    // Personal best BEFORE this round (exclude it so ties don't read as new bests)
    const otherFinished = await db
      .select({ pts: vocabChargeRounds.pointsEarned, id: vocabChargeRounds.id })
      .from(vocabChargeRounds)
      .where(
        and(
          eq(vocabChargeRounds.userId, user.id),
          eq(vocabChargeRounds.status, 'finished'),
        ),
      );
    const prevBest     = otherFinished.reduce((m, r) => (r.id === roundId ? m : Math.max(m, r.pts)), 0);
    const personalBest = Math.max(prevBest, points);
    const isNewBest    = points > 0 && points > prevBest;

    return {
      pointsEarned: points,
      totalPoints,
      correct:      correctCount,
      wrong:        wrongCount,
      helped:       helpedCount,
      skipped:      skippedCount,
      bestStreak,
      personalBest,
      isNewBest,
    };
  }, '/api/vocab/word-charge/finish');
}
