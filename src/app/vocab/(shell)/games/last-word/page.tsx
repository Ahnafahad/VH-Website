import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import LastWordGame from '@/features/last-word/LastWordGame';
import { loadContent, selectPlayable } from '@/features/last-word/content/load';
import { reviewStatuses, type LastWordSet } from '@/features/last-word/content/schema';
import { authOptions } from '@/lib/auth';
import { isStaffRole } from '@/lib/auth/roles';
import { getUserByEmail } from '@/lib/db-access-control';

export const metadata: Metadata = {
  title: 'Last Word',
  description: 'Follow the context. Find the word that fits now.',
};

/** `?preview=<set_id>` lets staff play a set that is not yet approved; players never see it. */
export default async function LastWordPage({ searchParams }: { searchParams: Promise<{ preview?: string }> }) {
  const { preview } = await searchParams;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    const next = `/vocab/games/last-word${preview ? `?preview=${encodeURIComponent(preview)}` : ''}`;
    redirect(`/registration/games?next=${encodeURIComponent(next)}`);
  }
  let extra: LastWordSet | undefined;
  if (preview) {
    const user = await getUserByEmail(session.user.email.toLowerCase());
    extra = isStaffRole(user?.role) ? selectPlayable(loadContent(), reviewStatuses).find(set => set.set_id === preview) : undefined;
  }
  return <LastWordGame preview={extra ? [extra] : undefined} />;
}
