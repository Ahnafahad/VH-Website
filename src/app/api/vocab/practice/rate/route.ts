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
import { nextSrsState, isLongGap }    from '@/lib/vocab/srs/engine';
import type { SrsRating }              from '@/lib/vocab/srs/engine';
import { flashcardDelta }              from '@/lib/vocab/mastery-score';
import { rateLimit }                   from '@/lib/rate-limit';

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

  const [existing] = await db
    .select()
    .from(vocabUserWordRecords)
    .where(and(
      eq(vocabUserWordRecords.userId, user.id),
      eq(vocabUserWordRecords.wordId, wordId),
    ))
    .limit(1);

  if (!existing) return NextResponse.json({ ok: true }); // no record to update

  const now        = new Date();
  const wasCorrect = rating === 'got_it';
  const longGap    = isLongGap(existing.lastCorrectAt ?? null);

  const srsState = nextSrsState(
    {
      intervalDays:   existing.srsIntervalDays   ?? 1,
      easeFactor:     existing.srsEaseFactor     ?? 2.5,
      repetitions:    existing.srsRepetitions    ?? 0,
      nextReviewDate: existing.srsNextReviewDate ?? now,
    },
    rating as SrsRating,
  );

  const newConsecCorr  = wasCorrect ? (existing.consecutiveCorrect ?? 0) + 1 : 0;
  const mastDelta      = flashcardDelta(rating, existing.masteryScore ?? 0);
  const newMastery     = (existing.masteryScore ?? 0) + mastDelta.scoreDelta;
  // SECURITY: pointsEarned is computed entirely server-side from the rating enum.
  // No client-supplied numeric value (points/score) is accepted or used here.
  const pointsEarned   = wasCorrect ? 10 + (longGap ? 5 : 0) : 2;

  await db.update(vocabUserWordRecords)
    .set({
      masteryScore:       newMastery,
      masteryLevel:       mastDelta.newLevel,
      srsIntervalDays:    srsState.intervalDays,
      srsEaseFactor:      srsState.easeFactor,
      srsRepetitions:     srsState.repetitions,
      srsNextReviewDate:  srsState.nextReviewDate,
      totalAttempts:      (existing.totalAttempts ?? 0) + 1,
      correctAttempts:    wasCorrect ? (existing.correctAttempts ?? 0) + 1 : (existing.correctAttempts ?? 0),
      consecutiveCorrect: newConsecCorr,
      consecutiveWrong:   wasCorrect ? 0 : (existing.consecutiveWrong ?? 0) + 1,
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

  // Update points
  if (pointsEarned > 0) {
    await db.update(vocabUserProgress)
      .set({
        totalPoints:   sql`${vocabUserProgress.totalPoints} + ${pointsEarned}`,
        weeklyPoints:  sql`${vocabUserProgress.weeklyPoints} + ${pointsEarned}`,
        lastStudyDate: now,
        updatedAt:     now,
      })
      .where(eq(vocabUserProgress.userId, user.id));
  }

  revalidateTag(VocabCacheTag.home(session.user.email!));
  revalidateTag(VocabCacheTag.practiceUi(session.user.email!));

  return NextResponse.json({ ok: true, pointsEarned });
}
