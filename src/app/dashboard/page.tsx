import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { getUserByEmail } from '@/lib/db-access-control';
import { getDashboardData } from '@/lib/lms/dashboard-data';
import DashboardScreen from '@/components/lms/DashboardScreen';
import type { UserProduct } from '@/lib/db/schema';

export const metadata = { title: 'Dashboard — VH' };

interface PageProps {
  searchParams: Promise<{ product?: string }>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/auth/signin');

  const user = await getUserByEmail(session.user.email);
  if (!user) redirect('/auth/signin');

  // Multi-product students can switch which product's dashboard they see via
  // ?product=; invalid/missing values fall back to their first product.
  const { product: requestedProduct } = await searchParams;
  const activeProduct: UserProduct | undefined =
    requestedProduct && user.products.includes(requestedProduct as UserProduct)
      ? (requestedProduct as UserProduct)
      : user.products[0];

  const data = await getDashboardData(user, activeProduct);

  return (
    <DashboardScreen
      data={data}
      userName={user.name ?? session.user.name ?? 'Student'}
      studentId={user.studentId}
      userId={user.id}
      products={user.products}
      activeProduct={activeProduct}
    />
  );
}
