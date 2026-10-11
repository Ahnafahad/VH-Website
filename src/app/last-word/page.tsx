import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import LastWordGame from '@/features/last-word/LastWordGame';
import { loadContent, loadPlayableSets, selectPlayable } from '@/features/last-word/content/load';
import { reviewStatuses } from '@/features/last-word/content/schema';
import { authOptions } from '@/lib/auth';
import { isStaffRole } from '@/lib/auth/roles';
import { getUserByEmail } from '@/lib/db-access-control';

const og = '/last-word/assets/images/og-last-word.png';
export const metadata: Metadata = {
  title: 'Last Word',
  description: 'Follow the context. Find the word that fits now.',
  ...(existsSync(join(process.cwd(), 'public', og)) ? { openGraph: { images: [og] } } : {}),
};

/** `?preview=<set_id>` lets staff play a set that is not yet approved; players never see it. */
export default async function LastWordPage({ searchParams }: { searchParams: Promise<{ preview?: string }> }) {
  const { preview } = await searchParams;
  let sets = loadPlayableSets();
  if (preview) {
    const email = (await getServerSession(authOptions))?.user?.email;
    const user = email ? await getUserByEmail(email.toLowerCase()) : null;
    const extra = isStaffRole(user?.role) ? selectPlayable(loadContent(), reviewStatuses).find(set => set.set_id === preview) : undefined;
    if (extra) sets = [extra, ...sets.filter(set => set.set_id !== preview)];
  }
  return <LastWordGame sets={sets} />;
}
