import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { db, users, vocabUserProgress, vocabSyllabuses, vocabWordSyllabuses } from '@/lib/db';
import { eq, asc, count } from 'drizzle-orm';
import OnboardingFlow, { type TrackOption } from './OnboardingFlow';

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/lexicore');

  const [user] = await db
    .select({ id: users.id, name: users.name, role: users.role })
    .from(users)
    .where(eq(users.email, session.user.email))
    .limit(1);

  if (!user) redirect('/auth/signin');

  const [progress] = await db
    .select({ onboardingComplete: vocabUserProgress.onboardingComplete })
    .from(vocabUserProgress)
    .where(eq(vocabUserProgress.userId, user.id))
    .limit(1);

  if (progress?.onboardingComplete) redirect('/vocab/home');

  // Staff skip the onboarding flow entirely — auto-complete + redirect to home.
  const isStaff = user.role === 'admin' || user.role === 'super_admin' || user.role === 'instructor';
  if (isStaff) {
    await db
      .insert(vocabUserProgress)
      .values({
        userId:             user.id,
        phase:              2,
        deadline:           null,
        dailyTarget:        5,
        onboardingComplete: true,
      })
      .onConflictDoUpdate({
        target: vocabUserProgress.userId,
        set:    { onboardingComplete: true, updatedAt: new Date() },
      });
    redirect('/vocab/home');
  }

  // Tracks come from the DB, never a hardcoded list — adding a syllabus is a
  // data change, not a code change.
  const tracks: TrackOption[] = await db
    .select({
      id:          vocabSyllabuses.id,
      name:        vocabSyllabuses.name,
      description: vocabSyllabuses.description,
      trialWords:  vocabSyllabuses.trialWordCount,
      totalWords:  count(vocabWordSyllabuses.wordId),
    })
    .from(vocabSyllabuses)
    .leftJoin(vocabWordSyllabuses, eq(vocabWordSyllabuses.syllabusId, vocabSyllabuses.id))
    .groupBy(vocabSyllabuses.id)
    .orderBy(asc(vocabSyllabuses.order), asc(vocabSyllabuses.id));

  return <OnboardingFlow userName={user.name} tracks={tracks} />;
}

// Onboarding reads live per-user state; never serve it from the route cache.
export const dynamic = 'force-dynamic';