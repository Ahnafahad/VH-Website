/**
 * POST /api/vocab/onboarding/unlock
 *
 * Reduced onboarding for old, syllabus-locked users (pre-dating the
 * onboarding system, migrated to a fixed WordSmart-only selection). Saves
 * the card style and syllabus selection they pick, then lifts the lock —
 * unlike /onboarding/complete, this never touches deadline/dailyTarget/phase,
 * since those were already set (or intentionally left unset) long before
 * this flow runs.
 */

import { getServerSession } from 'next-auth';
import { NextResponse, after } from 'next/server';
import { revalidateTag } from 'next/cache';
import { authOptions } from '@/lib/auth';
import { db, users, vocabUserProgress, vocabSyllabuses, vocabUserSyllabuses } from '@/lib/db';
import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { VocabCacheTag } from '@/lib/vocab/cache-keys';
import { getHomeData } from '@/lib/vocab/home-data';
import { getStudyData } from '@/lib/vocab/study-data';
import { getPracticePageData } from '@/lib/vocab/practice-data';
import { getSyllabusCatalogVersion } from '@/lib/vocab/syllabus-prompt';

const schema = z.object({
  prefs: z.object({
    definitionVariant: z.enum(['standard', 'alt']),
    showExample:       z.boolean(),
    showSynonyms:      z.boolean(),
    showConnotation:   z.boolean(),
    showContrast:      z.boolean(),
  }),
  syllabusIds: z.array(z.number().int().positive()).min(1).max(10),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }
  const { prefs, syllabusIds } = parsed.data;

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, session.user.email))
    .limit(1);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const [progress] = await db
    .select({ syllabusLocked: vocabUserProgress.syllabusLocked })
    .from(vocabUserProgress)
    .where(eq(vocabUserProgress.userId, user.id))
    .limit(1);
  if (!progress?.syllabusLocked) {
    return NextResponse.json({ error: 'Not locked' }, { status: 400 });
  }

  // Only syllabuses that actually exist — the id list is client-supplied.
  const valid = await db
    .select({ id: vocabSyllabuses.id })
    .from(vocabSyllabuses)
    .where(inArray(vocabSyllabuses.id, syllabusIds));
  if (valid.length === 0) {
    return NextResponse.json({ error: 'No valid syllabus selected' }, { status: 400 });
  }

  await db
    .update(vocabUserProgress)
    .set({
      cardDefinitionVariant: prefs.definitionVariant,
      cardShowExample:       prefs.showExample,
      cardShowSynonyms:      prefs.showSynonyms,
      cardShowConnotation:   prefs.showConnotation,
      cardShowContrast:      prefs.showContrast,
      syllabusLocked:        false,
      onboardingComplete:    true,
      onboardingCompletedAt: new Date(),
      // They're getting the current syllabus set fresh — nothing new to prompt about.
      lastAnnouncementSeen:  await getSyllabusCatalogVersion(),
      updatedAt:             new Date(),
    })
    .where(eq(vocabUserProgress.userId, user.id));

  // Replace, don't append: re-running this must not leave old tracks behind.
  await db.delete(vocabUserSyllabuses).where(eq(vocabUserSyllabuses.userId, user.id));
  await db.insert(vocabUserSyllabuses)
    .values(valid.map(s => ({ userId: user.id, syllabusId: s.id })));

  const email = session.user.email;
  revalidateTag(VocabCacheTag.home(email));
  revalidateTag(VocabCacheTag.study(email));
  revalidateTag(VocabCacheTag.practiceUi(email));
  revalidateTag(VocabCacheTag.letters(user.id));

  // Warm the caches after responding, so the first Home render is instant.
  after(async () => {
    await Promise.all([
      getHomeData(email).catch(() => null),
      getStudyData(email).catch(() => null),
      getPracticePageData(email).catch(() => null),
    ]);
  });

  return NextResponse.json({ ok: true });
}
