import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { getUserByEmail } from '@/lib/db-access-control';
import { getViewerBatch, getLexiCoreBoard, getLatestTestBoard, getAllTestsBoard } from '@/lib/leaderboard/read';
import LeaderboardBoardsScreen from './LeaderboardBoardsScreen';

export const metadata = { title: 'Leaderboard — VH' };

// Multi-board leaderboard (DECISIONS.md §13): LexiCore is one segment among
// several, not the whole leaderboard. Scoped to the viewer's own batch ×
// product cohort — see src/lib/leaderboard/read.ts.
export default async function LeaderboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/auth/signin');

  const user = await getUserByEmail(session.user.email);
  if (!user) redirect('/auth/signin');

  const batch = await getViewerBatch(user);

  const [lexicore, latestTest, allTests] = batch
    ? await Promise.all([getLexiCoreBoard(batch), getLatestTestBoard(batch), getAllTestsBoard(batch)])
    : [[], { entries: [], testTitle: null }, []];

  return (
    <LeaderboardBoardsScreen
      batchName={batch?.name ?? null}
      currentUserId={user.id}
      lexicore={lexicore}
      latestTest={latestTest}
      allTests={allTests}
    />
  );
}
