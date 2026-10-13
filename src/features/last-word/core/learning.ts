import { POINTS_LAST_WORD_CORRECT, POINTS_LONG_GAP_BONUS } from '@/lib/vocab/constants';
import type { LastWordBeat, LastWordSet } from '../content/schema';
import type { Correctness, DecisionInput, DecisionRecord, EdgeMastery, EvidenceKind, MasterySnapshot, ReviewSchedule } from './types';

const clamp = (n: number) => Math.max(0, Math.min(1, n));
export function classifyAnswer(beat: LastWordBeat, selectedWord: string): Correctness {
  if (!(selectedWord in beat.fit)) throw new Error('Unknown candidate word.');
  return selectedWord === beat.best_word ? 'best' : beat.fit[selectedWord] >= 0.4 ? 'defensible' : 'incorrect';
}
/** Human verdict for a judged choice. 'defensible' is partly right: it earns partial points but is not the best fit. */
export const verdictLabel = (correctness: Correctness) => (correctness === 'best' ? 'Correct' : correctness === 'defensible' ? 'Partly right' : 'Wrong');

/** A choice answered faster than anyone can read the beat earns nothing (blocks scripted play and accidental taps). */
export const MIN_READ_MS = 700;

/** Context that changes what a judged choice pays, known to both client and server. */
export interface PointsContext {
  /** Answered before it could have been read. */
  tooFast?: boolean;
  /** Guided tutorial play is exposure, not evidence, so it pays nothing. */
  tutorial?: boolean;
  /** The user already answered this scenario in an earlier session: ¼ points, rounded up (the Word Hunt catch-up rule). */
  repeated?: boolean;
}
export function decisionPoints(correctness: Correctness, fit: number, hinted: boolean, bonus: boolean, context: PointsContext = {}): number {
  if (context.tutorial || context.tooFast) return 0;
  const raw = correctness === 'best' ? POINTS_LAST_WORD_CORRECT + (bonus ? POINTS_LONG_GAP_BONUS : 0) : correctness === 'defensible' ? (fit >= 0.7 ? 8 : 5) : 0;
  const assisted = hinted ? Math.round(raw * 0.75) : raw;
  return context.repeated ? Math.ceil(assisted / 4) : assisted;
}
export function evaluateDecision(input: DecisionInput, set: LastWordSet, streak = 0, points: PointsContext = {}): DecisionRecord {
  const chain = set.chains.find(item => item.id === input.scenarioId);
  const index = chain?.beats.findIndex(beat => beat.id === input.beatId) ?? -1;
  if (input.setId !== set.set_id || !chain || index < 0) throw new Error('Unknown set, scenario, or beat.');
  const beat = chain.beats[index];
  const words = set.words.map(word => word.word);
  if (new Set(input.presentedWords).size !== words.length || input.presentedWords.length !== words.length || words.some(word => !input.presentedWords.includes(word))) throw new Error('Presented words must match the content.');
  if (!Number.isFinite(input.reactionTimeMs) || input.reactionTimeMs < 0 || !Number.isFinite(input.occurredAt) || input.occurredAt < 0 || input.reviewIntervalDays < 0 || !Number.isFinite(input.reviewIntervalDays)) throw new Error('Invalid decision timing.');
  if (![0, 1, 2, 3].includes(input.hintLevel) || ![null, 'guessing', 'pretty-sure', 'certain'].includes(input.confidence)) throw new Error('Invalid decision assistance.');
  if (input.previousSelection !== null && !words.includes(input.previousSelection)) throw new Error('Unknown previous selection.');
  const correctness = classifyAnswer(beat, input.selectedWord);
  const changedSelection = input.previousSelection !== null && input.previousSelection !== input.selectedWord;
  const correctSwitch = correctness === 'best' && changedSelection && index > 0 && chain.beats[index - 1].best_word !== beat.best_word;
  const correctHold = correctness === 'best' && input.previousSelection === input.selectedWord && beat.shift_type === 'false_shift';
  const nextStreak = correctness === 'best' && !input.hintLevel ? streak + 1 : 0;
  // `score` is the Lexicore points this choice earns. Speed never pays (Lexicore has no speed points, and it would reward rushing).
  const score = decisionPoints(correctness, beat.fit[input.selectedWord], input.hintLevel > 0, correctSwitch || correctHold, { ...points, tooFast: input.reactionTimeMs < MIN_READ_MS });
  const kind: EvidenceKind = input.reviewIntervalDays >= 7 ? 'retention' : chain.purpose === 'transfer' || chain.purpose === 'probe' ? 'transfer' : correctHold ? 'hold' : index > 0 && chain.beats[index - 1].best_word !== beat.best_word ? 'shift' : chain.difficulty <= 1 ? 'anchor' : 'standard';
  const weights: Record<EvidenceKind, number> = { anchor: 0.5, standard: 1, shift: 1.4, hold: 1.5, transfer: 1.8, retention: 2 };
  const evidenceWeight = correctness === 'incorrect' ? (input.confidence === 'certain' ? -1.5 : -1) : correctness === 'defensible' ? 0.2 : input.hintLevel ? 0.35 : weights[kind];
  return { ...input, edgeId: chain.edge_id, bestWord: beat.best_word, semanticFit: beat.fit[input.selectedWord], correctness, changedSelection, misconceptionTag: correctness === 'best' ? null : beat.misconception_by_wrong_choice[input.selectedWord], contentDifficulty: beat.difficulty ?? null, score, evidenceWeight, streak: nextStreak, kind };
}

