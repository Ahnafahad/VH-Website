/**
 * /admin/tests/[id] — dedicated page for one test: stat strip, score histogram,
 * and the Overview / Windows / Attempts / Analytics / Settings / Answer key tabs.
 * Staff-only (admin, super_admin, instructor); the answer key tab and test
 * deletion are admin-only inside the panels (and enforced by their APIs).
 */

import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { isAdminRole, isStaffRole } from '@/lib/auth/roles';
import TestDetailPage from '@/components/admin/tests/TestDetailPage';
import { parseTab } from '@/lib/tests/detail-tabs';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function AdminTestRoute({ params, searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isStaffRole(session.user.role)) {
    redirect('/auth/signin');
  }

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const { tab } = await searchParams;

  return (
    <TestDetailPage
      testId={id}
      isAdmin={isAdminRole(session.user.role)}
      initialTab={parseTab(tab)}
    />
  );
}
