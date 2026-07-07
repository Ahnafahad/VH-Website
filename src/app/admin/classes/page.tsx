import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ClassesClient from '@/components/admin/lms/ClassesClient';
import type { ClassSession, ClassSchedule } from '@/components/admin/lms/ClassesClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Classes | Admin' };

export default async function ClassesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/auth/signin');

  const base = process.env.NEXTAUTH_URL ?? 'http://localhost:6960';

  const [sessionsRes, schedulesRes] = await Promise.all([
    fetch(`${base}/api/lms/admin/classes`, { cache: 'no-store' }),
    fetch(`${base}/api/lms/admin/schedules`, { cache: 'no-store' }),
  ]);

  const initialSessions: ClassSession[]   = sessionsRes.ok   ? await sessionsRes.json()   as ClassSession[]   : [];
  const initialSchedules: ClassSchedule[] = schedulesRes.ok  ? await schedulesRes.json()  as ClassSchedule[]  : [];

  return (
    <ClassesClient
      initialSessions={initialSessions}
      initialSchedules={initialSchedules}
    />
  );
}