/** Days until a pair returns after clean, unassisted successes. Completing new pairs comes first, so a right answer goes far out. */
export const REVIEW_LADDER_DAYS = [7, 21, 60, 120];
const DAY_MS = 86400000;

export function scheduleReview(previous: ReviewSchedule | undefined, decision: DecisionRecord): ReviewSchedule {
  // Later beats of a chain that already had a miss cannot undo it.
  const missedEarlier = previous?.previousScenarioId === decision.scenarioId && previous.intervalDays === 0;
  const done = (intervalDays: number, successfulReviews: number, dueAt: number): ReviewSchedule =>
    ({ edgeId: decision.edgeId, dueAt, intervalDays, successfulReviews, previousScenarioId: decision.scenarioId });
  if (decision.correctness === 'incorrect' || missedEarlier) return done(0, 0, decision.occurredAt + DAY_MS);
  if (decision.correctness === 'best' && !decision.hintLevel) {
    const delayed = previous !== undefined && previous.dueAt <= decision.occurredAt && previous.intervalDays > 0 && previous.previousScenarioId !== decision.scenarioId;
    const successfulReviews = (previous?.successfulReviews ?? 0) + (delayed ? 1 : 0);
    const intervalDays = REVIEW_LADDER_DAYS[Math.min(successfulReviews, REVIEW_LADDER_DAYS.length - 1)];
    // Repeated decisions within one session must not push a scheduled review away.
    const dueAt = previous && !delayed && previous.intervalDays > 0 ? previous.dueAt : decision.occurredAt + intervalDays * DAY_MS;
    return done(intervalDays, successfulReviews, dueAt);
  }
  // Partly right or hinted: shaky, so the gap halves (LexiCore's "unsure").
  const intervalDays = Math.max(1, Math.floor((previous?.intervalDays ?? 0) / 2));
  return done(intervalDays, previous?.successfulReviews ?? 0, decision.occurredAt + intervalDays * DAY_MS);
}

export function edgeStatus(edge: Pick<EdgeMastery, 'evidence' | 'observations' | 'bestCount' | 'kinds' | 'sessionIds' | 'retentionScore'>): EdgeMastery['status'] {
  if (!edge.observations) return 'Unseen';
  const reliable = edge.bestCount / edge.observations >= 0.8;
  const coverage = ['standard', 'shift', 'transfer'].every(kind => edge.kinds.includes(kind as EvidenceKind));
  const longitudinal = edge.sessionIds.length >= 2 || edge.kinds.includes('retention');
  if (edge.evidence >= 16 && reliable && coverage && longitudinal && edge.retentionScore >= 0.8) return 'Mastered';
  if (edge.evidence >= 9 && reliable && coverage && longitudinal) return 'Fluent';
  if (edge.evidence >= 5 && edge.observations >= 4 && reliable) return 'Reliable';
  if (edge.evidence >= 2) return 'Distinguishing';
  return 'Exploring';
}

