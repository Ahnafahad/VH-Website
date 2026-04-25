/**
 * POST /api/vocab/quiz/answer
 *
 * Records a single quiz answer and updates all downstream state:
 *   - vocabQuizAnswers
 *   - vocabUserWordRecords (mastery score, SRS, accuracy stats)
 *   - vocabConfusionPairs (on wrong answer)
 *   - vocabUserProgress (points, streak)
 *
 * Body: { sessionId, questionId, selectedWordId }
 *
 * Returns: { isCorrect, correctLetter, explanation, pointsEarned, masteryDelta }
 */

import { NextRequest } from 'next/server';
import { eq, and, sql } from 'drizzle-orm';
import { revalidateTag } from 'next/cache';
import { db } from '@/lib/db';
import {
  users,
  vocabQuizSessions,
  vocabQuizAnswers,
  vocabUserWordRecords,
  vocabConfusionPairs,
  vocabUserProgress,
  vocabWords,
  vocabSrsEvents,
} from '@/lib/db/schema';
import { safeApiHandler, validateAuth, ApiException } from '@/lib/api-utils';
import { VocabCacheTag } from '@/lib/vocab/cache-keys';
import { nextSrsState, isLongGap }  from '@/lib/vocab/srs/engine';
import { maxIntervalForDeadline }   from '@/lib/vocab/srs/deadline-cap';
import { quizDelta, masteryLevel }  from '@/lib/vocab/mastery-score';
import type { GeneratedQuestion }   from '@/lib/vocab/quiz-generator';
import { canAccessWord }            from '@/lib/vocab/access-check';

// ─── Point values (PRD Module 10) ────────────────────────────────────────────

const POINTS: Record<string, number> = {
  fill_blank:    5,
  analogy:       10,
  correct_usage: 15,
};

