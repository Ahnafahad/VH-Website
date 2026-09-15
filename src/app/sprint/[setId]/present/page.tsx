/**
 * /sprint/[setId]/present — projector-facing instructor presenter mode.
 * Staff-only (admin | super_admin | instructor), full-screen, chrome hidden
 * (see MainSiteShell). Lives outside /admin so it isn't boxed in by the
 * admin sidebar layout — this screen needs the whole viewport.
 */

import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import SprintPresentScreen from '@/components/sprint/SprintPresentScreen';

export const dynamic = 'force-dynamic';
export const metadata = {
  robots: { index: false, follow: false },
};

export default async function SprintPresentPage({ params }: { params: Promise<{ setId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/auth/signin');

  const role = session.user.role;
  if (role !== 'admin' && role !== 'super_admin' && role !== 'instructor') {
    redirect('/');
  }

  const { setId } = await params;
  return <SprintPresentScreen setId={Number(setId)} />;
}
