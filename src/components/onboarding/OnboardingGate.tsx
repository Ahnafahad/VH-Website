import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { db, users, registrations } from '@/lib/db';
import { eq } from 'drizzle-orm';
import OnboardingModal from './OnboardingModal';

export default async function OnboardingGate() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;

  const email = session.user.email.toLowerCase();
  const role = session.user.role;
  if (role && role !== 'student') return null;

  const row = await db
    .select({
      id: users.id,
      name: users.name,
      role: users.role,
      onboardedAt: users.onboardedAt,
      onboardingSkips: users.onboardingSkips,
    })
    .from(users)
    .where(eq(users.email, email))
    .get();

  if (!row) return null;
  if (row.role !== 'student') return null;
  if (row.onboardedAt) return null;

  const existingReg = await db
    .select({ id: registrations.id })
    .from(registrations)
    .where(eq(registrations.email, email))
    .limit(1);

  if (existingReg.length) return null;

  const skips = row.onboardingSkips ?? 0;
  const mustSubmit = skips >= 3;

  return (
    <OnboardingModal
      needsOnboarding={true}
      mustSubmit={mustSubmit}
      userName={row.name || session.user.name || ''}
      initialSkips={skips}
    />
  );
}
