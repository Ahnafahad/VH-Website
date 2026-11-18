import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import MockReportsClient from '@/components/admin/lms/MockReportsClient';
import { authOptions } from '@/lib/auth';
import { isAdminRole } from '@/lib/auth/roles';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mock Reports | Admin' };

export default async function MockReportsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/auth/signin');
  if (!isAdminRole(session.user.role)) redirect('/admin/mocks');

  return <MockReportsClient />;
}
