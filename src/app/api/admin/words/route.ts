/**
 * GET /api/admin/words  — paginated word list with optional filters
 *   ?unitId=N  &themeId=N  &search=term  &page=N  &limit=N
 *
 * Admin only.
 */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { and, asc, desc, eq, like, or, count } from 'drizzle-orm';
import { authOptions } from '@/lib/auth';
import { db, vocabWords } from '@/lib/db';
import { safeApiHandler, ApiException } from '@/lib/api-utils';

async function requireAdmin(): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    throw new ApiException('Admin access required', 403);
  }
}

export async function GET(req: NextRequest) {
  return safeApiHandler(async () => {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const unitIdParam  = searchParams.get('unitId');
    const themeIdParam = searchParams.get('themeId');
    const search       = searchParams.get('search')?.trim();
    const pageParam    = searchParams.get('page');
    const limitParam   = searchParams.get('limit');

    const page  = Math.max(1, parseInt(pageParam  ?? '1',  10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitParam ?? '50', 10) || 50));
    const offset = (page - 1) * limit;

    const conditions = [];
    if (unitIdParam)  conditions.push(eq(vocabWords.unitId,  parseInt(unitIdParam,  10)));
    if (themeIdParam) conditions.push(eq(vocabWords.themeId, parseInt(themeIdParam, 10)));
    if (search) {
      conditions.push(
        or(
          like(vocabWords.word,       `%${search}%`),
          like(vocabWords.definition, `%${search}%`),
        )!
      );
    }

    const where = conditions.length ? and(...conditions) : undefined;

    const [totalResult, words] = await Promise.all([
      db.select({ count: count() }).from(vocabWords).where(where),
      db
        .select()
        .from(vocabWords)
        .where(where)
        .orderBy(asc(vocabWords.unitId), asc(vocabWords.themeId), desc(vocabWords.createdAt))
        .limit(limit)
        .offset(offset),
    ]);

    const total = totalResult[0]?.count ?? 0;

    return {
      words,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  });
}
