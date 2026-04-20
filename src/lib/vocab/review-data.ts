import { db, vocabUserWordRecords, vocabWords } from '@/lib/db';
import { eq, and, lte, gte, or, inArray } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import type { LetterWordData } from './letter-data';

function safeParseArray(json: string | null): string[] {
  if (!json) return [];
  try { return JSON.parse(json); } catch { return []; }
}

export interface ReviewWord {
  wordId:            number;
  word:              string;
  definition:        string;
  exampleSentence:   string;
  partOfSpeech:      string;
  synonyms:          string[];
  antonyms:          string[];
  masteryLevel:      string;
  masteryScore:      number;
  exposureCount:     number;
  // review-specific
  srsNextReviewDate: string | null;
  daysOverdue:       number;   // 0 = due today, >0 = X days late
  accuracyRate:      number;   // 0–1
  consecutiveWrong:  number;
  totalAttempts:     number;
}

export interface ReviewData {
  dueWords:  ReviewWord[];   // inSrsPool=true AND srsNextReviewDate <= now
  weakWords: ReviewWord[];   // low accuracy, excl. dueWords
}

// ─── getReviewData ────────────────────────────────────────────────────────────

export async function getReviewData(userId: number): Promise<ReviewData> {
  const now = new Date();

  const selectCols = {
    wordId:            vocabWords.id,
    word:              vocabWords.word,
    definition:        vocabWords.definition,
    exampleSentence:   vocabWords.exampleSentence,
    partOfSpeech:      vocabWords.partOfSpeech,
    synonyms:          vocabWords.synonyms,
    antonyms:          vocabWords.antonyms,
    masteryLevel:      vocabUserWordRecords.masteryLevel,
    masteryScore:      vocabUserWordRecords.masteryScore,
    exposureCount:     vocabUserWordRecords.exposureCount,
    srsNextReviewDate: vocabUserWordRecords.srsNextReviewDate,
    accuracyRate:      vocabUserWordRecords.accuracyRate,
    consecutiveWrong:  vocabUserWordRecords.consecutiveWrong,
    totalAttempts:     vocabUserWordRecords.totalAttempts,
  } as const;

  const [dueRows, weakRows] = await Promise.all([
    // 1. Due for review: inSrsPool AND srsNextReviewDate <= now
    db
      .select(selectCols)
      .from(vocabUserWordRecords)
      .innerJoin(vocabWords, eq(vocabUserWordRecords.wordId, vocabWords.id))
      .where(
        and(
          eq(vocabUserWordRecords.userId, userId),
          eq(vocabUserWordRecords.inSrsPool, true),
          lte(vocabUserWordRecords.srsNextReviewDate, now),
        ),
      )
      .orderBy(vocabUserWordRecords.srsNextReviewDate)
      .limit(50),

    // 2. Struggling: totalAttempts>=3 AND recent-failure signal
    //    - consecutiveWrong>=2 (currently failing), OR
    //    - accuracyRate<0.6 AND consecutiveCorrect<3 (low rate, not yet recovered)
    //    3-in-a-row correct streak clears a word from Struggling even if lifetime
    //    accuracy is still below 60%.
    db
      .select(selectCols)
      .from(vocabUserWordRecords)
      .innerJoin(vocabWords, eq(vocabUserWordRecords.wordId, vocabWords.id))
      .where(
        and(
          eq(vocabUserWordRecords.userId, userId),
          gte(vocabUserWordRecords.totalAttempts, 3),
          or(
            gte(vocabUserWordRecords.consecutiveWrong, 2),
            and(
              sql`${vocabUserWordRecords.accuracyRate} < 0.6`,
              sql`${vocabUserWordRecords.consecutiveCorrect} < 3`,
            ),
          ),
        ),
      )
      .orderBy(vocabUserWordRecords.accuracyRate)
      .limit(50),
  ]);

  function toReviewWord(r: (typeof dueRows)[0]): ReviewWord {
    const nextReview = r.srsNextReviewDate;
    let daysOverdue = 0;
    if (nextReview) {
      const msOverdue = now.getTime() - nextReview.getTime();
      daysOverdue = Math.max(0, Math.floor(msOverdue / (1000 * 60 * 60 * 24)));
    }
    return {
      wordId:            r.wordId,
      word:              r.word,
      definition:        r.definition,
      exampleSentence:   r.exampleSentence ?? '',
      partOfSpeech:      r.partOfSpeech ?? '',
      synonyms:          safeParseArray(r.synonyms),
      antonyms:          safeParseArray(r.antonyms),
      masteryLevel:      r.masteryLevel,
      masteryScore:      r.masteryScore,
      exposureCount:     r.exposureCount,
      srsNextReviewDate: nextReview ? nextReview.toISOString() : null,
      daysOverdue,
      accuracyRate:      r.accuracyRate,
      consecutiveWrong:  r.consecutiveWrong,
      totalAttempts:     r.totalAttempts,
    };
  }

  const dueWordIds = new Set(dueRows.map(r => r.wordId));
  const dueWords   = dueRows.map(toReviewWord);
  const weakWords  = weakRows
    .filter(r => !dueWordIds.has(r.wordId))
    .slice(0, 30)
    .map(toReviewWord);

  return { dueWords, weakWords };
}

// ─── getReviewWords ───────────────────────────────────────────────────────────
// For the review flashcard page: fetch LetterWordData for a list of wordIds.

export async function getReviewWords(userId: number, wordIds: number[]): Promise<LetterWordData[]> {
  if (wordIds.length === 0) return [];

  const rows = await db
    .select({
      wordId:          vocabWords.id,
      word:            vocabWords.word,
      definition:      vocabWords.definition,
      exampleSentence: vocabWords.exampleSentence,
      partOfSpeech:    vocabWords.partOfSpeech,
      synonyms:        vocabWords.synonyms,
      antonyms:        vocabWords.antonyms,
      masteryLevel:    vocabUserWordRecords.masteryLevel,
      masteryScore:    vocabUserWordRecords.masteryScore,
      exposureCount:   vocabUserWordRecords.exposureCount,
    })
    .from(vocabWords)
    .leftJoin(
      vocabUserWordRecords,
      and(
        eq(vocabUserWordRecords.wordId, vocabWords.id),
        eq(vocabUserWordRecords.userId, userId),
      ),
    )
    .where(inArray(vocabWords.id, wordIds))
    .orderBy(vocabWords.word);

  return rows.map(r => ({
    wordId:          r.wordId,
    word:            r.word,
    definition:      r.definition,
    exampleSentence: r.exampleSentence ?? '',
    partOfSpeech:    r.partOfSpeech ?? '',
    synonyms:        safeParseArray(r.synonyms),
    antonyms:        safeParseArray(r.antonyms),
    masteryLevel:    r.masteryLevel ?? 'new',
    masteryScore:    r.masteryScore ?? 0,
    exposureCount:   r.exposureCount ?? 0,
  }));
}
