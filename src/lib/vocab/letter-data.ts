import { db, users, vocabUserWordRecords, vocabWords } from '@/lib/db';
import { eq, and, sql, count, inArray } from 'drizzle-orm';

function safeParseArray(json: string | null): string[] {
  if (!json) return [];
  try { return JSON.parse(json); } catch { return []; }
}

export interface LetterSummary {
  letter:           string;
  wordCount:        number;
  familiarPlusCount: number; // familiar + strong + mastered
  wordIds:          number[];
}

export interface LetterWordData {
  wordId:          number;
  word:            string;
  definition:      string;
  exampleSentence: string;
  partOfSpeech:    string;
  synonyms:        string[];
  antonyms:        string[];
  masteryLevel:    string;
  masteryScore:    number;
  exposureCount:   number;
}

/**
 * Get summary of all letters (A–Z) with word counts and mastery stats.
 */
export async function getLetterIndex(userId: number): Promise<LetterSummary[]> {
  // Get all words grouped by first letter with mastery
  const wordRows = await db
    .select({
      word:         vocabWords.word,
      wordId:       vocabWords.id,
      masteryLevel: vocabUserWordRecords.masteryLevel,
    })
    .from(vocabWords)
    .leftJoin(
      vocabUserWordRecords,
      and(
        eq(vocabUserWordRecords.wordId, vocabWords.id),
        eq(vocabUserWordRecords.userId, userId),
      )
    );

  // Group by first letter
  const letterMap = new Map<string, { total: number; familiarPlus: number; wordIds: number[] }>();

  for (const row of wordRows) {
    const letter = row.word.charAt(0).toUpperCase();
    if (!letter.match(/[A-Z]/)) continue;

    const existing = letterMap.get(letter) ?? { total: 0, familiarPlus: 0, wordIds: [] };
    existing.total++;
    existing.wordIds.push(row.wordId);

    const lvl = row.masteryLevel ?? 'new';
    if (lvl === 'familiar' || lvl === 'strong' || lvl === 'mastered') {
      existing.familiarPlus++;
    }

    letterMap.set(letter, existing);
  }

  // Convert to sorted array (only letters that have words)
  return Array.from(letterMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([letter, { total, familiarPlus, wordIds }]) => ({
      letter,
      wordCount:        total,
      familiarPlusCount: familiarPlus,
      wordIds,
    }));
}

/**
 * Get all words starting with a specific letter + user mastery records.
 */
export async function getLetterWords(userId: number, letter: string): Promise<LetterWordData[]> {
  const upperLetter = letter.toUpperCase();

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
      )
    )
    .where(sql`UPPER(SUBSTR(${vocabWords.word}, 1, 1)) = ${upperLetter}`)
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
