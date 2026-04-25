import { getServerSession }            from 'next-auth';
import { NextRequest, NextResponse }   from 'next/server';
import { z }                           from 'zod';
import { revalidateTag }               from 'next/cache';
import { authOptions }                 from '@/lib/auth';
import { VocabCacheTag }               from '@/lib/vocab/cache-keys';
import {
  db, users, vocabFlashcardSessions, vocabUserWordRecords,
  vocabUserProgress, vocabWords, vocabSrsEvents,
} from '@/lib/db';
import { eq, and, sql }                from 'drizzle-orm';
import { nextSrsState, initialSrsState, isLongGap } from '@/lib/vocab/srs/engine';
import { maxIntervalForDeadline }     from '@/lib/vocab/srs/deadline-cap';
import { flashcardDelta } from '@/lib/vocab/mastery-score';
import { checkBadges }                 from '@/lib/vocab/badges/checker';
import { rateLimit }                   from '@/lib/rate-limit';
import { canAccessTheme, canAccessWord } from '@/lib/vocab/access-check';
import { ApiException, createErrorResponse } from '@/lib/api-utils';
import { ensureDailyLoginAwarded }     from '@/lib/vocab/daily-login';

const bodySchema = z.object({
  wordId:  z.number().int().positive(),
  rating:  z.enum(['got_it', 'unsure', 'missed_it']),
  isLast:  z.boolean(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ themeId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Rate limit: 300 ratings per minute per user (prevents point farming)
  if (!rateLimit(`${session.user.email}:flashcard_rate`, 300, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const themeId = parseInt((await params).themeId, 10);
  if (isNaN(themeId)) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  const { wordId, rating, isLast } = parsed.data;

  const [user] = await db.select({ id: users.id })
    .from(users).where(eq(users.email, session.user.email)).limit(1);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // Phase gate: phase-2 users cannot rate words in locked themes.
  // Check theme access, plus the word itself (guards against themeId mismatch).
  const [themeOk, wordOk] = await Promise.all([
    canAccessTheme(user.id, themeId),
    canAccessWord(user.id, wordId),
  ]);
  if (!themeOk || !wordOk) {
    return NextResponse.json({ error: 'Word is locked for your tier' }, { status: 403 });
  }

  try {
  // Wrap all DB writes in a transaction for data consistency
  const result = await db.transaction(async (tx) => {
    const now = new Date();

    // Word ∈ theme binding: prevents a client from rating a word from a
    // different theme via this endpoint (and point-farming through themes
    // they haven't even opened).
    const [wordRow] = await tx
      .select({ themeId: vocabWords.themeId })
      .from(vocabWords)
      .where(eq(vocabWords.id, wordId))
      .limit(1);
    if (!wordRow || wordRow.themeId !== themeId) {
      throw new ApiException('wordId does not belong to theme', 400);
    }

    // Hoist session lookup so we can short-circuit on duplicate ratings.
    const [sess] = await tx
      .select()
      .from(vocabFlashcardSessions)
      .where(and(
        eq(vocabFlashcardSessions.userId, user.id),
        eq(vocabFlashcardSessions.themeId, themeId),
      ))
      .limit(1);

    let ratings: Record<string, string> = {};
    if (sess) {
      try { ratings = JSON.parse(sess.ratings ?? '{}'); } catch { ratings = {}; }
      if (Object.prototype.hasOwnProperty.call(ratings, String(wordId))) {
        // Already rated in this session — idempotent no-op. No point delta,
        // no SRS advance, no session bump. Compliant clients never re-rate.
        return {
          pointsEarned: 0,
          sessWasIncomplete: false,
          dailyAwarded: false,
          streakDays: 0,
          longestStreak: 0,
        };
      }
    }

    // Load existing word record
    const [existing] = await tx
      .select()
      .from(vocabUserWordRecords)
      .where(and(
        eq(vocabUserWordRecords.userId, user.id),
        eq(vocabUserWordRecords.wordId, wordId),
      ))
      .limit(1);

    // SECURITY: pointsEarned is computed entirely server-side from the rating enum.
    // No client-supplied numeric value (points/score) is accepted or used here.
    let pointsEarned = 0;

    // Fetch user's deadline once for SRS interval cap
    const [progress] = await tx
      .select({ deadline: vocabUserProgress.deadline })
      .from(vocabUserProgress)
      .where(eq(vocabUserProgress.userId, user.id))
      .limit(1);
    const intervalCap = maxIntervalForDeadline(progress?.deadline ?? null, now);

    if (existing) {
      // Update SRS state (capped by deadline)
      const srsState = nextSrsState(
        {
          intervalDays:   existing.srsIntervalDays   ?? 1,
          easeFactor:     existing.srsEaseFactor     ?? 2.5,
          repetitions:    existing.srsRepetitions    ?? 0,
          nextReviewDate: existing.srsNextReviewDate ?? now,
        },
        rating,
        intervalCap,
      );

      // "unsure" is neutral — does not count as an attempt and does not touch streaks.
      const wasCorrect  = rating === 'got_it';
      const wasWrong    = rating === 'missed_it';
      const isUnsure    = rating === 'unsure';

      const longGap      = isLongGap(existing.lastCorrectAt ?? null);
      const prevTotal    = existing.totalAttempts    ?? 0;
      const prevCorrect  = existing.correctAttempts  ?? 0;
      const prevConsecC  = existing.consecutiveCorrect ?? 0;
      const prevConsecW  = existing.consecutiveWrong   ?? 0;

      const newTotal        = isUnsure ? prevTotal   : prevTotal + 1;
      const newCorrect      = wasCorrect ? prevCorrect + 1 : prevCorrect;
      const newConsecCorr   = wasCorrect ? prevConsecC + 1 : (wasWrong ? 0 : prevConsecC);
      const newConsecWrong  = wasWrong   ? prevConsecW + 1 : (wasCorrect ? 0 : prevConsecW);
      const newAccuracy     = newTotal > 0 ? newCorrect / newTotal : 0;

      const delta        = flashcardDelta(rating, existing.masteryScore ?? 0);
      const newMastery   = (existing.masteryScore ?? 0) + delta.scoreDelta;
      const newLevel     = delta.newLevel;
      const newExposure  = Math.min(10, (existing.exposureCount ?? 0) + 1);
      const newExpPoints = newExposure - (existing.exposureCount ?? 0); // 0 or 1
      pointsEarned       = wasCorrect ? 10 + (longGap ? 5 : 0) : (wasWrong ? 2 : 0);
      pointsEarned      += newExpPoints; // exposure bonus

      await tx.update(vocabUserWordRecords)
        .set({
          masteryScore:      newMastery,
          masteryLevel:      newLevel,
          srsIntervalDays:   srsState.intervalDays,
          srsEaseFactor:     srsState.easeFactor,
          srsRepetitions:    srsState.repetitions,
          srsNextReviewDate: srsState.nextReviewDate,
          inSrsPool:         true,
          totalAttempts:     newTotal,
          correctAttempts:   newCorrect,
          accuracyRate:      newAccuracy,
          consecutiveCorrect: newConsecCorr,
          consecutiveWrong:   newConsecWrong,
          exposureCount:      newExposure,
          exposurePoints:     Math.min(10, (existing.exposurePoints ?? 0) + newExpPoints),
          lastInteractionAt:  now,
          lastSeenAt:         now,
          lastCorrectAt:      wasCorrect ? now : existing.lastCorrectAt,
          longGapCorrect:     (longGap && wasCorrect) ? true : existing.longGapCorrect,
          flashcardGotItCount:  rating === 'got_it'   ? (existing.flashcardGotItCount   ?? 0) + 1 : existing.flashcardGotItCount,
          flashcardUnsureCount: rating === 'unsure'   ? (existing.flashcardUnsureCount  ?? 0) + 1 : existing.flashcardUnsureCount,
          flashcardMissedCount: rating === 'missed_it'? (existing.flashcardMissedCount  ?? 0) + 1 : existing.flashcardMissedCount,
          updatedAt: now,
        })
        .where(and(
          eq(vocabUserWordRecords.userId, user.id),
          eq(vocabUserWordRecords.wordId, wordId),
        ));
    } else {
      // Create new record
      const srsState   = initialSrsState();
      const wasCorrect = rating === 'got_it';
      const wasWrong   = rating === 'missed_it';
      const isUnsure   = rating === 'unsure';
      pointsEarned = wasCorrect ? 10 : (wasWrong ? 2 : 0);
      pointsEarned += 1; // first exposure bonus

      const initDelta = flashcardDelta(rating, 0);
      await tx.insert(vocabUserWordRecords).values({
        userId:             user.id,
        wordId,
        masteryScore:       initDelta.scoreDelta,
        masteryLevel:       initDelta.newLevel,
        srsIntervalDays:    srsState.intervalDays,
        srsEaseFactor:      srsState.easeFactor,
        srsRepetitions:     srsState.repetitions,
        srsNextReviewDate:  srsState.nextReviewDate,
        inSrsPool:          true,
        totalAttempts:      isUnsure ? 0 : 1,
        correctAttempts:    wasCorrect ? 1 : 0,
        consecutiveCorrect: wasCorrect ? 1 : 0,
        consecutiveWrong:   wasWrong   ? 1 : 0,
        exposureCount:      1,
        exposurePoints:     1,
        flashcardGotItCount:  rating === 'got_it'    ? 1 : 0,
        flashcardUnsureCount: rating === 'unsure'    ? 1 : 0,
        flashcardMissedCount: rating === 'missed_it' ? 1 : 0,
        lastInteractionAt:  now,
        lastSeenAt:         now,
        lastCorrectAt:      wasCorrect ? now : null,
        longGapCorrect:     false,
        accuracyRate:       wasCorrect ? 1 : 0,
        timesAsDistractor:  0,
        createdAt:          now,
        updatedAt:          now,
      });
    }

    // Log SRS event for audit trail (validates interval growth over time).
    {
      const intervalBefore   = existing ? (existing.srsIntervalDays ?? 1) : 0;
      const repsBefore       = existing ? (existing.srsRepetitions ?? 0)  : 0;
      const srsState = existing
        ? nextSrsState(
            { intervalDays: existing.srsIntervalDays ?? 1, easeFactor: existing.srsEaseFactor ?? 2.5,
              repetitions: existing.srsRepetitions ?? 0, nextReviewDate: existing.srsNextReviewDate ?? now },
            rating, intervalCap,
          )
        : initialSrsState();
      await tx.insert(vocabSrsEvents).values({
        userId:            user.id,
        wordId,
        eventType:         'flashcard',
        rating,
        masteryBefore:     existing?.masteryScore ?? 0,
        masteryAfter:      (existing?.masteryScore ?? 0) + flashcardDelta(rating, existing?.masteryScore ?? 0).scoreDelta,
        intervalBefore,
        intervalAfter:     srsState.intervalDays,
        repetitionsBefore: repsBefore,
        repetitionsAfter:  srsState.repetitions,
        nextReviewBefore:  existing?.srsNextReviewDate ?? null,
        nextReviewAfter:   srsState.nextReviewDate,
        createdAt:         now,
      });
    }

    // Update flashcard session ratings + index (uses hoisted `sess` + `ratings`).
    let sessWasIncomplete = false;
    if (sess) {
      const wasAlreadyComplete = sess.status === 'complete';
      ratings[wordId] = rating;
      const newIndex   = (sess.currentCardIndex ?? 0) + 1;
      const newStatus  = isLast ? 'complete' : 'in_progress';

      await tx.update(vocabFlashcardSessions)
        .set({
          ratings:          JSON.stringify(ratings),
          currentCardIndex: newIndex,
          status:           newStatus,
          completedAt:      isLast ? now : null,
        })
        .where(eq(vocabFlashcardSessions.id, sess.id));

      // Flashcard session complete bonus +10 (first completion only)
      if (isLast && !wasAlreadyComplete) {
        pointsEarned += 10;
        sessWasIncomplete = true;
      }
    }

    // Award points (daily-login helper owns lastStudyDate — don't write it here).
    if (pointsEarned > 0) {
      await tx.update(vocabUserProgress)
        .set({
          totalPoints:  sql`${vocabUserProgress.totalPoints} + ${pointsEarned}`,
          weeklyPoints: sql`${vocabUserProgress.weeklyPoints} + ${pointsEarned}`,
          updatedAt:    now,
        })
        .where(eq(vocabUserProgress.userId, user.id));
    }

    const daily = await ensureDailyLoginAwarded(user.id, now, tx);

    return {
      pointsEarned,
      sessWasIncomplete,
      dailyAwarded:  daily.awarded,
      streakDays:    daily.streakDays,
      longestStreak: daily.longestStreak,
    };
  });

  // Check flashcard-related badges OUTSIDE the transaction (fire-and-forget style).
  let earnedBadges: { id: string; name: string; description: string; category?: string }[] = [];
  if (isLast && result.sessWasIncomplete) {
    earnedBadges = await checkBadges(user.id, 'flashcard_complete').catch((err) => { console.error('[badge-check:flashcard]', err); return []; });
  }
  if (result.dailyAwarded) {
    const streakBadges = await checkBadges(user.id, 'streak_update', {
      streakDays:    result.streakDays,
      longestStreak: result.longestStreak,
    }).catch((err) => { console.error('[badge-check:streak]', err); return []; });
    earnedBadges = earnedBadges.concat(streakBadges);
  }

  revalidateTag(VocabCacheTag.home(session.user.email!));
  revalidateTag(VocabCacheTag.study(session.user.email!));
  revalidateTag(VocabCacheTag.flashcard(session.user.email!, themeId));

  return NextResponse.json({ ok: true, pointsEarned: result.pointsEarned, earnedBadges });
  } catch (error) {
    return createErrorResponse(error);
  }
}
