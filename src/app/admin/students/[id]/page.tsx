import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { getStudentDetail } from '@/lib/students/progress';
import StudentDetailClient from '@/components/admin/students/StudentDetailClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const detail = await getStudentDetail(Number(id));
  return { title: detail ? `${detail.profile.name} — Progress — VH Admin` : 'Student Progress — VH Admin' };
}

export default async function AdminStudentDetailPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  if (!role || (role !== 'admin' && role !== 'super_admin' && role !== 'instructor')) {
    redirect('/auth/signin');
  }

  const { id } = await params;
  const detail = await getStudentDetail(Number(id));
  if (!detail) notFound();

  return <StudentDetailClient detail={detail} />;
}
