/**
 * /dashboard/book — Student 1-on-1 session requests.
 * Server component: auth guard → fetch my requests → render client.
 */

import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserByEmail } from '@/lib/db-access-control';
import { isStaffRole } from '@/lib/auth/roles';
import { listMine, requestableSubjects } from '@/lib/booking/service';
import BookingClient from '@/components/lms/BookingClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: '1-on-1 Sessions — VH' };

export default async function BookPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/auth/signin');

  const user = await getUserByEmail(session.user.email);
  if (!user) redirect('/auth/signin');

  // Students need at least one product to access LMS
  if (!isStaffRole(user.role) && user.products.length === 0) redirect('/dashboard');

  return (
    <BookingClient
      initialRequests={await listMine(user)}
      subjects={requestableSubjects(user)}
    />
  );
}
