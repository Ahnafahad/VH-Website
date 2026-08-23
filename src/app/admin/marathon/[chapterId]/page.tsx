/**
 * /admin/marathon/[chapterId] — per-day overview for one chapter: attendance
 * (submitted / eligible), average time, and solution-authoring progress.
 * Staff-only, gated by the /admin layout. Each day links through to its
 * attempt list.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { marathonChapters } from '@/lib/db/schema';
import { getChapterDaysOverview } from '@/lib/marathon/service';

function formatClock(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

export default async function MarathonChapterAdminPage({
  params,
}: {
  params: Promise<{ chapterId: string }>;
}) {
  const chapterId = Number((await params).chapterId);
  if (!Number.isInteger(chapterId)) notFound();

  const chapter = await db.select().from(marathonChapters).where(eq(marathonChapters.id, chapterId)).get();
  if (!chapter) notFound();

  const days = await getChapterDaysOverview(chapterId);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <Link href="/admin/marathon" className="text-sm text-muted-foreground hover:underline">← Back to Math Marathon</Link>
      <h1 className="text-2xl font-semibold mt-2 mb-1">{chapter.title}</h1>
      <p className="text-muted-foreground text-sm mb-8">{days.length} days · click a day to see who attended and their individual results.</p>

      <div className="border rounded-xl divide-y">
        {days.length === 0 && <p className="text-sm text-muted-foreground p-4">No days imported yet.</p>}
        {days.map(d => (
          <Link
            key={d.dayId}
            href={`/admin/marathon/${chapterId}/days/${d.dayNumber}`}
            className="flex items-center justify-between px-4 py-3 text-sm hover:bg-muted/50"
          >
            <div>
              <p className="font-medium">Day {d.dayNumber}</p>
              <p className="text-muted-foreground text-xs">
                {d.questionsWithSolution}/{d.totalQuestions} solutions authored
                {d.questionsWithSolution === 0 ? ' — none yet' : d.questionsWithSolution === d.totalQuestions ? ' — complete' : ''}
              </p>
            </div>
            <div className="text-right">
              <p className="font-medium">{d.attendedCount}/{d.eligibleCount} attended</p>
              <p className="text-muted-foreground text-xs">{d.averageActiveMs != null ? `avg ${formatClock(d.averageActiveMs)}` : 'no submissions yet'}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
