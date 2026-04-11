/**
 * PATCH  /api/admin/words/[id]  — update a single word
 * DELETE /api/admin/words/[id]  — delete a word
 *
 * Admin only.
 */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { eq } from 'drizzle-orm';
import { authOptions } from '@/lib/auth';
import { db, vocabWords } from '@/lib/db';
import { safeApiHandler, ApiException } from '@/lib/api-utils';

async function requireAdmin(): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    throw new ApiException('Admin access required', 403);
  }
}

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  return safeApiHandler(async () => {
    await requireAdmin();

    const { id } = await params;
    const wordId = parseInt(id, 10);
    if (!wordId) throw new ApiException('Invalid word id', 400);

    const existing = await db
      .select()
      .from(vocabWords)
      .where(eq(vocabWords.id, wordId))
      .get();
    if (!existing) throw new ApiException('Word not found', 404);

    const body = await req.json();
    const {
      word,
      definition,
      synonyms,
      antonyms,
      exampleSentence,
      partOfSpeech,
      difficultyBase,
      themeId,
      unitId,
    } = body as {
      word?:            string;
      definition?:      string;
      synonyms?:        string[] | string;
      antonyms?:        string[] | string;
      exampleSentence?: string;
      partOfSpeech?:    string;
      difficultyBase?:  number;
      themeId?:         number;
      unitId?:          number;
    };

    const updateSet: Record<string, unknown> = { updatedAt: new Date() };
    if (word            !== undefined) updateSet.word            = word.trim();
    if (definition      !== undefined) updateSet.definition      = definition.trim();
    if (exampleSentence !== undefined) updateSet.exampleSentence = exampleSentence.trim();
    if (partOfSpeech    !== undefined) updateSet.partOfSpeech    = partOfSpeech.trim();
    if (difficultyBase  !== undefined) updateSet.difficultyBase  = Math.max(1, Math.min(5, difficultyBase));
    if (themeId         !== undefined) updateSet.themeId         = themeId;
    if (unitId          !== undefined) updateSet.unitId          = unitId;

    if (synonyms !== undefined) {
      const arr = Array.isArray(synonyms)
        ? synonyms
        : synonyms.split(',').map(s => s.trim()).filter(Boolean);
      updateSet.synonyms = JSON.stringify(arr);
    }
    if (antonyms !== undefined) {
      const arr = Array.isArray(antonyms)
        ? antonyms
        : antonyms.split(',').map(s => s.trim()).filter(Boolean);
      updateSet.antonyms = JSON.stringify(arr);
    }

    const [updated] = await db
      .update(vocabWords)
      .set(updateSet)
      .where(eq(vocabWords.id, wordId))
      .returning();

    return { word: updated };
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return safeApiHandler(async () => {
    await requireAdmin();

    const { id } = await params;
    const wordId = parseInt(id, 10);
    if (!wordId) throw new ApiException('Invalid word id', 400);

    const existing = await db
      .select({ id: vocabWords.id })
      .from(vocabWords)
      .where(eq(vocabWords.id, wordId))
      .get();
    if (!existing) throw new ApiException('Word not found', 404);

    await db.delete(vocabWords).where(eq(vocabWords.id, wordId));

    return { ok: true };
  });
}
