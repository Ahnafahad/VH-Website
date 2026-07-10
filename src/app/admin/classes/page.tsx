import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ClassesClient from '@/components/admin/lms/ClassesClient';
import type { ClassSession, ClassSchedule } from '@/components/admin/lms/ClassesClient';
import { adminApiFetch } from '@/lib/lms/admin-fetch';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Classes | Admin' };

export default async function ClassesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/auth/signin');

  const [sessionsRes, schedulesRes] = await Promise.all([
    adminApiFetch('/api/lms/admin/classes'),
    adminApiFetch('/api/lms/admin/schedules'),
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
