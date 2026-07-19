import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import DiagnosisFbsClient from '@/components/admin/diagnosis/DiagnosisFbsClient';

export const metadata = { title: 'Diagnosis FBS — VH Admin' };

export default async function AdminDiagnosisFbsPage() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  if (!role || (role !== 'admin' && role !== 'super_admin' && role !== 'instructor')) {
    redirect('/auth/signin');
  }

  return <DiagnosisFbsClient />;
}
