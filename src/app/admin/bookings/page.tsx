/**
 * /admin/bookings — 1-on-1 session requests for the signed-in instructor.
 * Server component: staff auth guard → fetch the requests they can handle → render client.
 */

import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getUserByEmail } from '@/lib/db-access-control';
import { isStaffRole, isSuperAdminRole } from '@/lib/auth/roles';
import { listForStaff } from '@/lib/booking/service';
import BookingsClient from '@/components/admin/lms/BookingsClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Bookings | Admin' };

export default async function BookingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/auth/signin');

  const user = await getUserByEmail(session.user.email);
  if (!user || !isStaffRole(user.role)) redirect('/dashboard');

  return (
    <BookingsClient
      initialRequests={await listForStaff(user)}
      meId={user.id}
      isSuperAdmin={isSuperAdminRole(user.role)}
    />
  );
}
