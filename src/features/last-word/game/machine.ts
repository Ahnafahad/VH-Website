import { assign, setup } from 'xstate';
import type { LastWordSet } from '../content/schema';
import { evaluateDecision } from '../core/learning';
import type { Confidence, DecisionRecord, MasterySnapshot } from '../core/types';
import type { Checkpoint } from './checkpoint';
import { nextStep, planGoals, reviewIntervalDays, SEGMENT_ROUNDS, type Goal, type Mode, type Round, type Step } from './session';

/**
 * Game flow. The machine owns phase, beat, selection and committed decisions; the planner (session.ts)
 * decides what comes next. Presentation observes this state and never feeds animation timing back in.
 */
export interface GameContext {
  sets: LastWordSet[];
  baseline: MasterySnapshot;
  mode: Mode;
  sessionId: string;
  startedAt: number;
  completedAt: number | null;
  goals: Goal[];
  steps: Step[];
  beat: number;
  selected: string | null;
  confidence: Confidence;
  hintLevel: 0 | 1 | 2 | 3;
  openedAt: number;
  pausedAt: number | null;
  records: DecisionRecord[];
}
export type GameEvent =
  | { type: 'START'; mode: Mode; now: number; sessionId: string; baseline: MasterySnapshot; tutorialDone: boolean }
  | { type: 'SELECT'; word: string }
  | { type: 'HINT' }
  | { type: 'LOCK' | 'NEXT' | 'PAUSE' | 'RESUME' | 'FINISH'; now: number }
  | { type: 'RESTORE'; checkpoint: Checkpoint; baseline: MasterySnapshot; now: number }
  | { type: 'HOME' };

export const currentStep = (context: GameContext): Step | undefined => context.steps.at(-1);
export function currentRound(context: GameContext) {
  const step = currentStep(context);
  if (step?.kind !== 'round') return null;
  const set = context.sets.find(item => item.set_id === step.setId)!;
  const chain = set.chains.find(item => item.id === step.chainId)!;
  return { round: step as Round, set, chain, beat: chain.beats[context.beat] };
}
const nowOf = (event: GameEvent) => ('now' in event ? event.now : 0);
const roleOf = (context: GameContext) => currentRound(context)?.round.role;

