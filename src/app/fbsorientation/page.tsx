/**
 * /fbsorientation — FBS orientation deck.
 * Staff-only (admin | super_admin | instructor), not linked from any nav.
 */

import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'FBS Orientation',
  robots: { index: false, follow: false },
};

export default async function FbsOrientationPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/auth/signin');

  const role = session.user.role;
  if (role !== 'admin' && role !== 'super_admin' && role !== 'instructor') {
    redirect('/');
  }

  return (
    <iframe
      src="/fbsorientation-assets/index.html"
      title="FBS Orientation"
      style={{ position: 'fixed', inset: 0, width: '100vw', height: '100dvh', border: 0 }}
    />
  );
}
