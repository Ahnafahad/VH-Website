import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { listBatches, getBatchSummaries } from '@/lib/students/progress';
import StudentsProgressClient from '@/components/admin/students/StudentsProgressClient';
import { getAtRiskStudents, type AtRiskStudent } from '@/lib/students/at-risk';

export const metadata = { title: 'Students Progress — VH Admin' };

export default async function AdminStudentsPage() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  if (!role || (role !== 'admin' && role !== 'super_admin' && role !== 'instructor')) {
    redirect('/auth/signin');
  }

  const [{ batches, defaultBatch }, atRiskStudents] = await Promise.all([
    listBatches(),
    getAtRiskStudents().catch(() => [] as AtRiskStudent[]),
  ]);
  const initial = defaultBatch ? await getBatchSummaries(defaultBatch) : { batch: '', students: [] };

  return (
    <StudentsProgressClient
      initialBatches={batches}
      initialBatch={defaultBatch}
      initialStudents={initial.students}
      atRiskStudents={atRiskStudents}
    />
  );
}
