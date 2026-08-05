import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { db, users, registrations } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { AVATAR_PICKER_ENABLED } from '@/lib/avatars/config';
import AvatarPickerModal from './AvatarPickerModal';

// Mirrors OnboardingGate's shape: a server component that decides whether to
// render at all, so the client bundle never has to reason about "should this
// show" — it just renders when mounted.
export default async function AvatarGate() {
  if (!AVATAR_PICKER_ENABLED) return null;

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
      avatarCharacterId: users.avatarCharacterId,
      avatarCustomRequest: users.avatarCustomRequest,
      avatarRequestStatus: users.avatarRequestStatus,
    })
    .from(users)
    .where(eq(users.email, email))
    .get();

  if (!row) return null;
  if (row.role !== 'student') return null;
  if (row.avatarCharacterId) return null; // already picked — permanent, done

  // A pending or approved custom write-in means the student already made
  // their choice and it's awaiting/received review. A rejected one lets them
  // pick again (from the catalogue or a new write-in).
  if (row.avatarCustomRequest && row.avatarRequestStatus !== 'rejected') return null;

  // Never stack on top of OnboardingModal. Both are full-screen and non-dismissible,
  // so if both mounted the student would clear the avatar picker only to find
  // onboarding underneath. Mirror OnboardingGate's own show-condition: while it
  // would render, we stand down and wait for the next page load.
  if (!row.onboardedAt) {
    const existingReg = await db
      .select({ id: registrations.id })
      .from(registrations)
      .where(eq(registrations.email, email))
      .limit(1);
    if (!existingReg.length) return null; // onboarding is showing — it goes first
  }

  return <AvatarPickerModal userName={row.name || session.user.name || ''} />;
}
