/**
 * /dashboard/classes — student "all classes" calendar.
 * Server component: session guard → resolve active product → fetch all
 * scoped sessions → render the calendar client.
 */

import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { getUserByEmail } from '@/lib/db-access-control';
import { getAllClasses } from '@/lib/lms/all-classes';
import ClassesCalendarClient from '@/components/lms/ClassesCalendarClient';
import type { UserProduct } from '@/lib/db/schema';

export const metadata = { title: 'My Classes — VH' };

interface PageProps {
  searchParams: Promise<{ product?: string }>;
}

export default async function AllClassesPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/auth/signin');

  const user = await getUserByEmail(session.user.email);
  if (!user) redirect('/auth/signin');

  const { product: requestedProduct } = await searchParams;
  const activeProduct: UserProduct | undefined =
    requestedProduct && user.products.includes(requestedProduct as UserProduct)
      ? (requestedProduct as UserProduct)
      : user.products[0];

  if (!activeProduct) redirect('/dashboard');

  const classes = await getAllClasses(user, activeProduct);

  return (
    <ClassesCalendarClient
      classes={classes}
      products={user.products}
      activeProduct={activeProduct}
    />
  );
}
