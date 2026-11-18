import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { isAdminRole } from '@/lib/auth/roles';
import LexicoreClaimsClient from '@/components/admin/lms/LexicoreClaimsClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'LexiCore claims | Admin' };

// Admin tier only (instructors excluded); the API route enforces the same gate.
export default async function LexicoreClaimsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/auth/signin');
  if (!isAdminRole(session.user.role)) redirect('/admin');
  return <LexicoreClaimsClient />;
}
