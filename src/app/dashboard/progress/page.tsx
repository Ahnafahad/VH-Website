import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { authOptions } from '@/lib/auth';
import { getUserByEmail } from '@/lib/db-access-control';
import { getStudentMetricsForUser } from '@/lib/students/student-metrics';
import StudentMetricsPanel from '@/components/students/StudentMetricsPanel';

export const metadata = { title: 'My Progress — VH' };

// Student-facing mirror of the admin progress view — same computation module
// (getStudentMetricsForUser), same presentational component
// (StudentMetricsPanel), scoped to the signed-in user's own id.
export default async function StudentProgressPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/auth/signin');

  const user = await getUserByEmail(session.user.email);
  if (!user) redirect('/auth/signin');

  const full = await getStudentMetricsForUser(user.id);

  return (
    <main style={{ minHeight: '100vh', background: '#FAFAFA', padding: '32px 16px 64px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <Link
          href="/dashboard"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6B7280', fontWeight: 500, marginBottom: 16, textDecoration: 'none' }}
        >
          <ArrowLeft size={14} aria-hidden /> Back to Dashboard
        </Link>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', marginBottom: 20, letterSpacing: '-0.02em' }}>
          My Progress
        </h1>
        {full
          ? <StudentMetricsPanel metrics={full.testMetrics} lexicore={full.lexicore} />
          : <p style={{ fontSize: 13, color: '#9CA3AF' }}>No progress data available yet.</p>}
      </div>
    </main>
  );
}
