/** Pure scheduler constraints; null means the bank needs a fresh item, never relax fairness silently. */
export interface SelectionCandidate {
  id: string;
  edgeId: string;
  domain: string;
  characters: string[];
  template: string;
  clue: string;
  bestWord: string;
  bestPosition: number;
  flips: boolean;
  allBeatsFlip: boolean;
  priority: number;
}
export function isEligible(candidate: SelectionCandidate, history: SelectionCandidate[]): boolean {
  if (history.some(item => item.id === candidate.id)) return false;
  const recent = history.slice(-3);
  const last = history.at(-1);
  if (candidate.flips && recent.length === 3 && recent.every(item => item.flips)) return false;
  if (last && candidate.allBeatsFlip && last.allBeatsFlip) return false;
  if (last && (last.domain === candidate.domain || last.template === candidate.template || last.clue === candidate.clue || candidate.characters.some(character => last.characters.includes(character)))) return false;
  if (recent.some(item => item.bestWord === candidate.bestWord && item.bestPosition === candidate.bestPosition)) return false;
  if (recent.length === 3 && recent[0].bestWord === recent[2].bestWord && recent[1].bestWord === candidate.bestWord && recent[0].bestWord !== candidate.bestWord) return false;
  return true;
}
export function selectNextItem(candidates: SelectionCandidate[], history: SelectionCandidate[]): SelectionCandidate | null {
  return candidates.filter(candidate => isEligible(candidate, history)).sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))[0] ?? null;
}
