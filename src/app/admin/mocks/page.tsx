import MocksAdminClient from '@/components/admin/lms/MocksAdminClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mocks | Admin' };

// Staff gating is enforced by app/admin/layout.tsx and by requireStaff() on every /api/admin/mocks route.
export default function MocksAdminPage() {
  return <MocksAdminClient />;
}
