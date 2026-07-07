import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { getUserByEmail } from '@/lib/db-access-control';
import { getDashboardData } from '@/lib/lms/dashboard-data';
import DashboardScreen from '@/components/lms/DashboardScreen';

export const metadata = { title: 'Dashboard — VH' };

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/auth/signin');

  const user = await getUserByEmail(session.user.email);
  if (!user) redirect('/auth/signin');

  const data = await getDashboardData(user);

  return (
    <DashboardScreen
      data={data}
      userName={user.name ?? session.user.name ?? 'Student'}
    />
  );
}
