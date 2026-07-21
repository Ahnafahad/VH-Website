import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import ClassesClient from '@/components/admin/lms/ClassesClient';
import type { ClassSession, ClassSchedule, TeachingUser } from '@/components/admin/lms/ClassesClient';
import { adminApiFetch } from '@/lib/lms/admin-fetch';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Classes | Admin' };

export default async function ClassesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/auth/signin');

  const [sessionsRes, schedulesRes, teachingUsers] = await Promise.all([
    adminApiFetch('/api/lms/admin/classes'),
    adminApiFetch('/api/lms/admin/schedules'),
    db.select({ id: users.id, name: users.name }).from(users).where(eq(users.isTeaching, true)),
  ]);

  const initialSessions: ClassSession[]   = sessionsRes.ok   ? await sessionsRes.json()   as ClassSession[]   : [];
  const initialSchedules: ClassSchedule[] = schedulesRes.ok  ? await schedulesRes.json()  as ClassSchedule[]  : [];

  return (
    <ClassesClient
      initialSessions={initialSessions}
      initialSchedules={initialSchedules}
      teachingUsers={teachingUsers as TeachingUser[]}
    />
  );
}
