/**
 * GET /api/vocab/leaderboard/alltime
 *
 * Returns the top-20 all-time leaderboard (by total_points).
 * Suspended users are excluded.
 * Logged-in user always included.
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

    const top = await db
      .select({
        userId:      vocabUserProgress.userId,
        totalPoints: vocabUserProgress.totalPoints,
      })
      .from(vocabUserProgress)
      .innerJoin(users, eq(vocabUserProgress.userId, users.id))
      .where(ne(users.status, 'inactive'))
      .orderBy(desc(vocabUserProgress.totalPoints))
      .limit(20);

    const allUsersData = await db
      .select({ id: users.id, name: users.name })
      .from(users);
    const nameMap = new Map(allUsersData.map(u => [u.id, u.name ?? 'Anonymous']));

    const entries = top.map((t, i) => ({
      rank:        i + 1,
      userId:      t.userId,
      displayName: nameMap.get(t.userId) ?? 'Anonymous',
      totalPoints: t.totalPoints ?? 0,
      isMe:        t.userId === me.id,
    }));

    const myEntry = entries.find(e => e.isMe);
    let myRank: number | null = myEntry?.rank ?? null;

    if (!myEntry) {
      const [myProg] = await db
        .select({ totalPoints: vocabUserProgress.totalPoints })
        .from(vocabUserProgress)
        .where(eq(vocabUserProgress.userId, me.id))
        .limit(1);

      const allProgress = await db
        .select({ totalPoints: vocabUserProgress.totalPoints })
        .from(vocabUserProgress)
        .innerJoin(users, eq(vocabUserProgress.userId, users.id))
        .where(ne(users.status, 'inactive'));

      const myTotalPts = myProg?.totalPoints ?? 0;
      myRank = allProgress.filter(p => (p.totalPoints ?? 0) > myTotalPts).length + 1;

      entries.push({
        rank:        myRank,
        userId:      me.id,
        displayName: me.name ?? 'Anonymous',
        totalPoints: myTotalPts,
        isMe:        true,
      });
    }

    return { entries, myRank };
  });
}
