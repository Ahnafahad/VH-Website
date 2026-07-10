import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import TodayClient from '@/components/admin/lms/TodayClient';
import { adminApiFetch } from '@/lib/lms/admin-fetch';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Today | Admin' };

export default async function TodayPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/auth/signin');

  // Fetch today's sessions server-side so the page has data on first paint
  let data = { sessions: [] as Parameters<typeof TodayClient>[0]['initial']['sessions'], assignmentsDue48h: 0 };
  try {
    const res = await adminApiFetch('/api/lms/admin/today');
    if (res.ok) {
      const json = await res.json() as typeof data;
      data = json;
    }
  } catch {
    // render empty state; client can refresh
  }

  return <TodayClient initial={data} sessions={data.sessions} />;
}
