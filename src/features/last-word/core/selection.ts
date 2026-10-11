/** Pure scheduler constraints (§33); null means the bank needs a fresh item, never relax fairness silently. */
export interface SelectionCandidate {
  id: string;
  edgeId: string;
  domain: string;
  characters: string[];
  /** Decisive clue of the final beat, normalised. */
  clue: string;
  /** Final best word and the position it is shown in. */
  bestWord: string;
  bestPosition: number;
  /** The answer changes at least once / at every later beat. */
  flips: boolean;
  allBeatsFlip: boolean;
  priority: number;
}

export function isEligible(candidate: SelectionCandidate, history: SelectionCandidate[]): boolean {
  if (history.some(item => item.id === candidate.id)) return false;
  const recent = history.slice(-3);
  const last = history.at(-1);
  // No more than three flipping rounds in a row; no two all-flip rounds back to back.
  if (candidate.flips && recent.length === 3 && recent.every(item => item.flips)) return false;
  if (last?.allBeatsFlip && candidate.allBeatsFlip) return false;
  // No repeated domain, cast, or clue phrase back to back.
  if (last && (last.domain === candidate.domain || last.clue === candidate.clue || candidate.characters.some(name => last.characters.includes(name)))) return false;
  // The same word must not be correct in the same position three times running.
  const lastTwo = history.slice(-2);
  if (lastTwo.length === 2 && lastTwo.every(item => item.bestWord === candidate.bestWord && item.bestPosition === candidate.bestPosition)) return false;
  // No A-B-A-B alternation of the correct word.
  if (recent.length === 3 && recent[0].bestWord === recent[2].bestWord && recent[1].bestWord === candidate.bestWord && recent[0].bestWord !== candidate.bestWord) return false;
  return true;
}

export function selectNextItem(candidates: SelectionCandidate[], history: SelectionCandidate[]): SelectionCandidate | null {
  return candidates.filter(candidate => isEligible(candidate, history)).sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))[0] ?? null;
}
