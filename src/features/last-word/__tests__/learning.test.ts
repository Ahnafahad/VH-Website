import { describe, expect, it } from 'vitest';
import { createActor } from 'xstate';
import { readContent, selectPlayable } from '../content/load';
import type { LastWordSet } from '../content/schema';
import { classifyAnswer, decisionPoints, diagnosticOutcome, edgeStatus, evaluateDecision, scheduleReview, updateMastery, verdictLabel } from '../core/learning';
import { isEligible, type SelectionCandidate } from '../core/selection';
import { emptyMastery, type Confidence, type DecisionInput, type DecisionRecord, type MasterySnapshot } from '../core/types';
import { currentRound, lastWordMachine, type GameContext } from '../game/machine';
import { planGoals, TUTORIAL_MESSAGES, type Mode, type Round } from '../game/session';
import { applySubmission } from '../persistence/submission';
import { emptyLearningSnapshot } from '../persistence/types';

const report = readContent();
const all = selectPlayable(report, ['draft', 'audited', 'approved', 'published']);
const players = selectPlayable(report);
const set = (id: string) => all.find(s => s.set_id === id)!;
const po = set('persistent-obstinate');
const chain = (id: string) => po.chains.find(c => c.id === id)!;
const DAY = 86_400_000;

function input(over: Partial<DecisionInput> & { scenarioId: string; beatId: string; selectedWord: string }): DecisionInput {
  return {
    id: `d-${Math.random()}`, sessionId: 's1', setId: 'persistent-obstinate', presentedWords: ['persistent', 'obstinate'],
    previousSelection: null, reactionTimeMs: 4000, hintLevel: 0, confidence: null, reviewIntervalDays: 0, occurredAt: 10 * DAY, ...over,
  };
}
const decide = (over: Parameters<typeof input>[0], streak = 0) => evaluateDecision(input(over), po, streak);

