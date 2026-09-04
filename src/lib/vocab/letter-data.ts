import { db, vocabUserWordRecords, vocabWords, vocabWordAltDefinitions, vocabWordContrasts } from '@/lib/db';
import { eq, and, sql } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { VocabCacheTag } from './cache-keys';
import { getUnlockedWordIds } from './access-check';

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
  // Card-preference payload — the user may have any of these switched on.
  altDefinition:   string | null;
  connotation:     string | null;
  contrast:        { word: string; gloss: string } | null;
  masteryLevel:    string;
  masteryScore:    number;
  exposureCount:   number;
  locked:          boolean;
}

/**
 * Get summary of all letters (A–Z) with word counts and mastery stats.
 * Trial users only see the words in their unlocked set.
 */
export async function getLetterIndex(userId: number): Promise<LetterSummary[]> {
  const { ids, key } = await getUnlockedWordIds(userId);
  return unstable_cache(
    () => _getLetterIndex(userId, ids),
    ['vocab-letters', String(userId), key],
    { revalidate: 120, tags: [VocabCacheTag.letters(userId)] },
  )();
}

async function _getLetterIndex(userId: number, unlocked: Set<number> | null): Promise<LetterSummary[]> {
  const allRows = await db
    .select({
      word:         vocabWords.word,
      wordId:       vocabWords.id,
      masteryLevel: vocabUserWordRecords.masteryLevel,
    })
    .from(vocabWords)
    .leftJoin(vocabWordAltDefinitions, eq(vocabWordAltDefinitions.wordId, vocabWords.id))
    .leftJoin(vocabWordContrasts, eq(vocabWordContrasts.wordId, vocabWords.id))
    .leftJoin(
      vocabUserWordRecords,
      and(
        eq(vocabUserWordRecords.wordId, vocabWords.id),
        eq(vocabUserWordRecords.userId, userId),
      )
    );

  const wordRows = unlocked === null ? allRows : allRows.filter(r => unlocked.has(r.wordId));

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
 * Words outside the user's unlocked set come back with `locked: true` (still
 * returned, so the UI can render them blurred + preview).
 */
export async function getLetterWords(userId: number, letter: string): Promise<LetterWordData[]> {
  const upperLetter = letter.toUpperCase();
  const { ids: unlocked } = await getUnlockedWordIds(userId);

  const rows = await db
    .select({
      wordId:          vocabWords.id,
      word:            vocabWords.word,
      definition:      vocabWords.definition,
      exampleSentence: vocabWords.exampleSentence,
      partOfSpeech:    vocabWords.partOfSpeech,
      synonyms:        vocabWords.synonyms,
      antonyms:        vocabWords.antonyms,
      connotation:     vocabWords.connotation,
      altDefinition:   vocabWordAltDefinitions.altDefinition,
      contrastWord:    vocabWordContrasts.contrastWord,
      contrastGloss:   vocabWordContrasts.contrastGloss,
      masteryLevel:    vocabUserWordRecords.masteryLevel,
      masteryScore:    vocabUserWordRecords.masteryScore,
      exposureCount:   vocabUserWordRecords.exposureCount,
    })
    .from(vocabWords)
    .leftJoin(vocabWordAltDefinitions, eq(vocabWordAltDefinitions.wordId, vocabWords.id))
    .leftJoin(vocabWordContrasts, eq(vocabWordContrasts.wordId, vocabWords.id))
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
    altDefinition:   r.altDefinition,
    connotation:     r.connotation,
    contrast:        r.contrastWord && r.contrastGloss ? { word: r.contrastWord, gloss: r.contrastGloss } : null,
    masteryLevel:    r.masteryLevel ?? 'new',
    masteryScore:    r.masteryScore ?? 0,
    exposureCount:   r.exposureCount ?? 0,
    locked:          unlocked !== null && !unlocked.has(r.wordId),
  }));
}
