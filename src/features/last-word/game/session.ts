import type { LastWordChain, LastWordSet } from '../content/schema';
import { diagnosticOutcome, type DiagnosticResult } from '../core/learning';
import { isEligible, type SelectionCandidate } from '../core/selection';
import type { DecisionRecord, EdgeMastery, MasterySnapshot } from '../core/types';

/**
 * Adaptive session planner (§23, §32). Pure: given content, the learner's stored mastery and what has
 * happened so far this session, it returns the next step. The XState machine calls it between rounds;
 * nothing here depends on rendering or animation.
 */
export type Mode = 'journey' | 'quick' | 'review';
export type RoundRole = 'tutorial' | 'review' | 'warmup' | 'diagnostic' | 'probe' | 'practice' | 'shift' | 'transfer' | 'remedial';
export interface Round {
  kind: 'round'; goal: number; role: RoundRole;
  setId: string; chainId: string; edgeId: string;
  /** Display order of the words for this round (shuffled so position never predicts the answer). */
  words: string[];
  askConfidence: boolean; hintsAllowed: boolean;
}
export type Card =
  | { kind: 'intro'; goal: number; edgeId: string; setId: string }
  | { kind: 'diagnosis'; goal: number; edgeId: string; result: DiagnosticResult }
  | { kind: 'contrast'; goal: number; edgeId: string; setId: string }
  | { kind: 'anchors'; goal: number; edgeId: string; setId: string }
  | { kind: 'message'; goal: number; text: string };
export type Step = Round | Card;
export type Goal =
  | { kind: 'tutorial' }
  | { kind: 'review'; edgeId: string }
  | { kind: 'warmup'; edgeId: string }
  | { kind: 'learn'; edgeId: string }
  | { kind: 'mixed'; edgeId: string };

export interface EdgeContent { edgeId: string; setId: string; set: LastWordSet; chains: { set: LastWordSet; chain: LastWordChain }[] }
export interface PlanState {
  sets: LastWordSet[]; baseline: MasterySnapshot; mode: Mode; now: number; sessionId: string;
  goals: Goal[]; steps: Step[]; records: DecisionRecord[];
}

const DAY = 86_400_000;
const strong = (edge?: EdgeMastery) => edge?.status === 'Fluent' || edge?.status === 'Mastered';
const SHIFT_TYPES = new Set(['flip', 'false_shift', 'corrupt', 'rehabilitate', 'reframe']);
/**
 * Rounds a journey aims for before it stops adding new distinctions. The spec's 4–7 minutes (§23) was cut to a
 * 2–3 minute default for phones: a new distinction is two cold reads plus two learning rounds.
 */
export const JOURNEY_ROUNDS = 4;
/** Learning rounds per distinction (§23 had four): one practice, then one hard shift. */
export const LEARNING_ROUNDS = 2;

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

export function planGoals(sets: LastWordSet[], baseline: MasterySnapshot, mode: Mode, now: number, tutorialDone: boolean): Goal[] {
  const edges = indexEdges(sets);
  const due = dueEdges(sets, baseline, now);
  if (mode === 'review') return due.slice(0, JOURNEY_ROUNDS).map(e => ({ kind: 'review', edgeId: e.edgeId }));
  if (mode === 'quick') {
    // Mixed practice: seen-but-not-strong first, then anything, five rounds across distinct edges where possible.
    const order = [...edges].sort((a, b) => rank(baseline.edges[a.edgeId]) - rank(baseline.edges[b.edgeId]));
    return Array.from({ length: Math.min(5, order.length * 2) }, (_, i) => ({ kind: 'mixed' as const, edgeId: order[i % order.length].edgeId }));
  }
  const goals: Goal[] = [];
  if (!tutorialDone && sets.some(set => set.chains.some(chain => chain.purpose === 'tutorial'))) goals.push({ kind: 'tutorial' });
  for (const e of due.slice(0, 2)) goals.push({ kind: 'review', edgeId: e.edgeId });
  const warm = edges.find(e => strong(baseline.edges[e.edgeId]) && !due.includes(e));
  if (warm) goals.push({ kind: 'warmup', edgeId: warm.edgeId });
  const target = nextTarget(edges, baseline, goals);
  if (target) goals.push({ kind: 'learn', edgeId: target });
  return goals;
}

/** In-progress edges with misconceptions first, then other in-progress edges, then unseen ones, in content order. */
function nextTarget(edges: EdgeContent[], baseline: MasterySnapshot, goals: Goal[]): string | undefined {
  const taken = new Set(goals.filter(g => g.kind === 'learn').map(g => (g as { edgeId: string }).edgeId));
  const open = edges.filter(e => !taken.has(e.edgeId) && !strong(baseline.edges[e.edgeId]));
  const weight = (e: EdgeContent) => {
    const m = baseline.edges[e.edgeId];
    if (!m) return 2;
    return Object.keys(m.misconceptions).length ? 0 : 1;
  };
  return open.sort((a, b) => weight(a) - weight(b))[0]?.edgeId;
}

const rank = (edge?: EdgeMastery) => (!edge ? 2 : strong(edge) ? 3 : edge.status === 'Reliable' ? 1 : 0);

