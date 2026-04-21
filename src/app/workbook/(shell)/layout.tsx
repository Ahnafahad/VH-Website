import { getServerSession } from 'next-auth';
import { notFound }         from 'next/navigation';
import { authOptions }      from '@/lib/auth';
import { db, workbookChapterProgress } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { users } from '@/lib/db';
import WorkbookShellClient from './WorkbookShellClient';
import type { WorkbookProgressStatus } from '@/lib/workbook/types';
import { Lora } from 'next/font/google';

const lora = Lora({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-wb-body',
});

// TODO: Remove email gate when workbook is ready for public launch.
const SUPER_ADMIN_EMAIL = 'ahnaf816@gmail.com';

export default async function WorkbookShellLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email || session.user.email !== SUPER_ADMIN_EMAIL) {
    notFound();
  }

  // Fetch progress for this user
  const userRow = await db.select({ id: users.id })
    .from(users)
    .where(eq(users.email, session.user.email))
    .limit(1);

  const userId = userRow[0]?.id ?? null;
  let progressMap: Record<string, WorkbookProgressStatus> = {};

  if (userId) {
    const rows = await db.select({
      chapterSlug: workbookChapterProgress.chapterSlug,
      status: workbookChapterProgress.status,
    }).from(workbookChapterProgress)
      .where(eq(workbookChapterProgress.userId, userId));

    progressMap = Object.fromEntries(
      rows.map(r => [r.chapterSlug, r.status as WorkbookProgressStatus])
    );
  }

  return (
    <div className={`${lora.variable} wb-shell`}>
      <WorkbookShellClient initialProgress={progressMap}>
        {children}
      </WorkbookShellClient>
    </div>
  );
}
