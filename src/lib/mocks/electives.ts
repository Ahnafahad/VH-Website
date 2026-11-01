/**
 * Written parts of an elective-subject mock (see tests.electiveCount): essay k of the linked series is
 * the k-th section's paper, and a student only does the sections they chose when starting the MCQ part.
 */

import { db } from '@/lib/db';
import { tests, testSections, testAttempts } from '@/lib/db/schema';
import { and, asc, eq, isNotNull } from 'drizzle-orm';
import { essayIndexesForSections, parseChosenSections } from '@/lib/tests/diagnostic';

export interface EssayGate {
  /** false until the student has started the MCQ part (that is when they pick their subjects) */
  answered: boolean;
  /** 1-based essay indexes this student writes */
  allowed: Set<number>;
}

/** null when the series isn't the written part of an elective mock — every essay applies. */
export async function getEssayGate(userId: number, seriesId: number): Promise<EssayGate | null> {
  const test = await db.select({ id: tests.id }).from(tests)
    .where(and(eq(tests.essaySeriesId, seriesId), isNotNull(tests.electiveCount))).get();
  if (!test) return null;
  const [sections, attempt] = await Promise.all([
    db.select({ id: testSections.id }).from(testSections).where(eq(testSections.testId, test.id)).orderBy(asc(testSections.order)),
    db.select({ chosenSections: testAttempts.chosenSections }).from(testAttempts)
      .where(and(eq(testAttempts.testId, test.id), eq(testAttempts.userId, userId))).get(),
  ]);
  const chosen = parseChosenSections(attempt?.chosenSections ?? null);
  return { answered: chosen.length > 0, allowed: new Set(essayIndexesForSections(sections.map(s => s.id), chosen)) };
}
