import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { isOperationalAdmin } from '@/lib/lms/operations';
import { requireOperationalAdmin } from '@/lib/lms/operations-auth';
import OperationalAdminClient from '@/components/admin/lms/OperationalAdminClient';

export const metadata = { title: 'Operational Admin — VH Admin' };
export const dynamic = 'force-dynamic';

export default async function OperationalAdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/auth/signin');
  if (!isOperationalAdmin(session.user.role)) redirect('/admin');
  await requireOperationalAdmin();
  return <OperationalAdminClient />;
}