/** Returns the next step and the (possibly extended) goal list, or null when the session is complete. */
export function nextStep(state: PlanState): { step: Step; goals: Goal[] } | null {
  const goals = [...state.goals];
  for (let g = 0; g < goals.length; g++) {
    const step = stepForGoal(state, goals[g], g);
    if (step) return { step, goals };
    // A journey keeps learning while it is short; it ends at a goal boundary, never mid-remediation.
    if (g === goals.length - 1 && state.mode === 'journey' && rounds(state.steps).length < JOURNEY_ROUNDS) {
      const target = nextTarget(indexEdges(state.sets), state.baseline, goals);
      if (target) goals.push({ kind: 'learn', edgeId: target });
    }
  }
  return null;
}

const rounds = (steps: Step[]) => steps.filter((s): s is Round => s.kind === 'round');
const recordsFor = (state: PlanState, list: Round[]) => state.records.filter(r => list.some(round => round.chainId === r.scenarioId));

function stepForGoal(state: PlanState, goal: Goal, g: number): Step | null {
  const mine = state.steps.filter(s => s.goal === g);
  const played = rounds(mine);
  const card = (kind: Card['kind']) => mine.find(s => s.kind === kind) as Card | undefined;

  if (goal.kind === 'tutorial') {
    const tutorial = state.sets.flatMap(set => set.chains.filter(chain => chain.purpose === 'tutorial').map(chain => ({ set, chain })));
    for (const { set, chain } of tutorial) {
      if (!played.some(r => r.chainId === chain.id)) return round(state, g, 'tutorial', set, chain);
      const flips = new Set(chain.beats.map(b => b.best_word)).size > 1;
      const text = flips ? TUTORIAL_MESSAGES.flip : TUTORIAL_MESSAGES.hold;
      if (!mine.some(s => s.kind === 'message' && s.text === text)) return { kind: 'message', goal: g, text };
    }
    if (!mine.some(s => s.kind === 'message' && s.text === TUTORIAL_MESSAGES.end)) return { kind: 'message', goal: g, text: TUTORIAL_MESSAGES.end };
    return null;
  }

  const edge = indexEdges(state.sets).find(e => e.edgeId === goal.edgeId);
  if (!edge) return null;
  const pick = (role: RoundRole) => chooseRound(state, g, role, edge);

  if (goal.kind === 'review') return played.length ? null : pick('review');
  if (goal.kind === 'warmup' || goal.kind === 'mixed') return played.length ? null : pick(goal.kind === 'warmup' ? 'warmup' : 'practice');

  // learn
  let outcome: DiagnosticResult['outcome'] | 'seen' = 'seen';
  if (!state.baseline.edges[edge.edgeId]) {
    if (!card('intro')) return { kind: 'intro', goal: g, edgeId: edge.edgeId, setId: edge.setId };
    const cold = played.filter(r => r.role === 'diagnostic');
    const probe = played.filter(r => r.role === 'probe');
    const coldRecords = recordsFor(state, cold);
    const confidentMiss = coldRecords.some(r => r.correctness === 'incorrect' && r.confidence === 'certain');
    if (cold.length < 2 && !confidentMiss) { const next = pick('diagnostic'); if (next) return next; }
    const perfectCold = cold.length >= 2 && coldRecords.every(r => r.correctness === 'best' && !r.hintLevel);
    if (perfectCold && !probe.length) { const next = pick('probe'); if (next) return next; }
    const diagnosis = card('diagnosis');
    if (!diagnosis) return { kind: 'diagnosis', goal: g, edgeId: edge.edgeId, result: diagnosticOutcome(coldRecords, recordsFor(state, probe)) };
    outcome = (diagnosis as Extract<Card, { kind: 'diagnosis' }>).result.outcome;
    if (outcome === 'A') return null;
  }

  // Remediation (§14 D, §16): contrast first, then a fresh context aimed at the misconception.
  const misses = recordsFor(state, played.filter(r => r.role !== 'diagnostic' && r.role !== 'probe')).filter(r => r.correctness === 'incorrect');
  // C = both cold reads missed: already a repeated miss on this boundary.
  const needsContrast = outcome === 'D' || outcome === 'C' || misses.length >= 2;
  if (needsContrast && !card('contrast')) return { kind: 'contrast', goal: g, edgeId: edge.edgeId, setId: edge.setId };
  const remedial = played.filter(r => r.role === 'remedial').length;
  if (needsContrast && remedial < (misses.length >= 3 ? 2 : 1)) { const next = pick('remedial'); if (next) return next; }

  // Weak word meanings: show clear anchor examples once before contrast practice (§32).
  if (outcome === 'C' && edge.set.anchors && !card('anchors')) return { kind: 'anchors', goal: g, edgeId: edge.edgeId, setId: edge.setId };

  // Learning rounds: practice first, then a hard shift, then (if ever extended) transfer. A role the bank cannot fill falls back.
  const learning = played.filter(r => r.role === 'practice' || r.role === 'shift' || r.role === 'transfer');
  if (learning.length >= LEARNING_ROUNDS) return null;
  const has = (role: RoundRole) => learning.some(r => r.role === role);
  const preferred: RoundRole = !has('practice') ? 'practice' : !has('shift') ? 'shift' : !has('transfer') ? 'transfer' : 'practice';
  for (const role of [preferred, 'practice', 'shift', 'transfer'] as const) {
    const next = pick(role);
    if (next) return next;
  }
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
  const diagnostic = role === 'diagnostic' || role === 'probe';
  return { kind: 'round', goal: g, role, setId: set.set_id, chainId: chain.id, edgeId: chain.edge_id, words, askConfidence: diagnostic || role === 'review', hintsAllowed: !diagnostic && role !== 'tutorial' };
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
