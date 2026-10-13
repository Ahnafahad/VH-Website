import StudentsClient from '@/components/admin/super/people/StudentsClient';

export const metadata = { title: 'Student control - Super Admin' };
export const dynamic = 'force-dynamic';

export default function SuperStudentsPage() {
  return <StudentsClient />;
}