export async function POST(req: NextRequest) {
  return safeApiHandler(async () => {
    const { email } = await validateAuth();

    const body = await req.json() as unknown;
    if (typeof body !== 'object' || body === null) {
      throw new ApiException('Invalid request body', 400);
    }
    const { sessionId, questionId, selectedWordId } = body as Record<string, unknown>;

    if (typeof sessionId !== 'number' || typeof questionId !== 'string' || typeof selectedWordId !== 'number') {
      throw new ApiException('sessionId (number), questionId (string), selectedWordId (number) are required', 400);
    }

    // Resolve user
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (!user) throw new ApiException('User not found', 404);

    // Load quiz session
    const [session] = await db
      .select()
      .from(vocabQuizSessions)
      .where(
        and(
          eq(vocabQuizSessions.id, sessionId),
          eq(vocabQuizSessions.userId, user.id),
        )
      )
      .limit(1);

    if (!session) throw new ApiException('Session not found', 404);
    if (session.status === 'complete') throw new ApiException('Session already complete', 409);

    // Parse stored questions
    const questions = JSON.parse(session.questions) as GeneratedQuestion[];
    const question  = questions.find(q => q.id === questionId);
    if (!question) throw new ApiException('Question not found in session', 404);

    // Phase gate: phase-2 users cannot answer questions about locked words.
    // (The quiz/generate endpoint already filters these out, but defence-in-depth.)
    if (!(await canAccessWord(user.id, question.correctWordId))) {
      throw new ApiException('Word is locked for your tier', 403);
    }

    // Check if already answered (no-repeat rule)
    const [existing] = await db
      .select({ id: vocabQuizAnswers.id })
      .from(vocabQuizAnswers)
      .where(
        and(
          eq(vocabQuizAnswers.sessionId, sessionId),
          eq(vocabQuizAnswers.wordId, question.correctWordId),
        )
      )
      .limit(1);
    if (existing) throw new ApiException('This word has already been answered in this session', 409);

    const isCorrect = selectedWordId === question.correctWordId;

    // ── Update Word A (correct answer word) ───────────────────────────────────
    const [wordARecord] = await db
      .select()
      .from(vocabUserWordRecords)
      .where(
        and(
          eq(vocabUserWordRecords.userId, user.id),
          eq(vocabUserWordRecords.wordId, question.correctWordId),
        )
      )
      .limit(1);

    const now          = new Date();
    const longGap      = wordARecord ? isLongGap(wordARecord.lastCorrectAt) : false;
    const currentScore = wordARecord?.masteryScore ?? 0;

    const delta = isCorrect
      ? quizDelta({ kind: 'correct', isLongGap: longGap }, currentScore)
      : quizDelta({ kind: 'wrong_word_a' }, currentScore);

    // Deadline-capped SRS interval
    const [progress] = await db
      .select({ deadline: vocabUserProgress.deadline })
      .from(vocabUserProgress)
      .where(eq(vocabUserProgress.userId, user.id))
      .limit(1);
    const intervalCap = maxIntervalForDeadline(progress?.deadline ?? null, now);

    const newSrs = wordARecord
      ? nextSrsState(
          {
            intervalDays:   wordARecord.srsIntervalDays,
            easeFactor:     wordARecord.srsEaseFactor,
            repetitions:    wordARecord.srsRepetitions,
            nextReviewDate: wordARecord.srsNextReviewDate ?? new Date(),
          },
          isCorrect ? 'got_it' : 'missed_it',
          intervalCap,
        )
      : null;

    const newScore = currentScore + delta.scoreDelta;

    await db
      .insert(vocabUserWordRecords)
      .values({
        userId:             user.id,
        wordId:             question.correctWordId,
        masteryScore:       newScore,
        masteryLevel:       delta.newLevel,
        srsIntervalDays:    newSrs?.intervalDays   ?? 1,
        srsEaseFactor:      newSrs?.easeFactor      ?? 2.5,
        srsRepetitions:     newSrs?.repetitions     ?? 0,
        srsNextReviewDate:  newSrs?.nextReviewDate  ?? now,
        inSrsPool:          true,
        totalAttempts:      1,
        correctAttempts:    isCorrect ? 1 : 0,
        accuracyRate:       isCorrect ? 1 : 0,
        consecutiveCorrect: isCorrect ? 1 : 0,
        consecutiveWrong:   isCorrect ? 0 : 1,
        exposureCount:      1,
        lastInteractionAt:  now,
        lastSeenAt:         now,
        lastCorrectAt:      isCorrect ? now : undefined,
        longGapCorrect:     isCorrect && longGap,
      })
      .onConflictDoUpdate({
        target: [vocabUserWordRecords.userId, vocabUserWordRecords.wordId],
        set: {
          masteryScore:       newScore,
          masteryLevel:       delta.newLevel,
          srsIntervalDays:    newSrs?.intervalDays  ?? sql`srs_interval_days`,
          srsEaseFactor:      newSrs?.easeFactor    ?? sql`srs_ease_factor`,
          srsRepetitions:     newSrs?.repetitions   ?? sql`srs_repetitions`,
          srsNextReviewDate:  newSrs?.nextReviewDate ?? sql`srs_next_review_date`,
          inSrsPool:          true,
          totalAttempts:      sql`total_attempts + 1`,
          correctAttempts:    isCorrect ? sql`correct_attempts + 1` : sql`correct_attempts`,
          accuracyRate:       sql`CAST(correct_attempts + ${isCorrect ? 1 : 0} AS REAL) / (total_attempts + 1)`,
          consecutiveCorrect: isCorrect ? sql`consecutive_correct + 1` : 0,
          consecutiveWrong:   isCorrect ? 0 : sql`consecutive_wrong + 1`,
          exposureCount:      sql`exposure_count + 1`,
          lastInteractionAt:  now,
          lastSeenAt:         now,
          ...(isCorrect ? { lastCorrectAt: now, longGapCorrect: longGap } : {}),
          updatedAt:          now,
        },
      });

    // Log SRS event for audit trail.
    await db.insert(vocabSrsEvents).values({
      userId:            user.id,
      wordId:            question.correctWordId,
      eventType:         'quiz',
      rating:            isCorrect ? 'correct' : 'wrong',
      masteryBefore:     currentScore,
      masteryAfter:      newScore,
      intervalBefore:    wordARecord?.srsIntervalDays ?? 0,
      intervalAfter:     newSrs?.intervalDays ?? (wordARecord?.srsIntervalDays ?? 1),
      repetitionsBefore: wordARecord?.srsRepetitions ?? 0,
      repetitionsAfter:  newSrs?.repetitions ?? (wordARecord?.srsRepetitions ?? 0),
      nextReviewBefore:  wordARecord?.srsNextReviewDate ?? null,
      nextReviewAfter:   newSrs?.nextReviewDate ?? now,
      createdAt:         now,
    });

    // ── Update Word B (wrongly selected word) — confusion penalty ─────────────
    let wordBUpdated = false;
    if (!isCorrect && selectedWordId !== question.correctWordId) {
      const [wordBRecord] = await db
        .select({ masteryScore: vocabUserWordRecords.masteryScore })
        .from(vocabUserWordRecords)
        .where(
          and(
            eq(vocabUserWordRecords.userId, user.id),
            eq(vocabUserWordRecords.wordId, selectedWordId),
          )
        )
        .limit(1);

      const wordBScore = wordBRecord?.masteryScore ?? 0;
      const wordBDelta = quizDelta({ kind: 'wrong_word_b' }, wordBScore);
      const newWordBScore = wordBScore + wordBDelta.scoreDelta;

      await db
        .insert(vocabUserWordRecords)
        .values({
          userId:            user.id,
          wordId:            selectedWordId,
          masteryScore:      newWordBScore,
          masteryLevel:      wordBDelta.newLevel,
          timesAsDistractor: 1,
          lastInteractionAt: now,
        })
        .onConflictDoUpdate({
          target: [vocabUserWordRecords.userId, vocabUserWordRecords.wordId],
          set: {
            masteryScore:      newWordBScore,
            masteryLevel:      wordBDelta.newLevel,
            timesAsDistractor: sql`times_as_distractor + 1`,
            lastInteractionAt: now,
            updatedAt:         now,
          },
        });

      // Log / increment confusion pair (word_a = correct, word_b = wrongly selected)
      await db
        .insert(vocabConfusionPairs)
        .values({
          userId:   user.id,
          wordAId:  question.correctWordId,
          wordBId:  selectedWordId,
          count:    1,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [vocabConfusionPairs.userId, vocabConfusionPairs.wordAId, vocabConfusionPairs.wordBId],
          set: {
            count:     sql`count + 1`,
            updatedAt: now,
          },
        });

      wordBUpdated = true;
    }

    // ── Award points ──────────────────────────────────────────────────────────
    const pointsEarned = isCorrect ? (POINTS[question.type] ?? 5) : 0;

    if (pointsEarned > 0) {
      await db
        .update(vocabUserProgress)
        .set({
          totalPoints:  sql`total_points + ${pointsEarned}`,
          weeklyPoints: sql`weekly_points + ${pointsEarned}`,
          updatedAt:    now,
        })
        .where(eq(vocabUserProgress.userId, user.id));
    }

    // ── Record answer ─────────────────────────────────────────────────────────
    await db.insert(vocabQuizAnswers).values({
      sessionId,
      userId:         user.id,
      wordId:         question.correctWordId,
      selectedWordId: selectedWordId,
      isCorrect,
      pointsEarned,
      questionType:   question.type,
      answeredAt:     now,
    });

    // ── Update session correct count ──────────────────────────────────────────
    if (isCorrect) {
      await db
        .update(vocabQuizSessions)
        .set({ correctAnswers: sql`correct_answers + 1` })
        .where(eq(vocabQuizSessions.id, sessionId));
    }

    revalidateTag(VocabCacheTag.home(email));
    revalidateTag(VocabCacheTag.study(email));

    return {
      isCorrect,
      correctLetter:  question.correctLetter,
      correctWordId:  question.correctWordId,
      explanation:    question.explanation,
      pointsEarned,
      masteryDelta:   delta.scoreDelta,
      newMasteryLevel: delta.newLevel,
      confusionLogged: !isCorrect && wordBUpdated,
    };
  });
}
