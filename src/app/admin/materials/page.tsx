import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import MaterialsClient from '@/components/admin/lms/MaterialsClient';
import type { Material } from '@/components/admin/lms/MaterialsClient';
import type { ClassSession } from '@/components/admin/lms/ClassesClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Materials | Admin' };

export default async function MaterialsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/auth/signin');

  const base = process.env.NEXTAUTH_URL ?? 'http://localhost:6960';

  const [matRes, sessRes] = await Promise.all([
    fetch(`${base}/api/lms/admin/materials`,  { cache: 'no-store' }),
    fetch(`${base}/api/lms/admin/classes`,    { cache: 'no-store' }),
  ]);

  const initialMaterials: Material[]    = matRes.ok  ? await matRes.json()  as Material[]    : [];
  const sessions:          ClassSession[] = sessRes.ok ? await sessRes.json() as ClassSession[] : [];

  return <MaterialsClient initialMaterials={initialMaterials} sessions={sessions} />;
}
