/**
 * "Biggest missed chances", per section: the questions this student got wrong or skipped that most of
 * the cohort got right — the cheapest marks they left behind. Pure (no DB): fed from getTestResults().
 */

export interface MissedChance {
  questionId: number;
  number: number;
  cohortCorrectPct: number;
  mine: 'wrong' | 'skipped';
  yourAnswer: string | null;
  correctAnswer: string;
}

export interface SectionMissed {
  sectionId: number;
  title: string;
  wrong: number;
  skipped: number;
  /** marks lost to wrong-answer penalties in this section */
  penaltyLost: number;
  chances: MissedChance[];
}

export interface MissedChancesInput {
  sections: Array<{
    id: number;
    title: string;
    penaltyPerWrong: number;
    questions: Array<{ id: number; number: number }>;
  }>;
  analytics: Record<number, { correctCount: number; wrongCount: number; skippedCount: number }>;
  responses: Record<number, { selected: string | null; correct: string | null; isCorrect: boolean | null }>;
}

/** limit = chances listed per section; minPct = ignore questions fewer than this % of the cohort got right. */
export function computeMissedChances(input: MissedChancesInput, limit = 5, minPct = 30): SectionMissed[] {
  return input.sections.map(section => {
    let wrong = 0, skipped = 0;
    const chances: MissedChance[] = [];

    for (const q of section.questions) {
      const r = input.responses[q.id];
      if (!r || !r.correct || r.isCorrect) continue; // no key loaded, or answered right
      const mine = r.selected ? 'wrong' : 'skipped';
      if (mine === 'wrong') wrong++; else skipped++;

      const a = input.analytics[q.id];
      const total = a ? a.correctCount + a.wrongCount + a.skippedCount : 0;
      const pct = total > 0 ? Math.round((a.correctCount / total) * 100) : 0;
      if (pct < minPct) continue;
      chances.push({
        questionId: q.id, number: q.number, cohortCorrectPct: pct,
        mine, yourAnswer: r.selected, correctAnswer: r.correct,
      });
    }

    chances.sort((x, y) => y.cohortCorrectPct - x.cohortCorrectPct || x.number - y.number);
    return {
      sectionId: section.id,
      title: section.title,
      wrong,
      skipped,
      penaltyLost: Math.round(wrong * section.penaltyPerWrong * 100) / 100,
      chances: chances.slice(0, limit),
    };
  });
}