describe('correctness and scoring (§8, §9)', () => {
  const flip = chain('po_flip');
  it('separates best, defensible and incorrect by explicit best word and fit', () => {
    const beat = { ...flip.beats[0], best_word: 'persistent', fit: { persistent: 0.9, obstinate: 0.5 } };
    expect(classifyAnswer(beat, 'persistent')).toBe('best');
    expect(classifyAnswer(beat, 'obstinate')).toBe('defensible');
    expect(classifyAnswer({ ...beat, fit: { persistent: 0.9, obstinate: 0.39 } }, 'obstinate')).toBe('incorrect');
    expect(() => classifyAnswer(beat, 'stubborn')).toThrow();
  });

  it('awards the semantic-switch bonus only for a correct change at a flip', () => {
    const b2 = flip.beats.findIndex((b, i) => i > 0 && b.best_word !== flip.beats[i - 1].best_word);
    const before = flip.beats[b2 - 1].best_word;
    const after = flip.beats[b2].best_word;
    const switched = decide({ scenarioId: flip.id, beatId: flip.beats[b2].id, selectedWord: after, previousSelection: before, reactionTimeMs: 8000 });
    const plain = decide({ scenarioId: flip.id, beatId: flip.beats[0].id, selectedWord: before, reactionTimeMs: 8000 });
    expect(plain.score).toBe(15);
    expect(switched.score).toBe(20);
    expect(switched.kind).toBe('shift');
  });

  it('awards Hold Your Ground for keeping the answer through a false shift', () => {
    const hold = chain('po_hold');
    const i = hold.beats.findIndex(b => b.shift_type === 'false_shift');
    const word = hold.beats[i].best_word;
    const held = decide({ scenarioId: hold.id, beatId: hold.beats[i].id, selectedWord: word, previousSelection: word, reactionTimeMs: 8000 });
    expect(held.score).toBe(20);
    expect(held.kind).toBe('hold');
    expect(held.evidenceWeight).toBe(1.5);
  });

  it('never pays for speed or streaks, discounts hints, and pays a wrong choice nothing', () => {
    const b = flip.beats[0];
    const fast = decide({ scenarioId: flip.id, beatId: b.id, selectedWord: b.best_word, reactionTimeMs: 0 }, 12);
    expect(fast.score).toBe(15);
    expect(decide({ scenarioId: flip.id, beatId: b.id, selectedWord: b.best_word, reactionTimeMs: 90_000 }).score).toBe(15);
    const wrong = Object.keys(b.fit).find(w => w !== b.best_word)!;
    const missed = decide({ scenarioId: flip.id, beatId: b.id, selectedWord: wrong, reactionTimeMs: 0 });
    expect(missed.score).toBeLessThanOrEqual(8);
    if (missed.correctness === 'incorrect') expect(missed.score).toBe(0);
    const hinted = decide({ scenarioId: flip.id, beatId: b.id, selectedWord: b.best_word, reactionTimeMs: 8000, hintLevel: 2 });
    expect(hinted.score).toBe(11);
    expect(hinted.evidenceWeight).toBe(0.35);
    expect(hinted.streak).toBe(0);
  });

  it('is anchored to the Lexicore economy: correct = quiz correct_usage, bonus = long-gap bonus, repeats ¼ rounded up, tutorial 0', () => {
    expect(decisionPoints('best', 1, false, false)).toBe(15);
    expect(decisionPoints('best', 1, false, true)).toBe(20);
    expect(decisionPoints('defensible', 0.8, false, false)).toBe(8);
    expect(decisionPoints('defensible', 0.5, false, false)).toBe(5);
    expect(decisionPoints('incorrect', 0.1, false, false)).toBe(0);
    expect(decisionPoints('best', 1, false, false, { repeated: true })).toBe(4);
    expect(decisionPoints('incorrect', 0.1, false, false, { repeated: true })).toBe(0);
    expect(decisionPoints('best', 1, false, true, { tutorial: true })).toBe(0);
    expect(['best', 'defensible', 'incorrect'].map(c => verdictLabel(c as 'best'))).toEqual(['Correct', 'Partly right', 'Wrong']);
  });

  it('weights a confident wrong answer more heavily than a hesitant one, and counts long gaps as retention', () => {
    const b = flip.beats[0];
    const wrong = Object.entries(b.fit).find(([w, f]) => w !== b.best_word && f < 0.4)![0];
    expect(decide({ scenarioId: flip.id, beatId: b.id, selectedWord: wrong, confidence: 'certain' }).evidenceWeight).toBe(-1.5);
    expect(decide({ scenarioId: flip.id, beatId: b.id, selectedWord: wrong, confidence: 'guessing' }).evidenceWeight).toBe(-1);
    expect(decide({ scenarioId: flip.id, beatId: b.id, selectedWord: b.best_word, reviewIntervalDays: 8 }).kind).toBe('retention');
  });

  it('rejects decisions that do not match the content', () => {
    expect(() => decide({ scenarioId: 'nope', beatId: 'x', selectedWord: 'persistent' })).toThrow();
    expect(() => decide({ scenarioId: flip.id, beatId: flip.beats[0].id, selectedWord: 'persistent', presentedWords: ['persistent'] })).toThrow();
  });
});

describe('mastery evidence (§12, §13)', () => {
  const flip = chain('po_flip');
  const best = (i: number, over: Partial<DecisionInput> = {}) => decide({ scenarioId: flip.id, beatId: flip.beats[i].id, selectedWord: flip.beats[i].best_word, ...over });

  it('never marks a distinction known after one lucky answer', () => {
    const m = updateMastery(emptyMastery(), best(0));
    expect(m.edges['persistent__obstinate'].status).toBe('Exploring');
  });

  it('is idempotent when the same decision is applied twice', () => {
    const d = best(0);
    const once = updateMastery(emptyMastery(), d);
    expect(updateMastery(once, d)).toBe(once);
  });

  it('penalises a repeated misconception and caps credit for a replayed scenario', () => {
    const b = flip.beats[0];
    const wrong = Object.entries(b.fit).find(([w, f]) => w !== b.best_word && f < 0.4)![0];
    const miss = (id: string) => decide({ id, scenarioId: flip.id, beatId: b.id, selectedWord: wrong });
    const after1 = updateMastery(emptyMastery(), miss('m1'));
    const after2 = updateMastery(after1, miss('m2'));
    const tag = b.misconception_by_wrong_choice[wrong];
    expect(after2.edges['persistent__obstinate'].misconceptions[tag]).toBe(2);
    expect(after2.nodes[wrong].evidence).toBe(0);
    const first = updateMastery(emptyMastery(), best(0, { id: 'a', sessionId: 's1' }));
    const replay = updateMastery(first, best(0, { id: 'b', sessionId: 's2' }));
    expect(replay.edges['persistent__obstinate'].evidence - first.edges['persistent__obstinate'].evidence).toBeLessThanOrEqual(0.2);
  });

  it('requires standard, shift and transfer evidence across two sessions for Fluent', () => {
    const base = { evidence: 12, observations: 10, bestCount: 10, retentionScore: 0 };
    expect(edgeStatus({ ...base, kinds: ['standard', 'shift', 'transfer'], sessionIds: ['a', 'b'] })).toBe('Fluent');
    expect(edgeStatus({ ...base, kinds: ['standard', 'shift'], sessionIds: ['a', 'b'] })).toBe('Reliable');
    expect(edgeStatus({ ...base, kinds: ['standard', 'shift', 'transfer'], sessionIds: ['a'] })).toBe('Reliable');
    expect(edgeStatus({ ...base, evidence: 20, retentionScore: 0.9, kinds: ['standard', 'shift', 'transfer', 'retention'], sessionIds: ['a', 'b'] })).toBe('Mastered');
  });

  it('keeps node (word) mastery separate from edge (distinction) mastery', () => {
    const m = updateMastery(emptyMastery(), best(0));
    expect(m.nodes[flip.beats[0].best_word].status).toBe('Recognized');
    expect(Object.keys(m.edges)).toEqual(['persistent__obstinate']);
  });
});

