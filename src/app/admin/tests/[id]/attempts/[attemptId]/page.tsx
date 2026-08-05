/**
 * /admin/tests/[id]/attempts/[attemptId] — the exact student result page,
 * read-only, for a single attempt. Staff-only drill-through from the Test
 * Analytics tab. Reuses ResultsShell (the same component the student sees)
 * rather than duplicating it — only a banner is added so it can never be
 * mistaken for the viewer's own result.
 */

import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { testAttempts, tests, users } from '@/lib/db/schema';
import { isStaffRole } from '@/lib/auth/roles';
import { getTestResults } from '@/lib/tests/service';
import ResultsShell from '@/components/tests/results/ResultsShell';
import type { ResultsPayload } from '@/lib/tests/types';

interface PageProps {
  params: Promise<{ id: string; attemptId: string }>;
}

export default async function AdminAttemptResultPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isStaffRole(session.user.role)) {
    redirect('/auth/signin');
  }

  const { attemptId: attemptIdParam } = await params;
  const attemptId = Number(attemptIdParam);
  if (Number.isNaN(attemptId)) notFound();

  const attempt = await db.select().from(testAttempts).where(eq(testAttempts.id, attemptId)).get();
  if (!attempt) notFound();

  const [test, student] = await Promise.all([
    db.select().from(tests).where(eq(tests.id, attempt.testId)).get(),
    db.select({ name: users.name, email: users.email, studentId: users.studentId })
      .from(users).where(eq(users.id, attempt.userId)).get(),
  ]);
  if (!test || !student) notFound();

  const results = await getTestResults(test.id, attempt.userId);
  if (!results) notFound();

  return (
    <div>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          background: '#FEF3C7', border: '1px solid #F59E0B',
          borderRadius: 8, padding: '10px 16px', marginBottom: 16,
          fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: 13, color: '#92400E',
        }}
      >
        <ShieldAlert size={16} style={{ flexShrink: 0 }} />
        <span>
          <strong>ADMIN VIEW (read-only)</strong> — viewing {student.name ?? student.email}
          {student.studentId ? ` (${student.studentId})` : ''}&apos;s result for &quot;{test.title}&quot;. This is not your own result.
        </span>
        <Link
          href="/admin/tests"
          style={{ marginLeft: 'auto', color: '#92400E', fontWeight: 600, whiteSpace: 'nowrap' }}
        >
          ← Back to Tests
        </Link>
      </div>
      <ResultsShell status="ok" data={results as ResultsPayload} errorMsg="" />
    </div>
  );
}
