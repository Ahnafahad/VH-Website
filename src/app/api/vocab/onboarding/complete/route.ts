import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { after } from 'next/server';
import { revalidateTag } from 'next/cache';
import { authOptions } from '@/lib/auth';
import { db, users, vocabUserProgress } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { VocabCacheTag } from '@/lib/vocab/cache-keys';
import { getHomeData } from '@/lib/vocab/home-data';
import { getStudyData } from '@/lib/vocab/study-data';
import { getPracticePageData } from '@/lib/vocab/practice-data';

const schema = z.object({
  deadline:    z.string().datetime().optional(),
  wordsPerDay: z.number().int().positive().optional(),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, session.user.email))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const deadline     = parsed.data.deadline ? new Date(parsed.data.deadline) : null;
  const daysUntil    = deadline
    ? Math.max(1, Math.ceil((deadline.getTime() - Date.now()) / 86400000))
    : 30; // sensible default when no deadline provided
  // wordsPerDay, if provided by the client, caps/floors the server-computed target
  const computedTarget = Math.ceil(800 / daysUntil);
  const dailyTarget    = parsed.data.wordsPerDay
    ? Math.max(1, Math.min(parsed.data.wordsPerDay, 800))
    : computedTarget;

  // Determine phase based on cut-off date setting
  // Default to phase 2 for new users; admins can upgrade
  await db
    .insert(vocabUserProgress)
    .values({
      userId:             user.id,
      phase:              2,
      deadline,
      dailyTarget,
      onboardingComplete: true,
    })
    .onConflictDoUpdate({
      target: vocabUserProgress.userId,
      set: {
        deadline,
        dailyTarget,
        onboardingComplete: true,
        updatedAt:          new Date(),
      },
    });

  const email = session.user.email;

  // Invalidate any stale cache entries for this user
  revalidateTag(VocabCacheTag.home(email));
  revalidateTag(VocabCacheTag.study(email));
  revalidateTag(VocabCacheTag.practiceUi(email));

  // After response is sent, warm all three caches so first navigation is instant
  after(async () => {
    await Promise.all([
      getHomeData(email).catch(() => null),
      getStudyData(email).catch(() => null),
      getPracticePageData(email).catch(() => null),
    ]);
  });

  return NextResponse.json({ ok: true });
}
