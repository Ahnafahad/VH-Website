import { describe, expect, it } from 'vitest';
import { createActor } from 'xstate';
import { readContent, selectPlayable } from '../content/load';
import type { LastWordSet } from '../content/schema';
import { MIN_READ_MS, classifyAnswer, decisionPoints, diagnosticOutcome, edgeStatus, evaluateDecision, scheduleReview, updateMastery, verdictLabel } from '../core/learning';
import { isEligible, type SelectionCandidate } from '../core/selection';
import { emptyMastery, type DecisionInput, type DecisionRecord, type MasterySnapshot } from '../core/types';
import { checkpointPhase, clearCheckpoint, makeCheckpoint, readCheckpoint, submissionFor, writeCheckpoint } from '../game/checkpoint';
import { currentRound, lastWordMachine, type GameContext } from '../game/machine';
import { planGoals, REVISION_EVERY, TUTORIAL_MESSAGES, type Mode, type Round } from '../game/session';
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
    const fast = decide({ scenarioId: flip.id, beatId: b.id, selectedWord: b.best_word, reactionTimeMs: MIN_READ_MS }, 12);
    expect(fast.score).toBe(15);
    // Answered before the beat could be read: no points (blocks scripted play and accidental taps).
    expect(decide({ scenarioId: flip.id, beatId: b.id, selectedWord: b.best_word, reactionTimeMs: MIN_READ_MS - 1 }).score).toBe(0);
    expect(decide({ scenarioId: flip.id, beatId: b.id, selectedWord: b.best_word, reactionTimeMs: 90_000 }).score).toBe(15);
    const wrong = Object.keys(b.fit).find(w => w !== b.best_word)!;
    const missed = decide({ scenarioId: flip.id, beatId: b.id, selectedWord: wrong, reactionTimeMs: 3000 });
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
  const wrongWord = Object.entries(flip.beats[0].fit).find(([w]) => w !== flip.beats[0].best_word)![0];
  it('sends a right answer far out (7 → 21 → 60 days on delayed successes) and a wrong one to tomorrow', () => {
    let r = scheduleReview(undefined, at(0));
    expect(r.intervalDays).toBe(7);
    r = scheduleReview(r, at(7, 'po_hold', chain('po_hold').beats[0].best_word));
    expect(r.intervalDays).toBe(21);
    r = scheduleReview(r, at(28, 'po_probe', chain('po_probe').beats[0].best_word));
    expect(r.intervalDays).toBe(60);
    r = scheduleReview(r, at(100, flip.id, wrongWord));
    expect(r.intervalDays).toBe(0);
    expect(r.dueAt - 100 * DAY).toBe(DAY);
  });
  it('halves the gap for a partly right or hinted answer', () => {
    const first = scheduleReview(undefined, at(0));
    const hinted = scheduleReview(first, decide({ scenarioId: 'po_hold', beatId: chain('po_hold').beats[0].id, selectedWord: chain('po_hold').beats[0].best_word, hintLevel: 1, occurredAt: 7 * DAY }));
    expect(hinted.intervalDays).toBe(3);
  });
  it('a later beat of a chain that already had a miss cannot undo it', () => {
    const missed = scheduleReview(undefined, at(0, flip.id, wrongWord));
    const after = scheduleReview(missed, at(0.001, flip.id, flip.beats[0].best_word));
    expect(after.intervalDays).toBe(0);
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

function play(sets: LastWordSet[], { mode = 'journey' as Mode, baseline = emptyMastery(), tutorialDone = true, choose = bestWord, limit = 400, sessionId = 'session-1', now = 100 * DAY } = {}) {
  const actor = createActor(lastWordMachine, { input: { sets } }).start();
  actor.send({ type: 'START', mode, now, sessionId, baseline, tutorialDone });
  const states: string[] = [];
  for (let i = 0; i < 20000 && !actor.getSnapshot().matches('recap'); i++) {
    const s = actor.getSnapshot();
    states.push(String(s.value));
    now += 3000;
    // The stream never ends on its own while pairs remain; the learner ends it with Finish.
    if (s.matches('reading') && s.context.steps.filter(x => x.kind === 'round').length > limit) actor.send({ type: 'FINISH', now });
    else if (s.matches('reading')) {
      actor.send({ type: 'SELECT', word: choose(s.context) });
      actor.send({ type: 'LOCK', now });
    } else actor.send({ type: 'NEXT', now });
  }
  const ctx = actor.getSnapshot().context;
  return { ctx, states, rounds: ctx.steps.filter((s): s is Round => s.kind === 'round'), cards: ctx.steps.filter(s => s.kind !== 'round') };
}

describe('resuming an interrupted session', () => {
  it('re-enters a saved session exactly where it stopped, and can be finished', () => {
    const actor = createActor(lastWordMachine, { input: { sets: all } }).start();
    let now = 100 * DAY;
    actor.send({ type: 'START', mode: 'journey', now, sessionId: 'resume-1', baseline: emptyMastery(), tutorialDone: true });
    // Play until a few choices are made and the game is waiting on a stable screen.
    for (let i = 0; i < 40 && actor.getSnapshot().context.records.length < 3; i++) {
      const s = actor.getSnapshot();
      now += 3000;
      if (s.matches('reading')) { actor.send({ type: 'SELECT', word: bestWord(s.context) }); actor.send({ type: 'LOCK', now }); } else actor.send({ type: 'NEXT', now });
    }
    const before = actor.getSnapshot();
    const phase = checkpointPhase(String(before.value));
    expect(phase).not.toBeNull();
    const saved = JSON.parse(JSON.stringify(makeCheckpoint(before.context, phase!, 'a@example.com', now)));

    const resumed = createActor(lastWordMachine, { input: { sets: all } }).start();
    resumed.send({ type: 'RESTORE', checkpoint: saved, baseline: emptyMastery(), now: now + 60_000 });
    const after = resumed.getSnapshot();
    expect(String(after.value)).toBe(phase);
    expect(after.context.records.map(r => r.id)).toEqual(before.context.records.map(r => r.id));
    expect(after.context.sessionId).toBe('resume-1');
    expect(after.context.selected).toBeNull();

    // It carries on and finishes with a coherent, ordered record list.
    for (let i = 0; i < 400 && !resumed.getSnapshot().matches('recap'); i++) {
      const s = resumed.getSnapshot();
      now += 3000;
      if (s.matches('reading') && s.context.records.length >= before.context.records.length + 4) resumed.send({ type: 'FINISH', now: now + 60_000 });
      else if (s.matches('reading')) { resumed.send({ type: 'SELECT', word: bestWord(s.context) }); resumed.send({ type: 'LOCK', now: now + 60_000 }); } else resumed.send({ type: 'NEXT', now: now + 60_000 });
    }
    const done = resumed.getSnapshot();
    expect(done.matches('recap')).toBe(true);
    expect(done.context.records.length).toBeGreaterThan(before.context.records.length);
    const submission = submissionFor(done.context.sessionId, done.context.startedAt, done.context.completedAt!, done.context.records);
    expect(applySubmission(emptyLearningSnapshot(), submission, all).decisions).toHaveLength(done.context.records.length);
  });

  it('only resumes the same user’s fresh checkpoint', () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
    const { ctx } = play(all);
    writeCheckpoint(storage, makeCheckpoint({ ...ctx, completedAt: null }, 'reading', 'a@example.com', 1));
    expect(readCheckpoint(storage, 'a@example.com')?.sessionId).toBe(ctx.sessionId);
    expect(readCheckpoint(storage, 'b@example.com')).toBeNull();
    clearCheckpoint(storage);
    expect(readCheckpoint(storage, 'a@example.com')).toBeNull();
  });
});

const seenBaseline = play(all, { sessionId: 'seed', limit: 20 }).ctx.records.reduce(updateMastery, emptyMastery() as MasterySnapshot);

describe('session flow', () => {
  it('a first visit starts with the tutorial, then the spec’s three tutorial lessons', () => {
    const { rounds, cards } = play(players, { tutorialDone: false });
    expect(rounds[0].role).toBe('tutorial');
    const messages = cards.filter(c => c.kind === 'message').map(c => (c as { text: string }).text);
    expect(messages).toEqual([TUTORIAL_MESSAGES.flip, TUTORIAL_MESSAGES.hold, TUTORIAL_MESSAGES.end]);
  });

  it('plays one situation per pair and moves straight on: no pair twice in a row, no intro or diagnosis cards', () => {
    const { rounds, cards } = play(all, { limit: 30 });
    expect(rounds.length).toBe(31);
    expect(new Set(rounds.map(r => r.edgeId)).size).toBe(rounds.length);
    expect(cards).toEqual([]);
    expect(rounds.every(r => r.role === 'practice')).toBe(true);
  });

  it('a miss shows the boundary at once, then the pair returns after a few others, at most twice', () => {
    const { rounds, cards, ctx } = play(all, { choose: worstWord, limit: 40 });
    const first = rounds[0].edgeId;
    const at = (e: string) => rounds.flatMap((r, i) => (r.edgeId === e ? [i] : []));
    expect(cards.some(c => c.kind === 'contrast' && c.edgeId === first)).toBe(true);
    const contrast = ctx.steps.findIndex(s => s.kind === 'contrast' && s.edgeId === first);
    expect(ctx.steps[contrast - 1]).toBe(rounds[0]);
    const mine = at(first);
    expect(mine.length).toBe(3);
    expect(mine[1] - mine[0]).toBeGreaterThan(3);
    expect(rounds[mine[1]].role).toBe('remedial');
    for (const e of new Set(rounds.map(r => r.edgeId))) expect(at(e).length).toBeLessThanOrEqual(3);
    expect(new Set(rounds.map(r => r.chainId)).size).toBe(rounds.length);
  });

  it('a right answer is not revised this session, and learned pairs come back one situation in ten', () => {
    const first = play(all, { sessionId: 'a', limit: 1 });
    const learned = first.ctx.records.reduce(updateMastery, emptyMastery() as MasterySnapshot);
    const dueEdge = Object.keys(learned.reviews)[0];
    const later = play(all, { baseline: learned, now: 100 * DAY + 30 * DAY, sessionId: 'b', limit: 12 });
    const revisions = later.rounds.flatMap((r, i) => (r.role === 'review' ? [i] : []));
    expect(revisions).toEqual([REVISION_EVERY - 1]);
    expect(later.rounds[revisions[0]].edgeId).toBe(dueEdge);
    expect(later.rounds.filter(r => r.edgeId === dueEdge).length).toBe(1);
  });

  it('a pair missed in an earlier session comes first next time', () => {
    const first = play(all, { sessionId: 'a', choose: worstWord, limit: 1 });
    const learned = first.ctx.records.reduce(updateMastery, emptyMastery() as MasterySnapshot);
    const missedEdge = first.rounds[0].edgeId;
    const later = play(all, { baseline: learned, now: 100 * DAY + 2 * DAY, sessionId: 'b', limit: 3 });
    expect(later.rounds[0].edgeId).toBe(missedEdge);
    expect(later.rounds[0].role).toBe('remedial');
  });

  it('review mode tests a due distinction in a context the learner has not seen (§15, §51)', () => {
    const first = play(all, { sessionId: 'a', limit: 1 });
    const learned = first.ctx.records.reduce(updateMastery, emptyMastery() as MasterySnapshot);
    const dueEdge = Object.keys(learned.reviews)[0];
    const later = play(all, { mode: 'review', baseline: learned, now: 100 * DAY + 30 * DAY, sessionId: 'b' });
    expect(later.rounds.length).toBeGreaterThan(0);
    expect(later.rounds.every(r => r.role === 'review')).toBe(true);
    const seenBefore = new Set(first.rounds.map(r => r.chainId));
    expect(later.rounds.filter(r => r.edgeId === dueEdge).every(r => !seenBefore.has(r.chainId))).toBe(true);
  });

  it('never repeats a chain within a session and keeps the anti-pattern rules across many sessions', () => {
    for (let s = 0; s < 10; s++) {
      const { rounds } = play(all, { mode: 'quick', sessionId: `q${s}`, baseline: seenBaseline, limit: 15 });
      const ids = rounds.map(r => r.chainId);
      expect(new Set(ids).size).toBe(ids.length);
      for (let i = 1; i < rounds.length; i++) {
        const a = all.find(x => x.set_id === rounds[i - 1].setId)!.chains.find(c => c.id === rounds[i - 1].chainId)!;
        const b = all.find(x => x.set_id === rounds[i].setId)!.chains.find(c => c.id === rounds[i].chainId)!;
        expect(a.domain === b.domain && a.edge_id === b.edge_id).toBe(false);
      }
    }
  });

  it('plans only the tutorial up front', () => {
    expect(planGoals(players, emptyMastery(), 'journey', DAY, false).map(g => g.kind)).toEqual(['tutorial']);
    expect(planGoals(players, emptyMastery(), 'journey', DAY, true)).toEqual([]);
  });

  it('a session the client plays is accepted by the server boundary with the same scores', () => {
    const { ctx } = play(players, { tutorialDone: false, limit: 6 });
    const submission = { id: ctx.sessionId, startedAt: ctx.startedAt, completedAt: ctx.completedAt!, decisions: ctx.records.map(({ id, sessionId, setId, scenarioId, beatId, presentedWords, selectedWord, previousSelection, reactionTimeMs, hintLevel, confidence, reviewIntervalDays, occurredAt }) => ({ id, sessionId, setId, scenarioId, beatId, presentedWords, selectedWord, previousSelection, reactionTimeMs, hintLevel, confidence, reviewIntervalDays, occurredAt })) };
    const result = applySubmission(emptyLearningSnapshot(), submission, players);
    expect(result.decisions.map(d => d.score)).toEqual(ctx.records.map(r => r.score));
    // Tutorial play never counts as mastery evidence.
    expect(Object.keys(result.snapshot.edges)).not.toContain('confident__arrogant');
  });

  it('a long stream is saved in segments the server accepts, with the same scores as played', () => {
    const { ctx } = play(all, { limit: 60 });
    const segments = new Map<string, typeof ctx.records>();
    for (const r of ctx.records) segments.set(r.sessionId, [...(segments.get(r.sessionId) ?? []), r]);
    expect(segments.size).toBeGreaterThan(3);
    let snapshot = emptyLearningSnapshot();
    const scores: number[] = [];
    for (const [id, group] of segments) {
      expect(group.length).toBeLessThanOrEqual(100);
      const first = group[0];
      const result = applySubmission(snapshot, submissionFor(id, Math.max(0, first.occurredAt - first.reactionTimeMs), group.at(-1)!.occurredAt, group), all);
      snapshot = result.snapshot;
      scores.push(...result.decisions.map(d => d.score));
    }
    expect(scores).toEqual(ctx.records.map(r => r.score));
  });
});
