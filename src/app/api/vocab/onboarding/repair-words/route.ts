/**
 * GET /api/vocab/onboarding/repair-words?ids=1,2,3
 *
 * The words the user actually got wrong in the pre-signin diagnostic, now
 * fetched with the full card payload so onboarding can teach them on the very
 * card style the user picked. Ids come from the client draft, so they are
 * validated against the user's own trial set before anything is returned.
 */

import { NextRequest } from 'next/server';
import { inArray, eq } from 'drizzle-orm';
import { db, users, vocabWords, vocabWordAltDefinitions, vocabWordContrasts } from '@/lib/db';
import { safeApiHandler, validateAuth, ApiException } from '@/lib/api-utils';
import { filterAccessibleWordIds } from '@/lib/vocab/access-check';
import type { LivingCardWord } from '@/components/vocab/LivingFlashcard';

const MAX_WORDS = 5;

function safeParseArray(json: string | null): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json) as unknown;
    return Array.isArray(v) ? (v as string[]) : [];
  } catch { return []; }
}

export async function GET(req: NextRequest) {
  return safeApiHandler(async () => {
    const { email } = await validateAuth();
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (!user) throw new ApiException('User not found', 404);

    const ids = (req.nextUrl.searchParams.get('ids') ?? '')
      .split(',')
      .map(Number)
      .filter(n => Number.isInteger(n) && n > 0)
      .slice(0, MAX_WORDS);
    if (ids.length === 0) throw new ApiException('ids required', 400);

    const allowed = await filterAccessibleWordIds(user.id, ids);
    if (allowed.length === 0) return { words: [] };

    const rows = await db
      .select({
        id:              vocabWords.id,
        word:            vocabWords.word,
        definition:      vocabWords.definition,
        partOfSpeech:    vocabWords.partOfSpeech,
        synonyms:        vocabWords.synonyms,
        exampleSentence: vocabWords.exampleSentence,
        connotation:     vocabWords.connotation,
        altDefinition:   vocabWordAltDefinitions.altDefinition,
        contrastWord:    vocabWordContrasts.contrastWord,
        contrastGloss:   vocabWordContrasts.contrastGloss,
      })
      .from(vocabWords)
      .leftJoin(vocabWordAltDefinitions, eq(vocabWordAltDefinitions.wordId, vocabWords.id))
      .leftJoin(vocabWordContrasts, eq(vocabWordContrasts.wordId, vocabWords.id))
      .where(inArray(vocabWords.id, allowed));

    const byId = new Map(rows.map(r => [r.id, r]));
    const words: LivingCardWord[] = allowed.flatMap(id => {
      const r = byId.get(id);
      if (!r) return [];
      return [{
        id: r.id,
        word: r.word,
        definition: r.definition,
        altDefinition: r.altDefinition,
        partOfSpeech: r.partOfSpeech,
        synonyms: safeParseArray(r.synonyms),
        exampleSentence: r.exampleSentence,
        connotation: r.connotation,
        contrast: r.contrastWord && r.contrastGloss
          ? { word: r.contrastWord, gloss: r.contrastGloss }
          : null,
      }];
    });

    return { words };
  }, 'onboarding_repair_words');
}
