import type { LastWordChain, LastWordSet } from '../content/schema';
import { isEligible, type SelectionCandidate } from '../core/selection';
import type { DecisionRecord, EdgeMastery, MasterySnapshot } from '../core/types';

/**
 * Session planner (§23, §32). Pure: given content, the learner's stored mastery and what has happened so far
 * this session, it returns the next step. A session is one endless stream of single situations drawn from
 * different pairs; the learner ends it with Finish. The XState machine calls it between rounds.
 */
export type Mode = 'journey' | 'quick' | 'review';
export type RoundRole = 'tutorial' | 'review' | 'warmup' | 'diagnostic' | 'probe' | 'practice' | 'shift' | 'transfer' | 'remedial';
export interface Round {
  kind: 'round'; goal: number; role: RoundRole;
  setId: string; chainId: string; edgeId: string;
  /** Display order of the words for this round (shuffled so position never predicts the answer). */
  words: string[];
  hintsAllowed: boolean;
}
export type Card =
  | { kind: 'contrast'; goal: number; edgeId: string; setId: string }
  | { kind: 'message'; goal: number; text: string };
export type Step = Round | Card;
export type Goal = { kind: 'tutorial' };

export interface EdgeContent { edgeId: string; setId: string; set: LastWordSet; chains: { set: LastWordSet; chain: LastWordChain }[] }
export interface PlanState {
  sets: LastWordSet[]; baseline: MasterySnapshot; mode: Mode; now: number; sessionId: string;
  goals: Goal[]; steps: Step[]; records: DecisionRecord[];
}

const DAY = 86_400_000;
const SHIFT_TYPES = new Set(['flip', 'false_shift', 'corrupt', 'rehabilitate', 'reframe']);
/** A missed pair comes back after this many other situations, at most {@link MAX_RETRIES} times a session. */
export const RETRY_GAP = 3;
export const MAX_RETRIES = 2;
/** One situation in this many is a revision of a pair already learned (new pairs come first). */
export const REVISION_EVERY = 10;
/** The stream is saved in segments of this many situations: the server caps one saved session at 100 decisions and one day. */
export const SEGMENT_ROUNDS = 12;

export const TUTORIAL_MESSAGES = {
  flip: 'One detail can change the word.',
  hold: 'New information doesn’t always mean a new answer.',
  end: 'Read the situation. Follow the meaning. Have the Last Word.',
};

/** Edges that have playable (non-tutorial) chains, in content order. The first set that defines an edge owns it. */
export function indexEdges(sets: LastWordSet[]): EdgeContent[] {
  const byId = new Map<string, EdgeContent>();
  for (const set of sets) for (const chain of set.chains) {
    if (chain.purpose === 'tutorial') continue;
    const entry = byId.get(chain.edge_id) ?? { edgeId: chain.edge_id, setId: set.set_id, set, chains: [] };
    entry.chains.push({ set, chain });
    byId.set(chain.edge_id, entry);
  }
  return [...byId.values()];
}

export const dueEdges = (sets: LastWordSet[], baseline: MasterySnapshot, now: number) =>
  indexEdges(sets).filter(e => baseline.reviews[e.edgeId] && baseline.reviews[e.edgeId].dueAt <= now)
    .sort((a, b) => baseline.reviews[a.edgeId].dueAt - baseline.reviews[b.edgeId].dueAt);

/** Only the tutorial is planned up front; everything after it is chosen one situation at a time. */
export function planGoals(sets: LastWordSet[], _baseline: MasterySnapshot, mode: Mode, _now: number, tutorialDone: boolean): Goal[] {
  const hasTutorial = sets.some(set => set.chains.some(chain => chain.purpose === 'tutorial'));
  return mode === 'journey' && !tutorialDone && hasTutorial ? [{ kind: 'tutorial' }] : [];
}

const strong = (edge?: EdgeMastery) => edge?.status === 'Fluent' || edge?.status === 'Mastered';
const rank = (edge?: EdgeMastery) => (!edge ? 2 : strong(edge) ? 3 : edge.status === 'Reliable' ? 1 : 0);

const rounds = (steps: Step[]) => steps.filter((s): s is Round => s.kind === 'round');
const missed = (state: PlanState, round: Round) => state.records.some(r => r.scenarioId === round.chainId && r.correctness === 'incorrect');

/** Returns the next step, or null when the stream has nothing left to show. */
export function nextStep(state: PlanState): { step: Step; goals: Goal[] } | null {
  const step = planStep(state);
  return step ? { step, goals: state.goals } : null;
}

