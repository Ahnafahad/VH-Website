import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import TodayClient from '@/components/admin/lms/TodayClient';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Today | Admin' };

export default async function TodayPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/auth/signin');

  // Fetch today's sessions server-side so the page has data on first paint
  let data = { sessions: [] as Parameters<typeof TodayClient>[0]['initial']['sessions'], assignmentsDue48h: 0 };
  try {
    // We can't easily call our own internal handler in RSC without the auth cookie,
    // so we call the public fetch URL relative to the base — but in a server
    // component we have access to cookies, so we construct the URL manually.
    // In production Next.js the NEXTAUTH_URL env is always set.
    const base = process.env.NEXTAUTH_URL ?? 'http://localhost:6960';
    const res = await fetch(`${base}/api/lms/admin/today`, {
      headers: { cookie: '' }, // will be served via layout auth guard
      cache: 'no-store',
    });
    if (res.ok) {
      const json = await res.json() as typeof data;
      data = json;
    }
  } catch {
    // render empty state; client can refresh
  }

  return <TodayClient initial={data} sessions={data.sessions} />;
}
