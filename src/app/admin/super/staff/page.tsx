import StaffClient from '@/components/admin/super/people/StaffClient';

export const metadata = { title: 'Staff - Super Admin' };
export const dynamic = 'force-dynamic';

export default function SuperStaffPage() {
  return <StaffClient />;
}
