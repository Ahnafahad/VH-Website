/**
 * /admin/marathon/[chapterId]/days/[dayNumber] — attendance stats + individual
 * attempt list for one marathon day. Submitted attempts link through to the
 * exact student result view; in-progress attempts are listed but not clickable.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getDayByNumber, getDayAttendance, getDayQuestionStats } from '@/lib/marathon/service';
import { marathonChapters } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

function formatClock(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

export default async function MarathonDayAdminPage({
  params,
}: {
  params: Promise<{ chapterId: string; dayNumber: string }>;
}) {
  const { chapterId: chapterIdParam, dayNumber: dayNumberParam } = await params;
  const chapterId = Number(chapterIdParam);
  const dayNumber = Number(dayNumberParam);
  if (!Number.isInteger(chapterId) || !Number.isInteger(dayNumber)) notFound();

  const chapter = await db.select().from(marathonChapters).where(eq(marathonChapters.id, chapterId)).get();
  if (!chapter) notFound();

  const day = await getDayByNumber(chapterId, dayNumber);
  if (!day) notFound();

  const attendance = await getDayAttendance(day.id);
  if (!attendance) notFound();

  const questionStats = await getDayQuestionStats(day.id);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <Link href={`/admin/marathon/${chapterId}`} className="text-sm text-muted-foreground hover:underline">← Back to {chapter.title}</Link>
      <h1 className="text-2xl font-semibold mt-2 mb-1">{chapter.title} · Day {dayNumber}</h1>
      <div className="flex gap-6 text-sm mb-8">
        <p><span className="font-semibold">{attendance.attendedCount}/{attendance.eligibleCount}</span> <span className="text-muted-foreground">attended</span></p>
        <p><span className="font-semibold">{attendance.averageActiveMs != null ? formatClock(attendance.averageActiveMs) : '—'}</span> <span className="text-muted-foreground">average time</span></p>
      </div>

      <div className="border rounded-xl divide-y">
        {attendance.attempts.length === 0 && <p className="text-sm text-muted-foreground p-4">No attempts yet.</p>}
        {attendance.attempts.map(a => {
          const row = (
            <div className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-medium">{a.user.name ?? a.user.email}</p>
                <p className="text-muted-foreground text-xs">{a.user.email}{a.user.studentId ? ` · ${a.user.studentId}` : ''}</p>
              </div>
              <div className="text-right">
                {a.status === 'submitted' ? (
                  <>
                    <p className="font-medium">{a.totalCorrect} correct · {a.totalWrong} wrong · {a.totalSkipped} skipped</p>
                    <p className="text-muted-foreground text-xs">{a.totalActiveMs != null ? formatClock(a.totalActiveMs) : '—'}</p>
                  </>
                ) : (
                  <p className="text-muted-foreground text-xs">In progress</p>
                )}
              </div>
            </div>
          );
          return a.status === 'submitted' ? (
            <Link key={a.attemptId} href={`/admin/marathon/${chapterId}/days/${dayNumber}/attempts/${a.attemptId}`} className="block hover:bg-muted/50">
              {row}
            </Link>
          ) : (
            <div key={a.attemptId}>{row}</div>
          );
        })}
      </div>

      <h2 className="text-lg font-semibold mt-10 mb-3">Question difficulty (hardest first)</h2>
      <div className="border rounded-xl divide-y">
        {questionStats.length === 0 && <p className="text-sm text-muted-foreground p-4">No submitted attempts yet.</p>}
        {questionStats.map(q => (
          <div key={q.questionId} className="flex items-center justify-between px-4 py-3 text-sm">
            <p className="font-medium">Q{q.number}</p>
            <div className="text-right">
              <p className="font-medium">{q.correctRate}% correct</p>
              <p className="text-muted-foreground text-xs">{q.correctCount} correct · {q.wrongCount} wrong · {q.skippedCount} skipped</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
