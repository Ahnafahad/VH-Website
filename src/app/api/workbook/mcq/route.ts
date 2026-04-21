import { NextRequest } from 'next/server';
import { safeApiHandler, validateAuth } from '@/lib/api-utils';
import { db, workbookMcqAttempts, users } from '@/lib/db';
import { eq } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  return safeApiHandler(async () => {
    const { email } = await validateAuth();
    const { chapterSlug, questionId, selectedOption, isCorrect } = await req.json() as {
      chapterSlug: string;
      questionId: string;
      selectedOption: string;
      isCorrect: boolean;
    };

    const userRow = await db.select({ id: users.id })
      .from(users).where(eq(users.email, email)).limit(1);
    const userId = userRow[0]?.id;
    if (!userId) return { ok: true };

    await db.insert(workbookMcqAttempts).values({
      userId,
      chapterSlug,
      questionId,
      selectedOption,
      isCorrect,
    });

    return { ok: true };
  });
}
