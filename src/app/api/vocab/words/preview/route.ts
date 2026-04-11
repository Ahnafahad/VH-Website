/**
 * GET /api/vocab/words/preview
 *
 * Returns a lightweight list of words (word + partOfSpeech + definition) for the
 * loading-screen hint carousel. Fast — no AI, pure DB query.
 *
 * Query params (one of):
 *   ?themeId=X
 *   ?themeIds=X,Y,Z
 *   ?wordIds=X,Y,Z
 */

import { NextRequest, NextResponse } from 'next/server';
import { inArray, eq } from 'drizzle-orm';
import { db, vocabWords, vocabThemes } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;

  let wordRows: { word: string; partOfSpeech: string; definition: string }[] = [];

  try {
    if (searchParams.has('wordIds')) {
      const ids = searchParams.get('wordIds')!
        .split(',').map(Number).filter(n => !isNaN(n) && n > 0);
      if (ids.length > 0) {
        wordRows = await db
          .select({ word: vocabWords.word, partOfSpeech: vocabWords.partOfSpeech, definition: vocabWords.definition })
          .from(vocabWords)
          .where(inArray(vocabWords.id, ids));
      }
    } else if (searchParams.has('themeIds')) {
      const ids = searchParams.get('themeIds')!
        .split(',').map(Number).filter(n => !isNaN(n) && n > 0);
      if (ids.length > 0) {
        wordRows = await db
          .select({ word: vocabWords.word, partOfSpeech: vocabWords.partOfSpeech, definition: vocabWords.definition })
          .from(vocabWords)
          .where(inArray(vocabWords.themeId, ids));
      }
    } else if (searchParams.has('themeId')) {
      const id = parseInt(searchParams.get('themeId')!, 10);
      if (!isNaN(id)) {
        wordRows = await db
          .select({ word: vocabWords.word, partOfSpeech: vocabWords.partOfSpeech, definition: vocabWords.definition })
          .from(vocabWords)
          .where(eq(vocabWords.themeId, id));
      }
    }
  } catch {
    return NextResponse.json({ words: [] });
  }

  const words = wordRows
    .filter(r => r.word && r.definition)
    .map(r => ({
      word:       r.word,
      pos:        r.partOfSpeech || null,
      definition: r.definition,
    }));

  return NextResponse.json({ words });
}