function planStep(state: PlanState): Step | null {
  const tutorial = tutorialStep(state);
  if (tutorial) return tutorial;

  const played = rounds(state.steps).filter(r => r.role !== 'tutorial');
  const last = played.at(-1);
  // A miss shows the boundary at once (once per pair per session), then the pair returns after a few other situations.
  if (last && state.steps.at(-1) === last && missed(state, last) && !state.steps.some(s => s.kind === 'contrast' && s.edgeId === last.edgeId)) {
    return { kind: 'contrast', goal: 1, edgeId: last.edgeId, setId: last.setId };
  }

  const edges = indexEdges(state.sets);
  const playedEdges = new Set(played.map(r => r.edgeId));
  const fresh = (e: EdgeContent) => !playedEdges.has(e.edgeId);
  const review = (e: EdgeContent) => state.baseline.reviews[e.edgeId];

  // Retries: pairs whose latest situation was missed, with room under the cap. `ready` ones have waited long enough.
  const retries = edges.flatMap(e => {
    const mine = played.filter(r => r.edgeId === e.edgeId);
    const latest = mine.at(-1);
    if (!latest || !missed(state, latest) || mine.filter(r => r.role === 'remedial').length >= MAX_RETRIES) return [];
    return [{ e, since: played.length - 1 - played.lastIndexOf(latest) }];
  }).sort((a, b) => b.since - a.since);
  const ready = retries.filter(r => r.since >= RETRY_GAP).map(r => r.e);
  const waiting = retries.map(r => r.e);

  const dueNow = dueEdges(state.sets, state.baseline, state.now).filter(fresh);
  const dueMissed = dueNow.filter(e => review(e).intervalDays === 0);
  const dueRevision = dueNow.filter(e => review(e).intervalDays > 0);
  const unseen = edges.filter(e => fresh(e) && !state.baseline.edges[e.edgeId]);

  const pick = (list: EdgeContent[], role: RoundRole, allowSame = false) => {
    for (const e of list) {
      if (!allowSame && e.edgeId === last?.edgeId) continue;
      const next = chooseRound(state, 1, role, e);
      if (next) return next;
    }
    return null;
  };

  if (state.mode === 'review') return pick(ready, 'remedial') ?? pick(dueNow, 'review') ?? pick(waiting, 'remedial', true);
  if (state.mode === 'quick') {
    const seen = edges.filter(e => fresh(e) && state.baseline.edges[e.edgeId]).sort((a, b) => rank(state.baseline.edges[a.edgeId]) - rank(state.baseline.edges[b.edgeId]));
    return pick(ready, 'remedial') ?? pick(seen, 'practice') ?? pick(waiting, 'remedial', true);
  }
  // Journey: wrong answers first, then everything new; learned pairs are revised only one situation in ten, or once nothing new is left.
  const revisionSlot = played.length > 0 && played.length % REVISION_EVERY === REVISION_EVERY - 1;
  return pick(ready, 'remedial') ?? pick(dueMissed, 'remedial') ?? (revisionSlot ? pick(dueRevision, 'review') : null)
    ?? pick(unseen, 'practice') ?? pick(dueRevision, 'review') ?? pick(waiting, 'remedial', true);
}

function tutorialStep(state: PlanState): Step | null {
  if (!state.goals.some(g => g.kind === 'tutorial')) return null;
  const mine = state.steps.filter(s => s.goal === 0);
  const played = rounds(mine);
  const tutorial = state.sets.flatMap(set => set.chains.filter(chain => chain.purpose === 'tutorial').map(chain => ({ set, chain })));
  for (const { set, chain } of tutorial) {
    if (!played.some(r => r.chainId === chain.id)) return round(state, 0, 'tutorial', set, chain);
    const flips = new Set(chain.beats.map(b => b.best_word)).size > 1;
    const text = flips ? TUTORIAL_MESSAGES.flip : TUTORIAL_MESSAGES.hold;
    if (!mine.some(s => s.kind === 'message' && s.text === text)) return { kind: 'message', goal: 0, text };
  }
  if (!mine.some(s => s.kind === 'message' && s.text === TUTORIAL_MESSAGES.end)) return { kind: 'message', goal: 0, text: TUTORIAL_MESSAGES.end };
  return null;
}

