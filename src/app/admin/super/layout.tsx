import { requireSuperAdminPage } from '@/lib/super/guard';

// Gate for every /admin/super/* page. API routes under /api/admin/super use requireSuperAdmin().
export default async function SuperLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdminPage();
  return <>{children}</>;
}
