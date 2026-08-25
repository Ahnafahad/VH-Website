/**
 * Today's Briefing — shared curated-session ranking.
 *
 * Replaces recommendation.ts's ad-hoc if-chain with a fixed taxonomy of
 * named "cases" so Home's single hero card and Study/Practice's card lists
 * are driven by the exact same priority order and never disagree.
 *
 *   resume            — an in-progress quiz or flashcard set (always first)
 *   repeat_offenders  — weak/overdue words, ranked by priority-score.ts
 *   deadline_file      — pace-sized batch of next words, only if a deadline is set
 *   fresh              — next unstarted theme (Study) / studied-but-unquizzed theme (Practice)
 */

import { rankByPriority, type WordPriorityInput } from './priority-score';

export type BriefingKind = 'resume' | 'repeat_offenders' | 'deadline_file' | 'fresh';

const KIND_PRIORITY: Record<BriefingKind, number> = {
  resume:           0,
  repeat_offenders: 1,
  deadline_file:    2,
  fresh:            3,
};

/** Stable sort by fixed kind precedence — the single ordering rule every page shares. */
export function sortByBriefingPriority<T extends { kind: BriefingKind }>(cards: T[]): T[] {
  return [...cards].sort((a, b) => KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind]);
}

/**
 * Repeat Offenders — priority-ranked weak/overdue word ids, shared by Home
 * (single hero card) and Practice (full card + the actual quiz session) so
 * both surfaces always agree on the same words and the same count, and the
 * Home card can link straight to the real session instead of a stand-in.
 * Returns [] when there aren't enough qualifying words to bother surfacing.
 */
export function computeRepeatOffenders(inputs: WordPriorityInput[]): number[] {
  const worst = rankByPriority(inputs).filter(w => w.priorityScore > 40);
  if (worst.length < 5) return [];
  return worst.slice(0, 20).map(w => w.wordId);
}

/**
 * Words/day required to clear `remainingWords` by `deadline`.
 * Shared by daily-message.ts, home-data.ts and practice-data.ts so the
 * pace math can't drift between the three call sites.
 */
export function computeRequiredPace(
  deadline: Date | null,
  remainingWords: number,
): { requiredPace: number | null; daysUntilDeadline: number | null } {
  if (!deadline) return { requiredPace: null, daysUntilDeadline: null };
  const daysLeft = Math.ceil((deadline.getTime() - Date.now()) / 86_400_000);
  if (daysLeft <= 0) return { requiredPace: null, daysUntilDeadline: null };
  return {
    requiredPace:      Math.max(1, Math.ceil(remainingWords / daysLeft)),
    daysUntilDeadline: daysLeft,
  };
}
