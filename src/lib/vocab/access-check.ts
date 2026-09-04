/**
 * Trial-based word access checks.
 *
 * Free (phase 2) users get a *word set*, not a unit range: for each syllabus
 * they follow, themes unlock in course order until that syllabus's
 * trialWordCount is reached — whole themes only, never a half-open one.
 *
 * The gate lives on words rather than units so every view agrees: theme view,
 * letter view and search all filter the same set. (Unit order was the old gate
 * and it broke SAT/GRE, whose words are sprinkled across ~70 WordSmart themes:
 * "units 1-3" unlocked 20 of 250 scattered SAT words.)
 */

import {
  db, vocabWords, vocabUnits, vocabThemes, vocabUserProgress,
  vocabSyllabuses, vocabWordSyllabuses, vocabUserSyllabuses,
} from '@/lib/db';
import { eq, inArray, asc } from 'drizzle-orm';

/** Returns the user's phase (defaults to 2 if no progress row exists). */
export async function getUserPhase(userId: number): Promise<number> {
  const [row] = await db
    .select({ phase: vocabUserProgress.phase })
    .from(vocabUserProgress)
    .where(eq(vocabUserProgress.userId, userId))
    .limit(1);
  return row?.phase ?? 2;
}

export interface UnlockedWords {
  /** null = full access, no filtering needed. */
  ids: Set<number> | null;
  /** Themes reached by `ids` — null when access is full. */
  themeIds: Set<number> | null;
  /** Stable cache-key fragment for this user's access set. */
  key: string;
}

const FULL_ACCESS: UnlockedWords = { ids: null, themeIds: null, key: 'all' };

/**
 * The word ids a user may study. `ids: null` means everything.
 */
export async function getUnlockedWordIds(userId: number): Promise<UnlockedWords> {
  const phase = await getUserPhase(userId);

  const selected = await db
    .select({ syllabusId: vocabUserSyllabuses.syllabusId })
    .from(vocabUserSyllabuses)
    .where(eq(vocabUserSyllabuses.userId, userId));
  const selectedIds = selected.map(s => s.syllabusId);

  if (phase !== 2) {
    // Full-access users see everything unless they've actively picked a
    // syllabus subset via the Study/Practice checkbox filter.
    if (selectedIds.length === 0) return FULL_ACCESS;
    return computeFullSyllabusSet(selectedIds);
  }

  // No selection yet (legacy users, mid-onboarding) — trial every syllabus.
  return computeTrialSet(selectedIds.length ? selectedIds : null);
}

/**
 * The trial word set for a given syllabus selection (null = every syllabus).
 * Exported so onboarding can draw its words from exactly what a new account
 * will be able to study — before that account exists.
 */
export async function computeTrialSet(syllabusIds: number[] | null): Promise<UnlockedWords> {
  const syllabuses = await db
    .select({ id: vocabSyllabuses.id, budget: vocabSyllabuses.trialWordCount })
    .from(vocabSyllabuses);

  const budgets = new Map(
    syllabuses
      .filter(s => syllabusIds === null || syllabusIds.includes(s.id))
      .map(s => [s.id, s.budget]),
  );
  if (budgets.size === 0) return { ids: new Set(), themeIds: new Set(), key: 'none' };

  // Every (syllabus, theme, word) in course order — ~1k rows, cheap to fold.
  const rows = await db
    .select({
      syllabusId: vocabWordSyllabuses.syllabusId,
      themeId:    vocabWords.themeId,
      wordId:     vocabWords.id,
    })
    .from(vocabWordSyllabuses)
    .innerJoin(vocabWords, eq(vocabWordSyllabuses.wordId, vocabWords.id))
    .innerJoin(vocabThemes, eq(vocabWords.themeId, vocabThemes.id))
    .innerJoin(vocabUnits, eq(vocabThemes.unitId, vocabUnits.id))
    .where(inArray(vocabWordSyllabuses.syllabusId, [...budgets.keys()]))
    .orderBy(asc(vocabUnits.order), asc(vocabThemes.order), asc(vocabWords.id));

  const ids = new Set<number>();
  const themeIds = new Set<number>();
  for (const [syllabusId, budget] of budgets) {
    const mine = rows.filter(r => r.syllabusId === syllabusId);
    let taken = 0;
    let themeId: number | null = null;
    for (const r of mine) {
      // Stop only at a theme boundary, so a theme is never half unlocked.
      if (taken >= budget && r.themeId !== themeId) break;
      themeId = r.themeId;
      ids.add(r.wordId);
      if (r.themeId !== null) themeIds.add(r.themeId);
      taken++;
    }
  }

  return { ids, themeIds, key: `trial:${[...budgets.keys()].sort().join('-')}` };
}

/**
 * The full (non-budgeted) word set for a syllabus selection — used for
 * full-access users who've filtered Study/Practice down to specific
 * syllabuses. No trial cap, no course-order walk: they already unlocked
 * everything, this just narrows which of it shows up.
 */
export async function computeFullSyllabusSet(syllabusIds: number[]): Promise<UnlockedWords> {
  const rows = await db
    .select({ wordId: vocabWordSyllabuses.wordId, themeId: vocabWords.themeId })
    .from(vocabWordSyllabuses)
    .innerJoin(vocabWords, eq(vocabWordSyllabuses.wordId, vocabWords.id))
    .where(inArray(vocabWordSyllabuses.syllabusId, syllabusIds));

  const ids = new Set(rows.map(r => r.wordId));
  const themeIds = new Set(rows.map(r => r.themeId).filter((id): id is number => id !== null));
  return { ids, themeIds, key: `full:${[...syllabusIds].sort((a, b) => a - b).join('-')}` };
}

/**
 * Returns true if the given word is inside the user's unlocked set.
 */
export async function canAccessWord(userId: number, wordId: number): Promise<boolean> {
  const { ids } = await getUnlockedWordIds(userId);
  return ids === null || ids.has(wordId);
}

/**
 * Filter a list of wordIds to those the user can access.
 * Returns the full list unchanged for full-access users.
 */
export async function filterAccessibleWordIds(userId: number, wordIds: number[]): Promise<number[]> {
  if (wordIds.length === 0) return [];
  const { ids } = await getUnlockedWordIds(userId);
  if (ids === null) return wordIds;
  return wordIds.filter(id => ids.has(id));
}

/**
 * Returns true if the theme holds at least one word the user can access.
 */
export async function canAccessTheme(userId: number, themeId: number): Promise<boolean> {
  const { themeIds } = await getUnlockedWordIds(userId);
  return themeIds === null || themeIds.has(themeId);
}
