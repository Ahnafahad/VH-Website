/**
 * GET /api/vocab/games/last-word/summary
 * Progress snapshot for the Lexicore games hub card: how many distinctions the
 * student has practiced, how many are reliable or better, and what is due.
 */

import { eq } from 'drizzle-orm';
import { db, users } from '@/lib/db';
import { ApiException, safeApiHandler, validateAuth } from '@/lib/api-utils';
import { loadPlayableSets } from '@/features/last-word/content/load';
import { dueEdges, indexEdges } from '@/features/last-word/game/session';
import { DatabaseLastWordPersistence } from '@/features/last-word/persistence/database';

export const dynamic = 'force-dynamic';

export interface LastWordSummaryResponse {
  distinctions: number;
  practiced: number;
  reliable: number;
  due: number;
  sessions: number;
}

export async function GET() {
  return safeApiHandler(async (): Promise<LastWordSummaryResponse> => {
    const { email } = await validateAuth();
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    if (!user) throw new ApiException('User not found', 404);

    const sets = loadPlayableSets();
    const snapshot = await new DatabaseLastWordPersistence(db, user.id, sets).load();
    const edges = indexEdges(sets);
    const status = (id: string) => snapshot.edges[id]?.status;
    return {
      distinctions: edges.length,
      practiced: edges.filter(e => status(e.edgeId) && status(e.edgeId) !== 'Unseen').length,
      reliable: edges.filter(e => ['Reliable', 'Fluent', 'Mastered'].includes(status(e.edgeId) ?? '')).length,
      due: dueEdges(sets, snapshot, Date.now()).length,
      sessions: snapshot.sessions.length,
    };
  });
}
