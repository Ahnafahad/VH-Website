/**
 * GET /api/vocab/review/words
 *
 * Returns words due for SRS review: inSrsPool=true AND srsNextReviewDate <= now
 * Ordered by srsNextReviewDate ASC, limit 30.
 */

import { NextResponse } from 'next/server';
import { and, asc, eq, lte } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users, vocabUserWordRecords, vocabWords } from '@/lib/db/schema';
import { safeApiHandler, validateAuth, ApiException } from '@/lib/api-utils';

export async function GET() {
  return safeApiHandler(async () => {
    const { email } = await validateAuth();

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (!user) throw new ApiException('User not found', 404);

    const now = new Date();

    const rows = await db
      .select({
        wordId:            vocabUserWordRecords.wordId,
        masteryLevel:      vocabUserWordRecords.masteryLevel,
        masteryScore:      vocabUserWordRecords.masteryScore,
        srsNextReviewDate: vocabUserWordRecords.srsNextReviewDate,
        word:              vocabWords.word,
        definition:        vocabWords.definition,
        exampleSentence:   vocabWords.exampleSentence,
        partOfSpeech:      vocabWords.partOfSpeech,
        synonyms:          vocabWords.synonyms,
        antonyms:          vocabWords.antonyms,
      })
      .from(vocabUserWordRecords)
      .innerJoin(vocabWords, eq(vocabUserWordRecords.wordId, vocabWords.id))
      .where(
        and(
          eq(vocabUserWordRecords.userId, user.id),
          eq(vocabUserWordRecords.inSrsPool, true),
          lte(vocabUserWordRecords.srsNextReviewDate, now),
        )
      )
      .orderBy(asc(vocabUserWordRecords.srsNextReviewDate))
      .limit(30);

    return NextResponse.json({ words: rows });
  });
}
