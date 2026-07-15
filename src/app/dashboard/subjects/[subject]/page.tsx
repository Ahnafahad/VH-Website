/**
 * /dashboard/subjects/[subject] — per-subject hub: lecture sheets, current/
 * previous homework, other materials, mock-test section performance.
 */

import { getServerSession } from 'next-auth';
import { redirect, notFound } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { getUserByEmail } from '@/lib/db-access-control';
import { getSubjectData, isLmsSubject, SUBJECT_LABELS } from '@/lib/lms/subject-data';
import SubjectDashboardScreen from '@/components/lms/SubjectDashboardScreen';

interface PageProps {
  params: Promise<{ subject: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { subject } = await params;
  if (!isLmsSubject(subject)) return { title: 'Subject — VH' };
  return { title: `${SUBJECT_LABELS[subject]} — VH` };
}

export default async function SubjectPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/auth/signin');

  const user = await getUserByEmail(session.user.email);
  if (!user) redirect('/auth/signin');

  const staff = user.role === 'admin' || user.role === 'super_admin' || user.role === 'instructor';
  if (!staff && user.products.length === 0) redirect('/dashboard');

  const { subject } = await params;
  if (!isLmsSubject(subject)) notFound();

  const data = await getSubjectData(user, subject);

  return <SubjectDashboardScreen data={data} />;
}
