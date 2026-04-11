import { getServerSession }            from 'next-auth';
import { NextRequest, NextResponse }   from 'next/server';
import { z }                           from 'zod';
import { revalidateTag }               from 'next/cache';
import { authOptions }                 from '@/lib/auth';
import { VocabCacheTag }               from '@/lib/vocab/cache-keys';
import {
  db, users, vocabFlashcardSessions, vocabUserWordRecords,
  vocabUserProgress, vocabWords,
} from '@/lib/db';
import { eq, and, sql }                from 'drizzle-orm';
import { nextSrsState, initialSrsState, isLongGap } from '@/lib/vocab/srs/engine';
import type { SrsRating }              from '@/lib/vocab/srs/engine';
import { flashcardDelta } from '@/lib/vocab/mastery-score';
import { checkBadges }                 from '@/lib/vocab/badges/checker';
import { rateLimit }                   from '@/lib/rate-limit';

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

  // Wrap all DB writes in a transaction for data consistency
  const result = await db.transaction(async (tx) => {
    // Load existing word record
    const [existing] = await tx
      .select()
      .from(vocabUserWordRecords)
      .where(and(
        eq(vocabUserWordRecords.userId, user.id),
        eq(vocabUserWordRecords.wordId, wordId),
      ))
      .limit(1);

    const now = new Date();
    // SECURITY: pointsEarned is computed entirely server-side from the rating enum.
    // No client-supplied numeric value (points/score) is accepted or used here.
    let pointsEarned = 0;

    if (existing) {
      // Update SRS state
      const srsState = nextSrsState(
        {
          intervalDays:   existing.srsIntervalDays   ?? 1,
          easeFactor:     existing.srsEaseFactor     ?? 2.5,
          repetitions:    existing.srsRepetitions    ?? 0,
          nextReviewDate: existing.srsNextReviewDate ?? now,
        },
        rating,
      );

      const wasCorrect   = rating === 'got_it';
      const longGap      = isLongGap(existing.lastCorrectAt ?? null);
      const newConsecCorr = wasCorrect ? (existing.consecutiveCorrect ?? 0) + 1 : 0;
      const newConsecWrong= !wasCorrect ? (existing.consecutiveWrong ?? 0) + 1 : 0;
      const delta        = flashcardDelta(rating, existing.masteryScore ?? 0);
      const newMastery   = (existing.masteryScore ?? 0) + delta.scoreDelta;
      const newLevel     = delta.newLevel;
      const newExposure  = Math.min(10, (existing.exposureCount ?? 0) + 1);
      const newExpPoints = newExposure - (existing.exposureCount ?? 0); // 0 or 1
      pointsEarned       = wasCorrect ? 10 + (longGap ? 5 : 0) : 2;
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
          totalAttempts:     (existing.totalAttempts ?? 0) + 1,
          correctAttempts:   wasCorrect ? (existing.correctAttempts ?? 0) + 1 : (existing.correctAttempts ?? 0),
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
      const srsState = initialSrsState();
      const wasCorrect = rating === 'got_it';
      pointsEarned = wasCorrect ? 10 : 2;
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
        totalAttempts:      1,
        correctAttempts:    wasCorrect ? 1 : 0,
        consecutiveCorrect: wasCorrect ? 1 : 0,
        consecutiveWrong:   wasCorrect ? 0 : 1,
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

    // Update flashcard session ratings + index
    const [sess] = await tx
      .select()
      .from(vocabFlashcardSessions)
      .where(and(
        eq(vocabFlashcardSessions.userId, user.id),
        eq(vocabFlashcardSessions.themeId, themeId),
      ))
      .limit(1);

    let sessWasIncomplete = false;
    if (sess) {
      const wasAlreadyComplete = sess.status === 'complete';
      let ratings: Record<string, string>;
      try { ratings = JSON.parse(sess.ratings ?? '{}'); } catch { ratings = {}; }
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

    // Award points
    if (pointsEarned > 0) {
      await tx.update(vocabUserProgress)
        .set({
          totalPoints:  sql`${vocabUserProgress.totalPoints} + ${pointsEarned}`,
          weeklyPoints: sql`${vocabUserProgress.weeklyPoints} + ${pointsEarned}`,
          lastStudyDate: now,
          updatedAt:    now,
        })
        .where(eq(vocabUserProgress.userId, user.id));
    }

    return { pointsEarned, sessWasIncomplete };
  });

  // Check flashcard-related badges OUTSIDE the transaction (fire-and-forget style).
  let earnedBadges: { id: string; name: string; description: string }[] = [];
  if (isLast && result.sessWasIncomplete) {
    earnedBadges = await checkBadges(user.id, 'flashcard_complete').catch((err) => { console.error('[badge-check:flashcard]', err); return []; });
  }

  revalidateTag(VocabCacheTag.home(session.user.email!));
  revalidateTag(VocabCacheTag.study(session.user.email!));
  revalidateTag(VocabCacheTag.flashcard(session.user.email!, themeId));

  return NextResponse.json({ ok: true, pointsEarned: result.pointsEarned, earnedBadges });
}