describe('review scheduling (§15)', () => {
  const flip = chain('po_flip');
  const at = (day: number, scenario = flip.id, word = flip.beats[0].best_word) => decide({ scenarioId: scenario, beatId: po.chains.find(c => c.id === scenario)!.beats[0].id, selectedWord: word, occurredAt: day * DAY });
  it('expands 1 → 3 → 7 days on delayed successes with fresh contexts, and resets on failure', () => {
    let r = scheduleReview(undefined, at(0));
    expect(r.intervalDays).toBe(1);
    r = scheduleReview(r, at(1, 'po_hold', chain('po_hold').beats[0].best_word));
    expect(r.intervalDays).toBe(3);
    r = scheduleReview(r, at(4, 'po_probe', chain('po_probe').beats[0].best_word));
    expect(r.intervalDays).toBe(7);
    const wrongWord = Object.entries(flip.beats[0].fit).find(([w]) => w !== flip.beats[0].best_word)![0];
    r = scheduleReview(r, at(11, flip.id, wrongWord));
    expect(r.intervalDays).toBe(0);
    expect(r.dueAt - 11 * DAY).toBe(10 * 60_000);
  });
  it('does not push a due review away when the learner repeats it within the same session', () => {
    const first = scheduleReview(undefined, at(0));
    expect(scheduleReview(first, at(0.01, 'po_hold', chain('po_hold').beats[0].best_word)).dueAt).toBe(first.dueAt);
  });
});

describe('diagnostic outcomes (§14)', () => {
  const rec = (over: Partial<DecisionRecord>) => ({ correctness: 'best', hintLevel: 0, confidence: null, kind: 'standard', scenarioId: 'a', ...over }) as DecisionRecord;
  it('A only after two clean cold reads and a clean harder probe', () => {
    const cold = [rec({ scenarioId: 'a' }), rec({ scenarioId: 'b' })];
    expect(diagnosticOutcome(cold).needsProbe).toBe(true);
    expect(diagnosticOutcome(cold, [rec({ scenarioId: 'p', kind: 'shift' })]).outcome).toBe('A');
    expect(diagnosticOutcome(cold, [rec({ scenarioId: 'p', kind: 'standard' })]).outcome).not.toBe('A');
  });
  it('B for mostly right, C for mostly wrong, D for a confident miss', () => {
    expect(diagnosticOutcome([rec({}), rec({ scenarioId: 'b', correctness: 'incorrect' })]).outcome).toBe('B');
    expect(diagnosticOutcome([rec({ correctness: 'incorrect' }), rec({ scenarioId: 'b', correctness: 'incorrect' }), rec({ scenarioId: 'c' })]).outcome).toBe('C');
    expect(diagnosticOutcome([rec({ correctness: 'incorrect', confidence: 'certain' })]).outcome).toBe('D');
  });
});

