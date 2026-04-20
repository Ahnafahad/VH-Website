import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { db, users, vocabUserProgress } from '@/lib/db';
import { eq } from 'drizzle-orm';
import OnboardingFlow from './OnboardingFlow';

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/auth/signin?callbackUrl=/vocab');

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

  return <OnboardingFlow userId={user.id} userName={user.name} />;
}
