/**
 * /admin/marathon/[chapterId]/days/[dayNumber]/attempts/[attemptId] — the
 * exact student results screen, read-only, for a single marathon attempt.
 * Staff-only drill-through from the day attendance list. Reuses
 * MarathonResultsScreen (the same component the student sees) rather than
 * duplicating it — only a banner is added so it can never be mistaken for
 * the viewer's own result. Mirrors /admin/tests/[id]/attempts/[attemptId].
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { marathonAttempts, marathonChapters, users } from '@/lib/db/schema';
import { getDayByNumber, getDayResults } from '@/lib/marathon/service';
import MarathonResultsScreen from '@/components/marathon/MarathonResultsScreen';

export default async function AdminMarathonAttemptPage({
  params,
}: {
  params: Promise<{ chapterId: string; dayNumber: string; attemptId: string }>;
}) {
  const { chapterId: chapterIdParam, dayNumber: dayNumberParam, attemptId: attemptIdParam } = await params;
  const chapterId = Number(chapterIdParam);
  const dayNumber = Number(dayNumberParam);
  const attemptId = Number(attemptIdParam);
  if (!Number.isInteger(chapterId) || !Number.isInteger(dayNumber) || !Number.isInteger(attemptId)) notFound();

  const chapter = await db.select().from(marathonChapters).where(eq(marathonChapters.id, chapterId)).get();
  if (!chapter) notFound();

  const day = await getDayByNumber(chapterId, dayNumber);
  if (!day) notFound();

  const attempt = await db.select().from(marathonAttempts).where(eq(marathonAttempts.id, attemptId)).get();
  if (!attempt || attempt.dayId !== day.id) notFound();

  const student = await db.select({ name: users.name, email: users.email, studentId: users.studentId })
    .from(users).where(eq(users.id, attempt.userId)).get();
  if (!student) notFound();

  const results = await getDayResults(chapter, day, attempt.userId);
  if (!results) notFound();

  return (
    <div>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          background: '#FEF3C7', border: '1px solid #F59E0B',
          borderRadius: 8, padding: '10px 16px', margin: '16px',
          fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: 13, color: '#92400E',
        }}
      >
        <ShieldAlert size={16} style={{ flexShrink: 0 }} />
        <span>
          <strong>ADMIN VIEW (read-only)</strong> — viewing {student.name ?? student.email}
          {student.studentId ? ` (${student.studentId})` : ''}&apos;s result for &quot;{chapter.title}&quot;, Day {dayNumber}. This is not your own result.
        </span>
        <Link
          href={`/admin/marathon/${chapterId}/days/${dayNumber}`}
          style={{ marginLeft: 'auto', color: '#92400E', fontWeight: 600, whiteSpace: 'nowrap' }}
        >
          ← Back to Day {dayNumber}
        </Link>
      </div>
      <MarathonResultsScreen results={results} />
    </div>
  );
}
