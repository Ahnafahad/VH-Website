import { db, vocabWords } from '@/lib/db';
import { inArray, and, or, eq } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { computeTrialSet } from '../access-check';
import tiers from './difficulty-tiers.json';

/**
 * Difficulty is empirical, not declared: it comes from ~19k real Word Charge
 * judgments (hint-assisted answers excluded). difficulty_base in the DB is dead
 * — 689 of 722 words carry the same value 3. Tier 5 = hardest.
 */
const TIER_BY_WORD = new Map<number, number>((tiers as { id: number; tier: number }[]).map(t => [t.id, t.tier]));

export interface DiagnosticWord {
  id:          number;
  word:        string;
  connotation: 'positive' | 'negative';
  tier:        number;
}

/** How many candidates per tier the client gets to walk adaptively. */
const PER_TIER = 10;

/**
 * Candidate words grouped by difficulty tier, drawn from exactly the set a
 * brand-new (trial) account will be able to study — so nothing the diagnostic
 * surfaces is locked a minute later.
 *
 * The whole pool ships in one response: the diagnostic can run up to 60
 * seconds and cannot afford a round trip between items.
 */
export const getDiagnosticPool = unstable_cache(
  async (): Promise<Record<number, DiagnosticWord[]>> => {
    const { ids } = await computeTrialSet(null);

    const rows = await db
      .select({ id: vocabWords.id, word: vocabWords.word, connotation: vocabWords.connotation })
      .from(vocabWords)
      .where(and(
        ids ? inArray(vocabWords.id, [...ids]) : undefined,
        or(eq(vocabWords.connotation, 'positive'), eq(vocabWords.connotation, 'negative')),
      ));

    const byTier: Record<number, DiagnosticWord[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    for (const r of rows) {
      const tier = TIER_BY_WORD.get(r.id);
      // No empirical read on this word yet — leave it out rather than guess.
      if (!tier) continue;
      byTier[tier].push({ id: r.id, word: r.word, connotation: r.connotation as 'positive' | 'negative', tier });
    }

    for (const tier of Object.keys(byTier)) {
      const list = byTier[Number(tier)];
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
      byTier[Number(tier)] = list.slice(0, PER_TIER);
    }

    return byTier;
  },
  ['vocab-onboarding-diagnostic-pool'],
  { revalidate: 3600 },
);
