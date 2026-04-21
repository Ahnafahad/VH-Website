import { db, users, vocabUserWordRecords, vocabWords, vocabThemes, vocabUnits } from '@/lib/db';
import { eq, and, sql, count, inArray, lte } from 'drizzle-orm';

function safeParseArray(json: string | null): string[] {
  if (!json) return [];
  try { return JSON.parse(json); } catch { return []; }
}

export interface LetterSummary {
  letter:           string;
  wordCount:        number;
  studiedCount:      number; // any word with a mastery record
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
  locked:          boolean;
}

/**
 * Get summary of all letters (A–Z) with word counts and mastery stats.
 * @param maxUnitOrder — if provided, only include words from units with order <= this value
 */
export async function getLetterIndex(userId: number, maxUnitOrder?: number): Promise<LetterSummary[]> {
  // Phase filtering: join through units to restrict by unit order when set.
  // We build two shapes since Drizzle's fluent builder types tighten after each step.
  const wordRows = maxUnitOrder !== undefined
    ? await db
        .select({
          word:         vocabWords.word,
          wordId:       vocabWords.id,
          masteryLevel: vocabUserWordRecords.masteryLevel,
        })
        .from(vocabWords)
        .innerJoin(vocabUnits, eq(vocabWords.unitId, vocabUnits.id))
        .leftJoin(
          vocabUserWordRecords,
          and(
            eq(vocabUserWordRecords.wordId, vocabWords.id),
            eq(vocabUserWordRecords.userId, userId),
          )
        )
        .where(lte(vocabUnits.order, maxUnitOrder))
    : await db
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
  const letterMap = new Map<string, { total: number; studied: number; familiarPlus: number; wordIds: number[] }>();

  for (const row of wordRows) {
    const letter = row.word.charAt(0).toUpperCase();
    if (!letter.match(/[A-Z]/)) continue;

    const existing = letterMap.get(letter) ?? { total: 0, studied: 0, familiarPlus: 0, wordIds: [] };
    existing.total++;
    existing.wordIds.push(row.wordId);

    // masteryLevel is null when the user has no record for the word (leftJoin miss).
    // Any non-null value — including 'new' from an existing record — counts as studied.
    if (row.masteryLevel !== null) {
      existing.studied++;
      if (row.masteryLevel === 'familiar' || row.masteryLevel === 'strong' || row.masteryLevel === 'mastered') {
        existing.familiarPlus++;
      }
    }

    letterMap.set(letter, existing);
  }

  // Convert to sorted array (only letters that have words)
  return Array.from(letterMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([letter, { total, studied, familiarPlus, wordIds }]) => ({
      letter,
      wordCount:        total,
      studiedCount:      studied,
      familiarPlusCount: familiarPlus,
      wordIds,
    }));
}

/**
 * Get all words starting with a specific letter + user mastery records.
 * @param maxUnitOrder — if provided, words in units with order > maxUnitOrder are marked `locked: true`
 *                      (they are still returned, so the UI can render them blurred + preview).
 */
export async function getLetterWords(userId: number, letter: string, maxUnitOrder?: number): Promise<LetterWordData[]> {
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
      unitOrder:       vocabUnits.order,
      masteryLevel:    vocabUserWordRecords.masteryLevel,
      masteryScore:    vocabUserWordRecords.masteryScore,
      exposureCount:   vocabUserWordRecords.exposureCount,
    })
    .from(vocabWords)
    .innerJoin(vocabUnits, eq(vocabWords.unitId, vocabUnits.id))
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
    locked:          maxUnitOrder !== undefined && r.unitOrder > maxUnitOrder,
  }));
}
