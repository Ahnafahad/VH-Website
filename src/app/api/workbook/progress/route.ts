import { NextRequest } from 'next/server';
import { safeApiHandler, validateAuth } from '@/lib/api-utils';
import { db, workbookChapterProgress, users } from '@/lib/db';
import { eq, and, sql } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  return safeApiHandler(async () => {
    const { email } = await validateAuth();
    const { chapterSlug, status, lastAnchor, percentRead } = await req.json() as {
      chapterSlug: string;
      status: string;
      lastAnchor?: string;
      percentRead?: number;
    };

    if (!chapterSlug || !status) throw new Error('chapterSlug and status required');

    const userRow = await db.select({ id: users.id })
      .from(users).where(eq(users.email, email)).limit(1);
    const userId = userRow[0]?.id;
    if (!userId) throw new Error('User not found');

    const existing = await db.select({ id: workbookChapterProgress.id })
      .from(workbookChapterProgress)
      .where(and(
        eq(workbookChapterProgress.userId, userId),
        eq(workbookChapterProgress.chapterSlug, chapterSlug),
      )).limit(1);

    if (existing.length > 0) {
      await db.update(workbookChapterProgress)
        .set({
          status,
          ...(lastAnchor && { lastAnchor }),
          ...(percentRead !== undefined && { percentRead }),
          updatedAt: new Date(),
          ...(status === 'completed' && { completedAt: new Date() }),
        })
        .where(and(
          eq(workbookChapterProgress.userId, userId),
          eq(workbookChapterProgress.chapterSlug, chapterSlug),
        ));
    } else {
      await db.insert(workbookChapterProgress).values({
        userId,
        chapterSlug,
        status,
        lastAnchor: lastAnchor ?? null,
        percentRead: percentRead ?? 0,
        ...(status === 'completed' && { completedAt: new Date() }),
      });
    }

    return { ok: true };
  });
}

export async function GET() {
  return safeApiHandler(async () => {
    const { email } = await validateAuth();

    const userRow = await db.select({ id: users.id })
      .from(users).where(eq(users.email, email)).limit(1);
    const userId = userRow[0]?.id;
    if (!userId) return { progress: [] };

    const rows = await db.select()
      .from(workbookChapterProgress)
      .where(eq(workbookChapterProgress.userId, userId));

    return { progress: rows };
  });
}
