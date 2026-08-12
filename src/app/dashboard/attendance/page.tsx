import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { authOptions } from '@/lib/auth';
import { getUserByEmail } from '@/lib/db-access-control';
import { db } from '@/lib/db';
import { computeStudentAttendanceSummary } from '@/lib/lms/attendance-summary';
import { ONLINE_ATTENDANCE_CAP } from '@/lib/lms/attendance-cap';
import StudentAttendancePanel from '@/components/lms/StudentAttendancePanel';
import { BG, FONT_HEADING, SLATE, T_BASE, T_XL } from '@/components/admin/lms/tokens';

export const metadata = { title: 'My Attendance — VH' };

// Student-facing mirror of the manual attendance sheet's per-student figures:
// online attendances used of the cap, how many remain, and how many times
// absent (absence = the absence of a class_attendance row, computed against
// the sessions the student was expected at — see attendance-summary.ts).
export default async function StudentAttendancePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/auth/signin');

  const user = await getUserByEmail(session.user.email);
  if (!user) redirect('/auth/signin');

  const summary = await computeStudentAttendanceSummary(db, user);

  return (
    <main style={{ minHeight: '100vh', background: SLATE, padding: '32px 16px 64px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <Link
          href="/dashboard"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: T_BASE, color: 'rgba(250,245,239,0.64)', fontWeight: 500, marginBottom: 16, textDecoration: 'none' }}
        >
          <ArrowLeft size={14} aria-hidden /> Back to Dashboard
        </Link>
        <h1 style={{ fontFamily: FONT_HEADING, fontSize: T_XL, fontWeight: 700, color: BG, marginBottom: 20, letterSpacing: '-0.02em' }}>
          My Attendance
        </h1>
        <StudentAttendancePanel products={summary} cap={ONLINE_ATTENDANCE_CAP} />
      </div>
    </main>
  );
}
