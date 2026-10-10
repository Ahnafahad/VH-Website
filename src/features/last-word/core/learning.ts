import type { LastWordBeat, LastWordSet } from '../content/schema';
import type { Correctness, DecisionInput, DecisionRecord, EdgeMastery, EvidenceKind, MasterySnapshot, ReviewSchedule } from './types';

const clamp = (n: number) => Math.max(0, Math.min(1, n));
export function classifyAnswer(beat: LastWordBeat, selectedWord: string): Correctness {
  if (!(selectedWord in beat.fit)) throw new Error('Unknown candidate word.');
  return selectedWord === beat.best_word ? 'best' : beat.fit[selectedWord] >= 0.4 ? 'defensible' : 'incorrect';
}
export function nuanceMultiplier(streak: number): number {
  return streak >= 10 ? 1.75 : streak >= 7 ? 1.5 : streak >= 4 ? 1.25 : streak >= 2 ? 1.1 : 1;
}
export function evaluateDecision(input: DecisionInput, set: LastWordSet, streak = 0): DecisionRecord {
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
  const base = correctness === 'best' ? 100 : correctness === 'defensible' ? (beat.fit[input.selectedWord] >= 0.7 ? 55 : 30) : 0;
  // Reading speed never penalizes accuracy. The modest bonus is available only on best answers.
  const speed = correctness === 'best' ? Math.round(30 * clamp(1 - input.reactionTimeMs / 8000)) : 0;
  const score = Math.round((base + (correctSwitch ? 35 : 0) + (correctHold ? 25 : 0) + speed) * nuanceMultiplier(nextStreak) * (input.hintLevel ? 0.75 : 1));
  const kind: EvidenceKind = input.reviewIntervalDays >= 7 ? 'retention' : chain.purpose === 'transfer' || chain.purpose === 'probe' ? 'transfer' : correctHold ? 'hold' : index > 0 && chain.beats[index - 1].best_word !== beat.best_word ? 'shift' : chain.difficulty <= 1 ? 'anchor' : 'standard';
  const weights: Record<EvidenceKind, number> = { anchor: 0.5, standard: 1, shift: 1.4, hold: 1.5, transfer: 1.8, retention: 2 };
  const evidenceWeight = correctness === 'incorrect' ? (input.confidence === 'certain' ? -1.5 : -1) : correctness === 'defensible' ? 0.2 : input.hintLevel ? 0.35 : weights[kind];
  return { ...input, edgeId: chain.edge_id, bestWord: beat.best_word, semanticFit: beat.fit[input.selectedWord], correctness, changedSelection, misconceptionTag: correctness === 'best' ? null : beat.misconception_by_wrong_choice[input.selectedWord], contentDifficulty: beat.difficulty, score, evidenceWeight, streak: nextStreak, kind };
}

export function scheduleReview(previous: ReviewSchedule | undefined, decision: DecisionRecord): ReviewSchedule {
  const success = decision.correctness === 'best' && !decision.hintLevel;
  const delayed = previous !== undefined && previous.dueAt <= decision.occurredAt && previous.intervalDays > 0 && previous.previousScenarioId !== decision.scenarioId;
  const successfulReviews = success ? (previous?.successfulReviews ?? 0) + (delayed ? 1 : 0) : 0;
  const intervals = [1, 3, 7, 21, 60];
  const intervalDays = success ? intervals[Math.min(successfulReviews, intervals.length - 1)] : 0;
  // Repeated decisions within one session must not push a scheduled review away.
  const dueAt = success && previous && !delayed && previous.intervalDays > 0 ? previous.dueAt : decision.occurredAt + (intervalDays ? intervalDays * 86400000 : 10 * 60000);
  return { edgeId: decision.edgeId, dueAt, intervalDays, successfulReviews, previousScenarioId: decision.scenarioId };
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
  const perfectProbe = probe.length > 0 && probe.every(d => d.correctness === 'best' && !d.hintLevel) && probe.some(d => d.kind === 'transfer' || d.kind === 'shift');
  if (perfectCold && perfectProbe) return { outcome: 'A', needsProbe: false, skipDefinitions: true, skipInstruction: true, message: 'You already own this distinction. Instruction skipped; a later fresh context will check retention.' };
  const partial = all.some(d => d.correctness !== 'incorrect');
  return { outcome: partial ? 'B' : 'C', needsProbe: perfectCold && probe.length === 0, skipDefinitions: partial, skipInstruction: false, message: partial ? 'The meanings are familiar. Focus on the boundary between them.' : 'Start with clear clues, then follow how the context changes.' };
}