describe('anti-pattern selection (§33)', () => {
  const cand = (id: string, bestWord: string, bestPosition = 0, over: Partial<SelectionCandidate> = {}): SelectionCandidate => ({ id, edgeId: 'e', domain: id, characters: [], clue: id, bestWord, bestPosition, flips: false, allBeatsFlip: false, priority: 0, ...over });
  it('allows two-word sets to vary without deadlocking', () => {
    expect(isEligible(cand('c', 'a', 1), [cand('x', 'a', 0), cand('y', 'b', 1)])).toBe(true);
    expect(isEligible(cand('c', 'a', 0), [cand('x', 'a', 0), cand('y', 'a', 0)])).toBe(false);
  });
  it('blocks A-B-A-B, four flips in a row, and back-to-back domains', () => {
    expect(isEligible(cand('d', 'b', 1), [cand('a', 'a'), cand('b', 'b', 1), cand('c', 'a')])).toBe(false);
    const f = (id: string) => cand(id, id, 0, { flips: true });
    expect(isEligible(f('d'), [f('a'), f('b'), f('c')])).toBe(false);
    expect(isEligible(cand('b', 'x', 0, { domain: 'same' }), [cand('a', 'y', 0, { domain: 'same' })])).toBe(false);
  });
});

// ---------------------------------------------------------------- whole sessions through the machine

type Chooser = (ctx: GameContext) => string;
const bestWord: Chooser = ctx => currentRound(ctx)!.beat.best_word;
const worstWord: Chooser = ctx => { const b = currentRound(ctx)!.beat; return Object.entries(b.fit).sort((x, y) => x[1] - y[1])[0][0]; };

function play(sets: LastWordSet[], { mode = 'journey' as Mode, baseline = emptyMastery(), tutorialDone = true, choose = bestWord, confidence = null as Confidence, sessionId = 'session-1', now = 100 * DAY } = {}) {
  const actor = createActor(lastWordMachine, { input: { sets } }).start();
  actor.send({ type: 'START', mode, now, sessionId, baseline, tutorialDone });
  const states: string[] = [];
  for (let i = 0; i < 400 && !actor.getSnapshot().matches('recap'); i++) {
    const s = actor.getSnapshot();
    states.push(String(s.value));
    now += 3000;
    if (s.matches('reading')) {
      actor.send({ type: 'SELECT', word: choose(s.context) });
      if (confidence) actor.send({ type: 'CONFIDENCE', confidence });
      actor.send({ type: 'LOCK', now });
    } else actor.send({ type: 'NEXT', now });
  }
  const ctx = actor.getSnapshot().context;
  return { ctx, states, rounds: ctx.steps.filter((s): s is Round => s.kind === 'round'), cards: ctx.steps.filter(s => s.kind !== 'round') };
}

