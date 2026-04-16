/**
 * Phase-based word access checks.
 *
 * Free users (phase 2) can only access words from units with order <=
 * PHASE1_MAX_UNIT_ORDER. These helpers centralize that check for API routes
 * and server components.
 */

import { db, vocabWords, vocabUnits, vocabThemes, vocabUserProgress } from '@/lib/db';
import { eq, inArray, and, lte } from 'drizzle-orm';
import { PHASE1_MAX_UNIT_ORDER } from './constants';

/** Returns the user's phase (defaults to 2 if no progress row exists). */
export async function getUserPhase(userId: number): Promise<number> {
  const [row] = await db
    .select({ phase: vocabUserProgress.phase })
    .from(vocabUserProgress)
    .where(eq(vocabUserProgress.userId, userId))
    .limit(1);
  return row?.phase ?? 2;
}

/**
 * Returns true if the given word belongs to a unit the user can access.
 */
export async function canAccessWord(userId: number, wordId: number): Promise<boolean> {
  const phase = await getUserPhase(userId);
  if (phase !== 2) return true;

  const [row] = await db
    .select({ order: vocabUnits.order })
    .from(vocabWords)
    .innerJoin(vocabUnits, eq(vocabWords.unitId, vocabUnits.id))
    .where(eq(vocabWords.id, wordId))
    .limit(1);

  if (!row) return false;
  return row.order <= PHASE1_MAX_UNIT_ORDER;
}

/**
 * Filter a list of wordIds to those the user can access.
 * Returns the full list unchanged for phase-1 users.
 */
export async function filterAccessibleWordIds(userId: number, wordIds: number[]): Promise<number[]> {
  if (wordIds.length === 0) return [];
  const phase = await getUserPhase(userId);
  if (phase !== 2) return wordIds;

  const rows = await db
    .select({ id: vocabWords.id })
    .from(vocabWords)
    .innerJoin(vocabUnits, eq(vocabWords.unitId, vocabUnits.id))
    .where(and(
      inArray(vocabWords.id, wordIds),
      lte(vocabUnits.order, PHASE1_MAX_UNIT_ORDER),
    ));

  return rows.map(r => r.id);
}

/**
 * Returns true if the theme belongs to a unit the user can access.
 */
export async function canAccessTheme(userId: number, themeId: number): Promise<boolean> {
  const phase = await getUserPhase(userId);
  if (phase !== 2) return true;

  const [row] = await db
    .select({ order: vocabUnits.order })
    .from(vocabThemes)
    .innerJoin(vocabUnits, eq(vocabThemes.unitId, vocabUnits.id))
    .where(eq(vocabThemes.id, themeId))
    .limit(1);

  if (!row) return false;
  return row.order <= PHASE1_MAX_UNIT_ORDER;
}
