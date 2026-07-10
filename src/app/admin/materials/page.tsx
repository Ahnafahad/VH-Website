import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import MaterialsClient from '@/components/admin/lms/MaterialsClient';
import type { Material } from '@/components/admin/lms/MaterialsClient';
import type { ClassSession } from '@/components/admin/lms/ClassesClient';
import { adminApiFetch } from '@/lib/lms/admin-fetch';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Materials | Admin' };

export default async function MaterialsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/auth/signin');

  const [matRes, sessRes] = await Promise.all([
    adminApiFetch('/api/lms/admin/materials'),
    adminApiFetch('/api/lms/admin/classes'),
  ]);

  const initialMaterials: Material[]    = matRes.ok  ? await matRes.json()  as Material[]    : [];
  const sessions:          ClassSession[] = sessRes.ok ? await sessRes.json() as ClassSession[] : [];

  return <MaterialsClient initialMaterials={initialMaterials} sessions={sessions} />;
}
