/**
 * Live content QA (§44, §45, §51): learner behaviour as evidence that an item may be bad.
 * Pure: takes decision rows already read from last_word_decisions.
 */
export interface DecisionRow {
  scenarioId: string;
  beatId: string;
  selectedWord: string;
  bestWord: string;
  correctness: string;
  semanticFit: number;
  reactionTimeMs: number;
  /** Learner's edge status when the decision was made (from the stored record), if known. */
  learnerStrong: boolean;
}
export interface ItemFlag { scenarioId: string; beatId: string; n: number; reasons: string[] }

const MIN_N = 12;

export function flagItems(rows: DecisionRow[]): ItemFlag[] {
  const byBeat = new Map<string, DecisionRow[]>();
  for (const row of rows) byBeat.set(`${row.scenarioId} ${row.beatId}`, [...(byBeat.get(`${row.scenarioId} ${row.beatId}`) ?? []), row]);
  const medianTime = median(rows.map(r => r.reactionTimeMs));
  const flags: ItemFlag[] = [];
  for (const list of byBeat.values()) {
    if (list.length < MIN_N) continue;
    const reasons: string[] = [];
    const strong = list.filter(r => r.learnerStrong);
    const strongMiss = strong.filter(r => r.correctness !== 'best').length / Math.max(1, strong.length);
    if (strong.length >= 5 && strongMiss >= 0.4) reasons.push(`${Math.round(strongMiss * 100)}% of strong learners miss it`);
    const counts = new Map<string, number>();
    for (const r of list) counts.set(r.selectedWord, (counts.get(r.selectedWord) ?? 0) + 1);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    if (top.length > 1 && top[1][1] / list.length >= 0.4) reasons.push(`answers split ${top.map(([w, c]) => `${w} ${Math.round((c / list.length) * 100)}%`).join(' / ')}`);
    const implausible = list.filter(r => r.correctness === 'incorrect' && r.semanticFit < 0.25).length / list.length;
    if (implausible >= 0.3) reasons.push(`${Math.round(implausible * 100)}% pick an answer rated implausible (fit < 0.25)`);
    const time = median(list.map(r => r.reactionTimeMs));
    if (medianTime > 0 && time > medianTime * 2.5) reasons.push(`slow: median ${Math.round(time / 1000)} s vs ${Math.round(medianTime / 1000)} s overall`);
    if (reasons.length) flags.push({ scenarioId: list[0].scenarioId, beatId: list[0].beatId, n: list.length, reasons });
  }
  return flags.sort((a, b) => b.reasons.length - a.reasons.length || b.n - a.n);
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/** Position bias (§44): share of decisions where the best word sat in each display slot. */
export function positionBias(rows: { presentedWords: string[]; bestWord: string; correctness: string }[]) {
  const slots = new Map<number, { shown: number; right: number }>();
  for (const r of rows) {
    const i = r.presentedWords.indexOf(r.bestWord);
    const s = slots.get(i) ?? { shown: 0, right: 0 };
    s.shown++;
    if (r.correctness === 'best') s.right++;
    slots.set(i, s);
  }
  return [...slots.entries()].sort((a, b) => a[0] - b[0]).map(([slot, s]) => ({ slot: slot + 1, shown: s.shown, accuracy: s.shown ? s.right / s.shown : 0 }));
}
