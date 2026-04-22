import { getServerSession }            from 'next-auth';
import { NextRequest, NextResponse }   from 'next/server';
import { z }                           from 'zod';
import { revalidateTag }               from 'next/cache';
import { authOptions }                 from '@/lib/auth';
import { VocabCacheTag }               from '@/lib/vocab/cache-keys';
import {
  db, users, vocabUserWordRecords, vocabUserProgress,
} from '@/lib/db';
import { eq, and, sql }                from 'drizzle-orm';
import { nextSrsState, initialSrsState, isLongGap } from '@/lib/vocab/srs/engine';
import { maxIntervalForDeadline }     from '@/lib/vocab/srs/deadline-cap';
import type { SrsRating }              from '@/lib/vocab/srs/engine';
import { flashcardDelta }              from '@/lib/vocab/mastery-score';
import { rateLimit }                   from '@/lib/rate-limit';
import { canAccessWord }               from '@/lib/vocab/access-check';
import { ensureDailyLoginAwarded }     from '@/lib/vocab/daily-login';

const bodySchema = z.object({
  wordId: z.number().int().positive(),
  rating: z.enum(['got_it', 'unsure', 'missed_it']),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Rate limit: 300 ratings per minute per user (prevents point farming)
  if (!rateLimit(`${session.user.email}:practice_rate`, 300, 60_000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  const { wordId, rating } = parsed.data;

  const [user] = await db.select({ id: users.id })
    .from(users).where(eq(users.email, session.user.email)).limit(1);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // Phase gate: phase-2 users cannot rate locked words.
  if (!(await canAccessWord(user.id, wordId))) {
    return NextResponse.json({ error: 'Word is locked for your tier' }, { status: 403 });
  }

  const [existing] = await db
    .select()
    .from(vocabUserWordRecords)
    .where(and(
      eq(vocabUserWordRecords.userId, user.id),
      eq(vocabUserWordRecords.wordId, wordId),
    ))
    .limit(1);

  const now = new Date();

  // First exposure (letter-study flow or any untouched word): seed a full record
  // with SRS state and award first-exposure + rating points.
  if (!existing) {
    const srsState   = initialSrsState();
    const wasCorrect = rating === 'got_it';
    const wasWrong   = rating === 'missed_it';
    const isUnsure   = rating === 'unsure';
    const pointsEarned = (wasCorrect ? 10 : wasWrong ? 2 : 0) + 1; // + first-exposure

    const initDelta = flashcardDelta(rating, 0);

    await db.insert(vocabUserWordRecords).values({
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
      accuracyRate:       wasCorrect ? 1 : 0,
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
      timesAsDistractor:  0,
    });

    if (pointsEarned > 0) {
      await db.update(vocabUserProgress)
        .set({
          totalPoints:  sql`${vocabUserProgress.totalPoints}  + ${pointsEarned}`,
          weeklyPoints: sql`${vocabUserProgress.weeklyPoints} + ${pointsEarned}`,
          updatedAt:    now,
        })
        .where(eq(vocabUserProgress.userId, user.id));
      await ensureDailyLoginAwarded(user.id, now);
    }

    revalidateTag(VocabCacheTag.home(session.user.email!));
    revalidateTag(VocabCacheTag.practiceUi(session.user.email!));
    return NextResponse.json({ ok: true, pointsEarned });
  }

  // Due-date gate: prevents re-rating already-reviewed words for point farming.
  // UI only surfaces due words via getPracticeData; this is the server-side
  // enforcement. Silent success so compliant clients never see an error.
  if (existing.inSrsPool && existing.srsNextReviewDate && existing.srsNextReviewDate > now) {
    return NextResponse.json({ ok: true, pointsEarned: 0, notDue: true });
  }

  const wasCorrect = rating === 'got_it';
  const wasWrong   = rating === 'missed_it';
  const isUnsure   = rating === 'unsure';
  const longGap    = isLongGap(existing.lastCorrectAt ?? null);

  // Deadline-capped SRS interval
  const [progress] = await db
    .select({ deadline: vocabUserProgress.deadline })
    .from(vocabUserProgress)
    .where(eq(vocabUserProgress.userId, user.id))
    .limit(1);
  const intervalCap = maxIntervalForDeadline(progress?.deadline ?? null, now);

  const srsState = nextSrsState(
    {
      intervalDays:   existing.srsIntervalDays   ?? 1,
      easeFactor:     existing.srsEaseFactor     ?? 2.5,
      repetitions:    existing.srsRepetitions    ?? 0,
      nextReviewDate: existing.srsNextReviewDate ?? now,
    },
    rating as SrsRating,
    intervalCap,
  );

  // "unsure" is neutral — does not count as an attempt and does not touch streaks.
  const prevTotal    = existing.totalAttempts    ?? 0;
  const prevCorrect  = existing.correctAttempts  ?? 0;
  const prevConsecC  = existing.consecutiveCorrect ?? 0;
  const prevConsecW  = existing.consecutiveWrong   ?? 0;

  const newTotal       = isUnsure ? prevTotal   : prevTotal + 1;
  const newCorrect     = wasCorrect ? prevCorrect + 1 : prevCorrect;
  const newConsecCorr  = wasCorrect ? prevConsecC + 1 : (wasWrong ? 0 : prevConsecC);
  const newConsecWrong = wasWrong   ? prevConsecW + 1 : (wasCorrect ? 0 : prevConsecW);
  const newAccuracy    = newTotal > 0 ? newCorrect / newTotal : 0;

  const mastDelta      = flashcardDelta(rating, existing.masteryScore ?? 0);
  const newMastery     = (existing.masteryScore ?? 0) + mastDelta.scoreDelta;
  // SECURITY: pointsEarned is computed entirely server-side from the rating enum.
  // No client-supplied numeric value (points/score) is accepted or used here.
  const pointsEarned   = wasCorrect ? 10 + (longGap ? 5 : 0) : (wasWrong ? 2 : 0);

  await db.update(vocabUserWordRecords)
    .set({
      masteryScore:       newMastery,
      masteryLevel:       mastDelta.newLevel,
      srsIntervalDays:    srsState.intervalDays,
      srsEaseFactor:      srsState.easeFactor,
      srsRepetitions:     srsState.repetitions,
      srsNextReviewDate:  srsState.nextReviewDate,
      totalAttempts:      newTotal,
      correctAttempts:    newCorrect,
      accuracyRate:       newAccuracy,
      consecutiveCorrect: newConsecCorr,
      consecutiveWrong:   newConsecWrong,
      lastInteractionAt:  now,
      lastSeenAt:         now,
      lastCorrectAt:      wasCorrect ? now : existing.lastCorrectAt,
      longGapCorrect:     (longGap && wasCorrect) ? true : existing.longGapCorrect,
      updatedAt:          now,
    })
    .where(and(
      eq(vocabUserWordRecords.userId, user.id),
      eq(vocabUserWordRecords.wordId, wordId),
    ));

  if (pointsEarned > 0) {
    await db.update(vocabUserProgress)
      .set({
        totalPoints:  sql`${vocabUserProgress.totalPoints}  + ${pointsEarned}`,
        weeklyPoints: sql`${vocabUserProgress.weeklyPoints} + ${pointsEarned}`,
        updatedAt:    now,
      })
      .where(eq(vocabUserProgress.userId, user.id));
    await ensureDailyLoginAwarded(user.id, now);
  }

  revalidateTag(VocabCacheTag.home(session.user.email!));
  revalidateTag(VocabCacheTag.practiceUi(session.user.email!));

  return NextResponse.json({ ok: true, pointsEarned });
}
