import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { db, users, vocabUserProgress } from '@/lib/db';
import { eq } from 'drizzle-orm';

export default async function VocabIndexPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/auth/signin?callbackUrl=/vocab');

  // Find user in Turso
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, session.user.email))
    .limit(1);

  if (!user) redirect('/auth/signin');

  // Check onboarding status
  const [progress] = await db
    .select({ onboardingComplete: vocabUserProgress.onboardingComplete })
    .from(vocabUserProgress)
    .where(eq(vocabUserProgress.userId, user.id))
    .limit(1);

  if (!progress?.onboardingComplete) {
    redirect('/vocab/onboarding');
  }

  redirect('/vocab/home');
}