/** Immutable evidence projection; replaying an already-applied decision is idempotent. */
export function updateMastery(snapshot: MasterySnapshot, decision: DecisionRecord): MasterySnapshot {
  const previous = snapshot.edges[decision.edgeId];
  if (previous?.decisionIds.includes(decision.id)) return snapshot;
  const repeatedScenario = previous?.scenarioSessions[decision.scenarioId] !== undefined && previous.scenarioSessions[decision.scenarioId] !== decision.sessionId;
  const repeatedMisconception = decision.correctness === 'incorrect' && decision.misconceptionTag && (previous?.misconceptions[decision.misconceptionTag] ?? 0) > 0;
  const delta = repeatedMisconception ? Math.min(-1.2, decision.evidenceWeight) : repeatedScenario && decision.evidenceWeight > 0 ? Math.min(0.2, decision.evidenceWeight) : decision.evidenceWeight;
  const evidence = Math.max(0, (previous?.evidence ?? 0) + delta);
  const unassistedBest = decision.correctness === 'best' && !decision.hintLevel && !repeatedScenario;
  const observations = (previous?.observations ?? 0) + 1;
  const bestCount = (previous?.bestCount ?? 0) + (unassistedBest ? 1 : 0);
  const kinds = Array.from(new Set([...(previous?.kinds ?? []), ...(unassistedBest ? [decision.kind] : [])]));
  const edge: EdgeMastery = {
    edgeId: decision.edgeId, evidence, observations, bestCount, masteryScore: clamp(evidence / 16),
    transferScore: decision.kind === 'transfer' && !repeatedScenario ? clamp((previous?.transferScore ?? 0) + delta / 5) : previous?.transferScore ?? 0,
    retentionScore: decision.kind === 'retention' && !repeatedScenario ? clamp((previous?.retentionScore ?? 0) + delta / 5) : previous?.retentionScore ?? 0,
    speedScore: observations >= 5 && bestCount / observations >= 0.8 && unassistedBest ? clamp((previous?.speedScore ?? 0) + 0.1 * clamp(1 - decision.reactionTimeMs / 8000)) : previous?.speedScore ?? 0,
    kinds, sessionIds: Array.from(new Set([...(previous?.sessionIds ?? []), decision.sessionId])),
    decisionIds: [...(previous?.decisionIds ?? []), decision.id],
    scenarioSessions: { ...(previous?.scenarioSessions ?? {}), [decision.scenarioId]: previous?.scenarioSessions[decision.scenarioId] ?? decision.sessionId },
    misconceptions: { ...(previous?.misconceptions ?? {}) }, lastVerified: decision.occurredAt, status: 'Exploring',
  };
  if (decision.correctness === 'incorrect' && decision.misconceptionTag) edge.misconceptions[decision.misconceptionTag] = (edge.misconceptions[decision.misconceptionTag] ?? 0) + 1;
  edge.status = edgeStatus(edge);
  // A contextual judgment is weaker node evidence than direct recognition, especially on a miss.
  const node = snapshot.nodes[decision.selectedWord];
  const nodeEvidence = Math.max(0, (node?.evidence ?? 0) + (delta > 0 ? delta * 0.5 : delta * 0.25));
  const knownScore = clamp(nodeEvidence / 8);
  return {
    nodes: { ...snapshot.nodes, [decision.selectedWord]: { word: decision.selectedWord, evidence: nodeEvidence, observations: (node?.observations ?? 0) + 1, knownScore, status: knownScore >= 0.9 ? 'Stable' : knownScore >= 0.6 ? 'Known' : knownScore > 0 ? 'Recognized' : 'Unknown', lastVerified: decision.occurredAt } },
    edges: { ...snapshot.edges, [decision.edgeId]: edge },
    reviews: { ...snapshot.reviews, [decision.edgeId]: scheduleReview(snapshot.reviews[decision.edgeId], decision) },
  };
}

export interface DiagnosticResult { outcome: 'A' | 'B' | 'C' | 'D'; needsProbe: boolean; skipDefinitions: boolean; skipInstruction: boolean; message: string }
export function diagnosticOutcome(cold: DecisionRecord[], probe: DecisionRecord[] = []): DiagnosticResult {
  const all = [...cold, ...probe];
  if (all.some(d => d.correctness === 'incorrect' && d.confidence === 'certain')) return { outcome: 'D', needsProbe: false, skipDefinitions: true, skipInstruction: false, message: 'One confident judgment missed the boundary. Test that clue in a fresh context.' };
  const coldComplete = new Set(cold.map(d => d.scenarioId)).size >= 2;
  const perfectCold = coldComplete && cold.every(d => d.correctness === 'best' && !d.hintLevel);
  // The probe must exercise a harder judgment: a shift, a held false shift, or a transfer context.
  const perfectProbe = probe.length > 0 && probe.every(d => d.correctness === 'best' && !d.hintLevel) && probe.some(d => d.kind === 'transfer' || d.kind === 'shift' || d.kind === 'hold');
  if (perfectCold && perfectProbe) return { outcome: 'A', needsProbe: false, skipDefinitions: true, skipInstruction: true, message: 'You already own this distinction. Instruction skipped; a later fresh context will check retention.' };
  // Partial mastery means most judgments landed; one lucky hit among misses is weak mastery.
  const partial = all.length > 0 && all.filter(d => d.correctness !== 'incorrect').length / all.length >= 0.5;
  return { outcome: partial ? 'B' : 'C', needsProbe: perfectCold && probe.length === 0, skipDefinitions: partial, skipInstruction: false, message: partial ? 'The meanings are familiar. Focus on the boundary between them.' : 'Start with clear clues, then follow how the context changes.' };
}