function chooseRound(state: PlanState, g: number, role: RoundRole, edge: EdgeContent): Round | null {
  const used = new Set(rounds(state.steps).map(r => r.chainId));
  const seen = state.baseline.edges[edge.edgeId]?.scenarioSessions ?? {};
  const history = rounds(state.steps).map(r => candidateFor(state, r.setId, r.chainId, r.words));
  const missedTags = new Set(state.records.filter(r => r.edgeId === edge.edgeId && r.correctness === 'incorrect' && r.misconceptionTag).map(r => r.misconceptionTag));
  const options = edge.chains.filter(({ chain }) => !used.has(chain.id)).map(({ set, chain }) => {
    const shift = chain.beats.some(b => SHIFT_TYPES.has(b.shift_type)) || SHIFT_TYPES.has(chain.chain_type ?? '');
    let score = seen[chain.id] ? -100 : 0; // ponytail: a seen chain is only reused when the bank has nothing novel left.
    if (role === 'diagnostic') score += (chain.purpose === 'diagnostic' ? 50 : chain.purpose === 'practice' ? 10 : 0) - chain.difficulty;
    if (role === 'probe') score += (chain.purpose === 'probe' ? 50 : 0) + (shift ? 20 : 0) + (chain.purpose === 'transfer' ? 10 : 0) + chain.difficulty;
    if (role === 'practice' || role === 'warmup') score += (chain.purpose === 'practice' ? 20 : 0) - (role === 'warmup' ? chain.difficulty : Math.abs(chain.difficulty - 3));
    if (role === 'shift') score += shift ? 30 + chain.difficulty : -1000;
    if (role === 'transfer' || role === 'review') score += chain.purpose === 'transfer' ? 30 : role === 'transfer' ? -1000 : 0;
    if (role === 'remedial') score += (chain.beats.some(b => Object.values(b.misconception_by_wrong_choice).some(tag => missedTags.has(tag))) ? 20 : 0) - chain.difficulty * 2;
    if (role !== 'diagnostic' && chain.purpose === 'diagnostic') score -= 40;
    return { set, chain, score };
  }).filter(o => o.score > -500).sort((a, b) => b.score - a.score || a.chain.id.localeCompare(b.chain.id));
  for (const { set, chain } of options) {
    for (const words of orders(state.sessionId, chain.id, set)) {
      if (isEligible(candidateFor(state, set.set_id, chain.id, words), history)) return round(state, g, role, set, chain, words);
    }
  }
  return null;
}

function round(state: PlanState, g: number, role: RoundRole, set: LastWordSet, chain: LastWordChain, words = orders(state.sessionId, chain.id, set)[0]): Round {
  return { kind: 'round', goal: g, role, setId: set.set_id, chainId: chain.id, edgeId: chain.edge_id, words, hintsAllowed: role !== 'tutorial' };
}

/** A deterministic shuffle per session and chain, plus its reverse as the fallback order. */
function orders(sessionId: string, chainId: string, set: LastWordSet): string[][] {
  let seed = 2166136261;
  for (const c of `${sessionId}:${chainId}`) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619) >>> 0;
  const words = set.words.map(w => w.word);
  for (let i = words.length - 1; i > 0; i--) {
    seed = Math.imul(seed ^ (seed >>> 15), 2246822519) >>> 0;
    const j = seed % (i + 1);
    [words[i], words[j]] = [words[j], words[i]];
  }
  return [words, [...words].reverse()];
}

function candidateFor(state: PlanState, setId: string, chainId: string, words: string[]): SelectionCandidate {
  const set = state.sets.find(s => s.set_id === setId)!;
  const chain = set.chains.find(c => c.id === chainId)!;
  const bests = chain.beats.map(b => b.best_word);
  const final = chain.beats.at(-1)!;
  return {
    id: chain.id, edgeId: chain.edge_id, domain: chain.domain, characters: chain.characters,
    clue: final.decisive_clue.toLowerCase(), bestWord: final.best_word, bestPosition: words.indexOf(final.best_word),
    flips: new Set(bests).size > 1, allBeatsFlip: bests.length > 1 && bests.every((b, i) => i === 0 || b !== bests[i - 1]), priority: 0,
  };
}

/** Days since the edge was last verified, as evidence for retention (§13.1). */
export const reviewIntervalDays = (baseline: MasterySnapshot, edgeId: string, now: number) => {
  const last = baseline.edges[edgeId]?.lastVerified;
  return last === undefined ? 0 : Math.max(0, (now - last) / DAY);
};