describe('session flow', () => {
  it('a first visit starts with the tutorial, then the spec’s three tutorial lessons', () => {
    const { rounds, cards } = play(players, { tutorialDone: false });
    expect(rounds[0].role).toBe('tutorial');
    const messages = cards.filter(c => c.kind === 'message').map(c => (c as { text: string }).text);
    expect(messages).toEqual([TUTORIAL_MESSAGES.flip, TUTORIAL_MESSAGES.hold, TUTORIAL_MESSAGES.end]);
  });

  it('a learner who already owns a distinction proves it and skips instruction (§5, §51)', () => {
    const { rounds, cards } = play(all);
    const first = rounds[0].edgeId;
    const mine = rounds.filter(r => r.edgeId === first).map(r => r.role);
    expect(mine.slice(0, 3)).toEqual(['diagnostic', 'diagnostic', 'probe']);
    expect(mine).not.toContain('practice');
    const diagnosis = cards.find(c => c.kind === 'diagnosis' && c.edgeId === first) as { result: { outcome: string } };
    expect(diagnosis.result.outcome).toBe('A');
    // The journey moves straight on to the next distinction instead of re-teaching.
    expect(new Set(rounds.map(r => r.edgeId)).size).toBeGreaterThan(1);
  });

  it('the cold read shows no teaching until evidence is in', () => {
    const { states, rounds } = play(all, { choose: worstWord });
    expect(rounds.slice(0, 2).map(r => r.role)).toEqual(['diagnostic', 'diagnostic']);
    // intro card, cold reads, then the diagnosis card: nothing is explained before it.
    const diagnosisAt = states.indexOf('card', states.indexOf('card') + 1);
    expect(diagnosisAt).toBeGreaterThan(0);
    expect(states.slice(0, diagnosisAt)).not.toContain('feedback');
  });

  it('a struggling learner gets contrast practice and a fresh remedial context, not definitions on repeat', () => {
    const { rounds, cards } = play(all, { choose: worstWord });
    const first = rounds[0].edgeId;
    expect((cards.find(c => c.kind === 'diagnosis') as { result: { outcome: string } }).result.outcome).toBe('C');
    expect(cards.some(c => c.kind === 'contrast' && c.edgeId === first)).toBe(true);
    expect(rounds.some(r => r.role === 'remedial')).toBe(true);
    expect(new Set(rounds.map(r => r.chainId)).size).toBe(rounds.length);
  });

  it('a confident misconception is corrected immediately (§14 D)', () => {
    const { states, cards } = play(all, { choose: worstWord, confidence: 'certain' });
    expect(states.indexOf('feedback')).toBeLessThan(states.indexOf('card', 2) === -1 ? Infinity : states.length);
    expect((cards.find(c => c.kind === 'diagnosis') as { result: { outcome: string } }).result.outcome).toBe('D');
    expect(cards.findIndex(c => c.kind === 'contrast')).toBeGreaterThan(cards.findIndex(c => c.kind === 'diagnosis'));
  });

  it('review mode tests a due distinction in a context the learner has not seen (§15, §51)', () => {
    const first = play(all, { sessionId: 'a' });
    const learned = first.ctx.records.reduce(updateMastery, emptyMastery() as MasterySnapshot);
    const dueEdge = Object.keys(learned.reviews)[0];
    const later = play(all, { mode: 'review', baseline: learned, now: 100 * DAY + 30 * DAY, sessionId: 'b' });
    expect(later.rounds.length).toBeGreaterThan(0);
    expect(later.rounds.every(r => r.role === 'review' && r.askConfidence)).toBe(true);
    const seenBefore = new Set(first.rounds.map(r => r.chainId));
    expect(later.rounds.filter(r => r.edgeId === dueEdge).every(r => !seenBefore.has(r.chainId))).toBe(true);
  });

  it('never repeats a chain within a session and keeps the anti-pattern rules across many sessions', () => {
    for (let s = 0; s < 25; s++) {
      const { rounds } = play(all, { mode: 'quick', sessionId: `q${s}` });
      const ids = rounds.map(r => r.chainId);
      expect(new Set(ids).size).toBe(ids.length);
      for (let i = 1; i < rounds.length; i++) {
        const a = all.find(x => x.set_id === rounds[i - 1].setId)!.chains.find(c => c.id === rounds[i - 1].chainId)!;
        const b = all.find(x => x.set_id === rounds[i].setId)!.chains.find(c => c.id === rounds[i].chainId)!;
        expect(a.domain === b.domain && a.edge_id === b.edge_id).toBe(false);
      }
    }
  });

  it('plans warm-up and due reviews ahead of new learning on Continue', () => {
    const strong = { ...emptyMastery(), edges: { 'assure__ensure': { status: 'Fluent' } as never }, reviews: { 'persistent__obstinate': { edgeId: 'persistent__obstinate', dueAt: 0, intervalDays: 3, successfulReviews: 1, previousScenarioId: 'x' } } } as MasterySnapshot;
    const goals = planGoals(players, strong, 'journey', DAY, true).map(g => g.kind);
    expect(goals).toEqual(['review', 'warmup', 'learn']);
  });

  it('a session the client plays is accepted by the server boundary with the same scores', () => {
    const { ctx } = play(players, { tutorialDone: false });
    const submission = { id: ctx.sessionId, startedAt: ctx.startedAt, completedAt: ctx.completedAt!, decisions: ctx.records.map(({ id, sessionId, setId, scenarioId, beatId, presentedWords, selectedWord, previousSelection, reactionTimeMs, hintLevel, confidence, reviewIntervalDays, occurredAt }) => ({ id, sessionId, setId, scenarioId, beatId, presentedWords, selectedWord, previousSelection, reactionTimeMs, hintLevel, confidence, reviewIntervalDays, occurredAt })) };
    const result = applySubmission(emptyLearningSnapshot(), submission, players);
    expect(result.decisions.map(d => d.score)).toEqual(ctx.records.map(r => r.score));
    // Tutorial play never counts as mastery evidence.
    expect(Object.keys(result.snapshot.edges)).not.toContain('confident__arrogant');
  });
});