export const lastWordMachine = setup({
  types: { context: {} as GameContext, events: {} as GameEvent, input: {} as { sets: LastWordSet[] } },
  guards: {
    done: ({ context }) => context.completedAt !== null,
    isRound: ({ context }) => currentStep(context)?.kind === 'round',
    selected: ({ context }) => context.selected !== null,
    validWord: ({ context, event }) => event.type === 'SELECT' && Boolean(currentRound(context)?.round.words.includes(event.word)),
    canHint: ({ context }) => Boolean(currentRound(context)?.round.hintsAllowed) && context.hintLevel < 3,
    moreBeats: ({ context }) => { const r = currentRound(context); return Boolean(r && context.beat + 1 < r.chain.beats.length); },
    tutorial: ({ context }) => roleOf(context) === 'tutorial',
  },
  actions: {
    start: assign(({ event, context }) => {
      if (event.type !== 'START') return {};
      return {
        mode: event.mode, sessionId: event.sessionId, baseline: event.baseline, startedAt: event.now, completedAt: null,
        goals: planGoals(context.sets, event.baseline, event.mode, event.now, event.tutorialDone), steps: [], records: [],
      };
    }),
    advance: assign(({ context, event }) => {
      const now = nowOf(event);
      const next = nextStep({ sets: context.sets, baseline: context.baseline, mode: context.mode, now, sessionId: context.sessionId, goals: context.goals, steps: context.steps, records: context.records });
      if (!next) return { completedAt: now };
      // A long stream is saved as a chain of sessions ("<id>~<time>"), each well under the server's per-session limits.
      const segmentFull = next.step.kind === 'round' && next.step.role !== 'tutorial'
        && new Set(context.records.filter(r => r.sessionId === context.sessionId).map(r => r.scenarioId)).size >= SEGMENT_ROUNDS;
      const sessionId = segmentFull ? `${context.sessionId.split('~')[0]}~${now}` : context.sessionId;
      return { sessionId, steps: [...context.steps, next.step], goals: next.goals, beat: 0, selected: null, confidence: null, hintLevel: 0 as const, openedAt: now };
    }),
    select: assign(({ event }) => (event.type === 'SELECT' ? { selected: event.word } : {})),
    hint: assign(({ context }) => ({ hintLevel: Math.min(3, context.hintLevel + 1) as 1 | 2 | 3 })),
    commit: assign(({ context, event }) => {
      const current = currentRound(context);
      if (event.type !== 'LOCK' || !current || !context.selected) return {};
      const { round, set, chain, beat } = current;
      const previous = context.beat > 0 ? context.records.findLast(r => r.scenarioId === chain.id) : undefined;
      // Same rule the server applies in applySubmission, evaluated against the pre-session baseline.
      const answeredIn = context.baseline.edges[chain.edge_id]?.scenarioSessions[chain.id];
      const record = evaluateDecision({
        id: `${context.sessionId}-${context.records.length}`, sessionId: context.sessionId,
        setId: set.set_id, scenarioId: chain.id, beatId: beat.id,
        presentedWords: round.words, selectedWord: context.selected, previousSelection: previous?.selectedWord ?? null,
        reactionTimeMs: Math.max(0, event.now - context.openedAt), hintLevel: context.hintLevel, confidence: context.confidence,
        reviewIntervalDays: reviewIntervalDays(context.baseline, chain.edge_id, event.now), occurredAt: event.now,
      }, set, context.records.at(-1)?.streak ?? 0, { tutorial: chain.purpose === 'tutorial', repeated: answeredIn !== undefined && answeredIn !== context.sessionId });
      return { records: [...context.records, record] };
    }),
    nextBeat: assign(({ context, event }) => ({ beat: context.beat + 1, confidence: null, hintLevel: 0 as const, openedAt: nowOf(event) })),
    // Re-enters a saved session exactly where it stopped. The timer restarts so time away never counts as reading time.
    restore: assign(({ event }) => {
      if (event.type !== 'RESTORE') return {};
      const { checkpoint: c } = event;
      return {
        mode: c.mode, sessionId: c.sessionId, startedAt: c.startedAt, completedAt: null, goals: c.goals, steps: c.steps, beat: c.beat, selected: null,
        confidence: c.confidence, hintLevel: c.hintLevel, openedAt: event.now, pausedAt: null, records: c.records, baseline: event.baseline,
      };
    }),
    pause: assign(({ event }) => ({ pausedAt: nowOf(event) })),
    resume: assign(({ context, event }) => ({ openedAt: context.openedAt + (nowOf(event) - (context.pausedAt ?? nowOf(event))), pausedAt: null })),
    finish: assign(({ event }) => ({ completedAt: nowOf(event) })),
    reset: assign(() => ({ steps: [], goals: [], records: [], completedAt: null, beat: 0, selected: null })),
  },
}).createMachine({
  id: 'last-word',
  initial: 'home',
  context: ({ input }) => ({
    sets: input.sets, baseline: { nodes: {}, edges: {}, reviews: {} }, mode: 'journey', sessionId: '', startedAt: 0, completedAt: null,
    goals: [], steps: [], beat: 0, selected: null, confidence: null, hintLevel: 0, openedAt: 0, pausedAt: null, records: [],
  }),
  states: {
    home: {
      on: {
        START: { target: 'routing', actions: ['start', 'advance'] },
        RESTORE: [
          { guard: ({ event }) => event.type === 'RESTORE' && event.checkpoint.phase === 'reading', target: 'reading', actions: 'restore' },
          { guard: ({ event }) => event.type === 'RESTORE' && event.checkpoint.phase === 'beatFeedback', target: 'beatFeedback', actions: 'restore' },
          { guard: ({ event }) => event.type === 'RESTORE' && event.checkpoint.phase === 'feedback', target: 'feedback', actions: 'restore' },
          { guard: ({ event }) => event.type === 'RESTORE' && event.checkpoint.phase === 'card', target: 'card', actions: 'restore' },
        ],
      },
    },
    routing: { always: [{ guard: 'done', target: 'recap' }, { guard: 'isRound', target: 'reading' }, { target: 'card' }] },
    reading: {
      on: {
        SELECT: { guard: 'validWord', actions: 'select' },
        HINT: { guard: 'canHint', actions: 'hint' },
        LOCK: { guard: 'selected', target: 'judging', actions: 'commit' },
        PAUSE: { target: 'paused', actions: 'pause' },
        FINISH: { target: 'recap', actions: 'finish' },
      },
    },
    judging: {
      always: [
        { guard: 'tutorial', target: 'beatFeedback' },
        // Every other beat is judged (correct / wrong, with points) before the next one opens; NEXT in beatFeedback moves on.
        { guard: 'moreBeats', target: 'beatFeedback' },
        { target: 'feedback' },
      ],
    },
    paused: { on: { RESUME: { target: 'reading', actions: 'resume' }, FINISH: { target: 'recap', actions: 'finish' } } },
    beatFeedback: { on: { NEXT: [{ guard: 'moreBeats', target: 'reading', actions: 'nextBeat' }, { target: 'routing', actions: 'advance' }] } },
    feedback: { on: { NEXT: { target: 'routing', actions: 'advance' }, FINISH: { target: 'recap', actions: 'finish' } } },
    card: { on: { NEXT: { target: 'routing', actions: 'advance' }, FINISH: { target: 'recap', actions: 'finish' } } },
    recap: { on: { HOME: { target: 'home', actions: 'reset' }, START: { target: 'routing', actions: ['start', 'advance'] } } },
  },
});
