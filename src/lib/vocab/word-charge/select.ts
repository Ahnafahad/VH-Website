import { db } from '@/lib/db';
import { vocabUserWordRecords } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getAllWordsCached } from '@/lib/vocab/word-bank';
import {
  rankByPriority,
  weightedSample,
  type WordPriorityInput,
} from '@/lib/vocab/priority-score';
import type { ChargeWord } from './types';

/**
 * Select up to `count` words for a Word Charge round for a given user.
 *
 * Pool: all vocab words with connotation 'positive' | 'negative'.
 * Ranking: existing priority-score system (due/weak/unseen first).
 * Post-process: shuffle + enforce no run of >3 identical connotations.
 */
export async function selectChargeWords(
  userId: number,
  count = 40,
): Promise<ChargeWord[]> {
  const allWords = await getAllWordsCached();

  // Filter to charged words only
  const chargedWords = allWords.filter(
    w => w.connotation === 'positive' || w.connotation === 'negative',
  );

  if (chargedWords.length === 0) return [];

  // Load user word records for this user
  const records = await db
    .select()
    .from(vocabUserWordRecords)
    .where(eq(vocabUserWordRecords.userId, userId));

  const recordMap = new Map(records.map(r => [r.wordId, r]));

  // Build priority inputs — unseen words treated as new/nulls
  const priorityInputs: WordPriorityInput[] = chargedWords.map(w => {
    const rec = recordMap.get(w.id);
    if (!rec) {
      return {
        wordId:            w.id,
        masteryLevel:      'new',
        masteryScore:      0,
        accuracyRate:      0,
        lastSeenAt:        null,
        srsNextReviewDate: null,
        exposureCount:     0,
      };
    }
    return {
      wordId:            w.id,
      masteryLevel:      rec.masteryLevel as WordPriorityInput['masteryLevel'],
      masteryScore:      rec.masteryScore ?? 0,
      accuracyRate:      rec.accuracyRate ?? 0,
      lastSeenAt:        rec.lastSeenAt,
      srsNextReviewDate: rec.srsNextReviewDate,
      exposureCount:     rec.exposureCount ?? 0,
    };
  });

  const ranked   = rankByPriority(priorityInputs);
  const sampled  = weightedSample(ranked, count);

  // Build word lookup for post-processing
  const wordById = new Map(chargedWords.map(w => [w.id, w]));

  // Shuffle sampled list
  const shuffled = [...sampled];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Enforce no run of >3 identical connotations
  // When a 4th same-side word would occur, find the next different one and swap.
  for (let i = 3; i < shuffled.length; i++) {
    const w = wordById.get(shuffled[i].wordId);
    if (!w) continue;
    const prev3 = [shuffled[i - 1], shuffled[i - 2], shuffled[i - 3]];
    const allSame = prev3.every(p => {
      const pw = wordById.get(p.wordId);
      return pw?.connotation === w.connotation;
    });
    if (allSame) {
      // Find next word with different connotation
      let swapIdx = -1;
      for (let j = i + 1; j < shuffled.length; j++) {
        const sw = wordById.get(shuffled[j].wordId);
        if (sw && sw.connotation !== w.connotation) { swapIdx = j; break; }
      }
      if (swapIdx !== -1) {
        [shuffled[i], shuffled[swapIdx]] = [shuffled[swapIdx], shuffled[i]];
      }
    }
  }

  // Map to ChargeWord
  return shuffled
    .map(s => {
      const w = wordById.get(s.wordId);
      if (!w || (w.connotation !== 'positive' && w.connotation !== 'negative')) return null;
      return {
        id:              w.id,
        word:            w.word,
        connotation:     w.connotation as 'positive' | 'negative',
        definition:      w.definition,
        exampleSentence: w.exampleSentence,
        partOfSpeech:    w.partOfSpeech,
        synonyms:        JSON.parse(w.synonyms ?? '[]') as string[],
        antonyms:        JSON.parse(w.antonyms ?? '[]') as string[],
      };
    })
    .filter((w): w is ChargeWord => w !== null);
}
