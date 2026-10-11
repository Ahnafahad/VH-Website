import type { LastWordSet } from './schema';

export interface ContentProblem {
  /** `error` withholds the chain (or the set, when chainId is absent) from play; `warning` is editorial. */
  level: 'error' | 'warning';
  chainId?: string;
  message: string;
}

const words = (text: string) => text.trim().split(/\s+/).length;
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Ported from `problems()` in docs/last-word/content-pipeline/scripts/run-gen.mjs and extended.
 * Reports only; it never rewrites wording. Runs on the runtime schema, after conversion.
 */
export function contentProblems(set: LastWordSet): ContentProblem[] {
  const out: ContentProblem[] = [];
  const err = (message: string, chainId?: string) => out.push({ level: 'error', chainId, message });
  const warn = (message: string, chainId?: string) => out.push({ level: 'warning', chainId, message });
  const candidates = set.words.map(word => word.word);
  // ponytail: prefix match on each word minus a final e/y; irregular derivatives (compel → compulsion) slip through.
  const leak = new RegExp(`\\b(${candidates.map(word => escape(word.toLowerCase().replace(/[ey]$/, ''))).join('|')})`, 'i');
  const domains = new Map<string, number>();
  const texts = new Map<string, string>();
  const finals = new Map<string, number>();
  let practice = 0;

  for (const chain of set.chains) {
    const id = chain.id;
    domains.set(chain.domain, (domains.get(chain.domain) ?? 0) + 1);
    if (chain.beats.length < 2 && chain.purpose !== 'diagnostic') err('Only cold diagnostic items may contain one beat.', id);
    if (words(chain.feedback_short) > 22) err(`feedback_short has ${words(chain.feedback_short)} words (max 22).`, id);
    if (words(chain.feedback_deep) > 80) err(`feedback_deep has ${words(chain.feedback_deep)} words (max 80).`, id);
    if (!chain.frame && chain.purpose !== 'tutorial') warn('No frame: the subject the word labels is not stated.', id);

    chain.beats.forEach((beat, i) => {
      const where = `beat ${i + 1}`;
      const top = Math.max(...candidates.map(word => beat.fit[word]));
      if (beat.fit[beat.best_word] < top) err(`${where}: best_word is not the top fit.`, id);
      else if (candidates.filter(word => beat.fit[word] === top).length > 1) err(`${where}: two words tie for top fit, so "best" is arbitrary.`, id);
      if (beat.fit[beat.best_word] < 0.7) warn(`${where}: best fit is ${beat.fit[beat.best_word]} (below 0.7, “strongly defensible” per §9).`, id);
      if (leak.test(beat.text)) err(`${where}: context contains a candidate word or its stem.`, id);
      if (!beat.text.includes(beat.decisive_clue)) warn(`${where}: decisive_clue is not an exact excerpt, so it is shown quoted instead of highlighted.`, id);
      for (const word of candidates) {
        if (word !== beat.best_word && beat.fit[word] < 0.4 && !beat.misconception_by_wrong_choice[word]) warn(`${where}: no misconception tag for wrong choice "${word}".`, id);
      }
      const seen = texts.get(beat.text.toLowerCase());
      if (seen && seen !== id) warn(`${where}: identical text also appears in ${seen}.`, id);
      texts.set(beat.text.toLowerCase(), id);
      if (i === 0) {
        if (beat.shift_type !== 'initial') err('beat 1: shift_type must be initial.', id);
        return;
      }
      const changed = chain.beats[i - 1].best_word !== beat.best_word;
      if (beat.shift_type === 'initial') err(`${where}: only the first beat may be initial.`, id);
      if (changed && ['stay', 'false_shift'].includes(beat.shift_type)) err(`${where}: ${beat.shift_type} beat changes the answer.`, id);
      if (!changed && ['flip', 'rehabilitate', 'corrupt'].includes(beat.shift_type)) err(`${where}: ${beat.shift_type} beat keeps the answer.`, id);
    });

    const bests = chain.beats.map(beat => beat.best_word);
    const changed = new Set(bests).size > 1;
    if (chain.chain_type === 'flip' && !changed) err('flip chain never flips.', id);
    if ((chain.chain_type === 'stay' || chain.chain_type === 'false_shift') && changed) err(`${chain.chain_type} chain changes the answer.`, id);
    if (chain.purpose !== 'tutorial') {
      practice++;
      finals.set(bests.at(-1)!, (finals.get(bests.at(-1)!) ?? 0) + 1);
    }
  }

  for (const [domain, count] of domains) if (count > 2) warn(`Domain "${domain}" is used ${count} times (max 2 keeps contexts varied).`);
  // §33: the same word must not win too often. A 30–70% band for pairs, scaled by word count.
  if (practice >= 6) {
    const fair = 1 / candidates.length;
    for (const word of candidates) {
      const share = (finals.get(word) ?? 0) / practice;
      if (share < fair * 0.6 || share > Math.min(0.85, fair * 1.4)) warn(`Final answer "${word}" in ${finals.get(word) ?? 0}/${practice} chains (position/answer bias).`);
    }
  }
  return out;
}

/** Chains that may be played: no chain-level errors. */
export function playableChainIds(set: LastWordSet, problems = contentProblems(set)): Set<string> {
  const bad = new Set(problems.filter(p => p.level === 'error' && p.chainId).map(p => p.chainId));
  return new Set(set.chains.map(chain => chain.id).filter(id => !bad.has(id)));
}
