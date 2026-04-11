/**
 * GET /api/vocab/leaderboard/weekly
 *
 * Returns the top-20 weekly leaderboard plus the authenticated user's rank.
 * Suspended users are excluded.
 * The logged-in user is always included in the response (appended below top-20 if not in it).
 */

import { NextRequest } from 'next/server';
import { eq, desc, ne } from 'drizzle-orm';
import { db, users, vocabUserProgress } from '@/lib/db';
import { safeApiHandler, validateAuth, ApiException } from '@/lib/api-utils';

export async function GET(_req: NextRequest) {
  return safeApiHandler(async () => {
    const { email } = await validateAuth();

    const [me] = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (!me) throw new ApiException('User not found', 404);

    // Top 20 by weekly points, excluding suspended users
    const top = await db
      .select({
        userId:       vocabUserProgress.userId,
        weeklyPoints: vocabUserProgress.weeklyPoints,
      })
      .from(vocabUserProgress)
      .innerJoin(users, eq(vocabUserProgress.userId, users.id))
      .where(ne(users.status, 'inactive'))
      .orderBy(desc(vocabUserProgress.weeklyPoints))
      .limit(20);

    const allUserIds = top.map(t => t.userId);
    const allUsersData = await db
      .select({ id: users.id, name: users.name })
      .from(users);
    const nameMap = new Map(allUsersData.map(u => [u.id, u.name ?? 'Anonymous']));

    const entries = top.map((t, i) => ({
      rank:         i + 1,
      userId:       t.userId,
      displayName:  nameMap.get(t.userId) ?? 'Anonymous',
      weeklyPoints: t.weeklyPoints ?? 0,
      isMe:         t.userId === me.id,
    }));

    // Ensure the caller is always in the response
    const myEntry = entries.find(e => e.isMe);
    let myRank: number | null = myEntry?.rank ?? null;

    if (!myEntry) {
      const [myProg] = await db
        .select({ weeklyPoints: vocabUserProgress.weeklyPoints })
        .from(vocabUserProgress)
        .where(eq(vocabUserProgress.userId, me.id))
        .limit(1);

      // Approximate rank: count users with more weekly points
      const allProgress = await db
        .select({ weeklyPoints: vocabUserProgress.weeklyPoints })
        .from(vocabUserProgress)
        .innerJoin(users, eq(vocabUserProgress.userId, users.id))
        .where(ne(users.status, 'inactive'));

      const myWeeklyPts = myProg?.weeklyPoints ?? 0;
      myRank = allProgress.filter(p => (p.weeklyPoints ?? 0) > myWeeklyPts).length + 1;

      entries.push({
        rank:         myRank,
        userId:       me.id,
        displayName:  me.name ?? 'Anonymous',
        weeklyPoints: myWeeklyPts,
        isMe:         true,
      });
    }

    return { entries, myRank };
  });
}
