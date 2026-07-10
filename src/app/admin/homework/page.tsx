import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import HomeworkClient from '@/components/admin/lms/HomeworkClient';
import type { Assignment, MaterialOption } from '@/components/admin/lms/HomeworkClient';
import type { ClassSession } from '@/components/admin/lms/ClassesClient';
import { adminApiFetch } from '@/lib/lms/admin-fetch';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Homework | Admin' };

export default async function HomeworkPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/auth/signin');

  const [assignRes, sessRes, matsRes] = await Promise.all([
    adminApiFetch('/api/lms/admin/assignments'),
    adminApiFetch('/api/lms/admin/classes'),
    adminApiFetch('/api/lms/admin/materials'),
  ]);

  const initialAssignments: Assignment[] = assignRes.ok ? await assignRes.json() as Assignment[] : [];
  const sessions: ClassSession[]         = sessRes.ok  ? await sessRes.json()  as ClassSession[] : [];
  const allMaterials: MaterialOption[]   = matsRes.ok  ? (await matsRes.json() as MaterialOption[]).filter((m) => m.type === 'pdf') : [];

  return (
    <HomeworkClient
      initialAssignments={initialAssignments}
      sessions={sessions}
      allMaterials={allMaterials}
    />
  );
}
