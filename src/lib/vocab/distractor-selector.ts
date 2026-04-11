/**
 * T18 — Distractor Selection Engine
 *
 * Selects 4 distractors for a quiz question given a correct-answer word.
 * Tiers:
 *   Tier 1 — same theme, synonym overlap, same POS+unit, or user confusion pairs (after 10 answers)
 *   Tier 2 — same unit, different theme
 *   Tier 3 — different unit (max 1 per question)
 * Quality gate: at least 3 of 4 distractors must be Tier 1 or 2.
 */

export interface WordForDistractor {
  id:              number;
  word:            string;
  definition:      string;
  synonyms:        string[];  // already parsed from JSON
  antonyms:        string[];  // already parsed from JSON
  exampleSentence: string;
  partOfSpeech:    string;
  themeId:         number;
  unitId:          number;
  difficultyBase:  number;
}

export interface ConfusionEntry {
  wordBId: number;
  count:   number;
}

export interface DistractorSelection {
  /** The 4 selected distractor words. */
  distractors:  WordForDistractor[];
  /** All 5 options in display order (A–E), correct answer placed randomly. */
  allOptions:   WordForDistractor[];
  /** 0-based index of correct answer in allOptions. */
  correctIndex: number;
  /** Letter label of correct answer. */
  correctLetter: 'A' | 'B' | 'C' | 'D' | 'E';
}

// ─── Internal types ───────────────────────────────────────────────────────────

interface Candidate {
  word: WordForDistractor;
  tier: 1 | 2 | 3;
  confusionCount: number; // >0 if user previously confused this with the correct word
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function synonymOverlap(a: string[], b: string[]): boolean {
  const setB = new Set(b.map(s => s.toLowerCase().trim()));
  return a.some(s => setB.has(s.toLowerCase().trim()));
}

function classifyTier(
  candidate:     WordForDistractor,
  correct:       WordForDistractor,
  isConfusion:   boolean,
  totalAnswers:  number,
): 1 | 2 | 3 {
  // Confusion pairs elevate to Tier 1 once personalisation kicks in
  if (totalAnswers >= 10 && isConfusion) return 1;

  if (candidate.themeId === correct.themeId) return 1;

  if (synonymOverlap(candidate.synonyms, correct.synonyms)) return 1;

  if (
    candidate.partOfSpeech === correct.partOfSpeech &&
    candidate.unitId === correct.unitId
  ) return 1;

  if (candidate.unitId === correct.unitId) return 2;

  return 3;
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Select 4 distractors and assemble the full 5-option set.
 *
 * @param correct       - The correct-answer word for this question.
 * @param pool          - All candidate words (may include `correct`; it is filtered out internally).
 * @param confusionPairs - Words this user previously confused with `correct` (wordAId === correct.id).
 * @param totalAnswers  - Total quiz answers the user has submitted across all sessions.
 */
export function selectDistractors(
  correct:        WordForDistractor,
  pool:           WordForDistractor[],
  confusionPairs: ConfusionEntry[],
  totalAnswers:   number,
): DistractorSelection {
  const confusionMap = new Map<number, number>(
    confusionPairs.map(c => [c.wordBId, c.count]),
  );

  // Build classified candidates (exclude correct word itself)
  const candidates: Candidate[] = pool
    .filter(w => w.id !== correct.id)
    .map(w => {
      const confusionCount = confusionMap.get(w.id) ?? 0;
      return {
        word:          w,
        tier:          classifyTier(w, correct, confusionCount > 0, totalAnswers),
        confusionCount,
      };
    });

  const tier1 = candidates.filter(c => c.tier === 1);
  const tier2 = candidates.filter(c => c.tier === 2);
  const tier3 = candidates.filter(c => c.tier === 3);

  // Within Tier 1: confusion pairs come first (sorted by count desc), rest shuffled
  const tier1Confusion = shuffle(tier1.filter(c => c.confusionCount > 0))
    .sort((a, b) => b.confusionCount - a.confusionCount);
  const tier1Other    = shuffle(tier1.filter(c => c.confusionCount === 0));
  const orderedTier1  = [...tier1Confusion, ...tier1Other];
  const shuffledTier2 = shuffle(tier2);
  const shuffledTier3 = shuffle(tier3);

  const chosen: Candidate[] = [];
  const usedIds = new Set<number>();

  function pick(source: Candidate[], maxCount: number): void {
    for (const c of source) {
      if (chosen.length >= maxCount) break;
      if (!usedIds.has(c.word.id)) {
        chosen.push(c);
        usedIds.add(c.word.id);
      }
    }
  }

  // Fill: prefer Tier 1 (up to 3), then Tier 2, then at most 1 Tier 3
  pick(orderedTier1, 3);
  pick(shuffledTier2, 4);
  if (chosen.length < 4) pick(shuffledTier3, 4); // fallback for sparse pools

  // Quality gate — ensure at least 3 distractors are Tier 1 or 2
  const tier12Count = chosen.filter(c => c.tier <= 2).length;
  if (tier12Count < 3) {
    // Replace any Tier 3 entries with the next available Tier 1/2
    const replacementPool = [
      ...orderedTier1.filter(c => !usedIds.has(c.word.id)),
      ...shuffledTier2.filter(c => !usedIds.has(c.word.id)),
    ];
    for (let i = 0; i < chosen.length && replacementPool.length > 0; i++) {
      if (chosen[i].tier === 3) {
        const replacement = replacementPool.shift()!;
        usedIds.delete(chosen[i].word.id);
        chosen[i] = replacement;
        usedIds.add(replacement.word.id);
      }
    }
  }

  const distractors = chosen.slice(0, 4).map(c => c.word);
  const totalOptions = distractors.length + 1; // normally 5; fewer only if pool is very sparse

  // Place correct answer at a random position within available slots
  const LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;
  const correctIndex  = Math.floor(Math.random() * totalOptions);
  const correctLetter = LETTERS[correctIndex];

  const allOptions: WordForDistractor[] = [];
  let di = 0;
  for (let i = 0; i < totalOptions; i++) {
    allOptions.push(i === correctIndex ? correct : distractors[di++]);
  }

  return { distractors, allOptions, correctIndex, correctLetter };
}
