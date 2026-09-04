/**
 * POST /api/vocab/onboarding/complete
 *
 * Ends onboarding: persists the card style the user picked, the syllabuses
 * they chose to study, and their deadline/pace. Idempotent — a repeat call
 * (double submit, back button, retried request) overwrites the same row and
 * re-syncs the same syllabus set rather than erroring or duplicating.
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
  deadline:    z.string().datetime().nullable().optional(),
  wordsPerDay: z.number().int().min(1).max(100),
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
  const { prefs, syllabusIds, wordsPerDay } = parsed.data;

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, session.user.email))
    .limit(1);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // Only syllabuses that actually exist — the id list is client-supplied.
  const valid = await db
    .select({ id: vocabSyllabuses.id })
    .from(vocabSyllabuses)
    .where(inArray(vocabSyllabuses.id, syllabusIds));
  if (valid.length === 0) {
    return NextResponse.json({ error: 'No valid syllabus selected' }, { status: 400 });
  }

  const deadline = parsed.data.deadline ? new Date(parsed.data.deadline) : null;
  const row = {
    deadline,
    dailyTarget:           wordsPerDay,
    cardDefinitionVariant: prefs.definitionVariant,
    cardShowExample:       prefs.showExample,
    cardShowSynonyms:      prefs.showSynonyms,
    cardShowConnotation:   prefs.showConnotation,
    cardShowContrast:      prefs.showContrast,
    onboardingComplete:    true,
    onboardingCompletedAt: new Date(),
    activatedAt:           new Date(),
    // They're getting the current syllabus set fresh — nothing new to prompt about.
    lastAnnouncementSeen:  await getSyllabusCatalogVersion(),
  };

  await db
    .insert(vocabUserProgress)
    .values({ userId: user.id, phase: 2, ...row })
    .onConflictDoUpdate({
      target: vocabUserProgress.userId,
      set:    { ...row, updatedAt: new Date() },
    });

  // Replace, don't append: re-running onboarding must not leave old tracks behind.
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
