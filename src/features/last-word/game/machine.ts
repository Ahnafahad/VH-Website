import { assign, setup } from 'xstate';
import type { LastWordSet } from '../content/schema';
import { diagnosticOutcome, evaluateDecision } from '../core/learning';
import type { Confidence, DecisionRecord } from '../core/types';

export const itinerary = [
  ['confident-arrogant', 'ca_tutorial_flip'],
  ['confident-arrogant', 'ca_tutorial_hold'],
  ['persistent-obstinate', 'po_diagnostic_1'],
  ['persistent-obstinate', 'po_diagnostic_2'],
  ['persistent-obstinate', 'po_probe'],
  ['persistent-obstinate', 'po_flip'],
  ['persistent-obstinate', 'po_hold'],
] as const;

export interface GameContext {
  sets: LastWordSet[];
  sessionId: string;
  startedAt: number;
  completedAt: number | null;
  round: number;
  beat: number;
  selected: string | null;
  confidence: Confidence;
  openedAt: number;
  records: DecisionRecord[];
  pausedAt: number | null;
}
type GameEvent = { type: 'START' | 'NEXT' | 'FINISH' | 'RESTART'; now: number; sessionId?: string }
  | { type: 'SELECT'; word: string }
  | { type: 'CONFIDENCE'; confidence: Confidence }
  | { type: 'LOCK' | 'PAUSE' | 'RESUME'; now: number };

export function currentContent(context: GameContext) {
  const [setId, chainId] = itinerary[context.round];
  const set = context.sets.find((item) => item.set_id === setId)!;
  const chain = set.chains.find((item) => item.id === chainId)!;
  return { set, chain, beat: chain.beats[context.beat] };
}
export function diagnostic(context: GameContext) {
  return diagnosticOutcome(
    context.records.filter((r) => r.scenarioId.startsWith('po_diagnostic')),
    context.records.filter((r) => r.scenarioId === 'po_probe'),
  );
}

export const lastWordMachine = setup({
  types: { context: {} as GameContext, events: {} as GameEvent, input: {} as { sets: LastWordSet[]; sessionId: string; now: number } },
  guards: {
    selected: ({ context }) => context.selected !== null,
    validWord: ({ context, event }) => event.type === 'SELECT' && currentContent(context).set.words.some((w) => w.word === event.word),
    moreBeats: ({ context }) => context.beat + 1 < currentContent(context).chain.beats.length,
    tutorial: ({ context }) => context.round < 2,
    diagnostic: ({ context }) => context.round >= 2 && context.round <= 4,
    firstCold: ({ context }) => context.round === 2,
    needsProbe: ({ context }) => context.round === 3 && diagnostic(context).needsProbe,
    confidentMiss: ({ context }) => {
      const last = context.records.at(-1);
      return last?.confidence === 'certain' && last.correctness === 'incorrect';
    },
    lastRound: ({ context }) => context.round === itinerary.length - 1,
  },
  actions: {
    select: assign(({ event }) => event.type === 'SELECT' ? { selected: event.word } : {}),
    confidence: assign(({ event }) => event.type === 'CONFIDENCE' ? { confidence: event.confidence } : {}),
    open: assign(({ event }) => ({ openedAt: 'now' in event ? event.now : 0 })),
    commit: assign(({ context, event }) => {
      if (event.type !== 'LOCK' || !context.selected) return {};
      const { set, chain, beat } = currentContent(context);
      const previous = context.records.at(-1);
      const record = evaluateDecision({
        id: `${context.sessionId}-${context.records.length}`, sessionId: context.sessionId,
        setId: set.set_id, scenarioId: chain.id, beatId: beat.id,
        presentedWords: set.words.map((word) => word.word), selectedWord: context.selected,
        previousSelection: context.beat > 0 ? previous?.selectedWord ?? null : null,
        reactionTimeMs: Math.max(0, event.now - context.openedAt), hintLevel: 0,
        confidence: context.confidence, reviewIntervalDays: 0, occurredAt: event.now,
      }, set, previous?.streak ?? 0);
      return { records: [...context.records, record] };
    }),
    nextBeat: assign(({ context, event }) => ({ beat: context.beat + 1, confidence: null, openedAt: 'now' in event ? event.now : 0 })),
    nextRound: assign(({ context, event }) => ({ round: context.round + 1, beat: 0, selected: null, confidence: null, openedAt: 'now' in event ? event.now : 0 })),
    practice: assign(({ event }) => ({ round: 5, beat: 0, selected: null, confidence: null, openedAt: 'now' in event ? event.now : 0 })),
    finish: assign(({ event }) => ({ completedAt: 'now' in event ? event.now : 0 })),
    pause: assign(({ event }) => ({ pausedAt: 'now' in event ? event.now : null })),
    resume: assign(({ context, event }) => ({ openedAt: context.openedAt + ('now' in event ? event.now - (context.pausedAt ?? event.now) : 0), pausedAt: null })),
    restart: assign(({ event }) => ({ round: 0, beat: 0, selected: null, records: [], confidence: null, completedAt: null, startedAt: 'now' in event ? event.now : 0, sessionId: event.type === 'RESTART' ? event.sessionId ?? '' : '' })),
  },
}).createMachine({
  id: 'last-word', initial: 'home',
  context: ({ input }) => ({ sets: input.sets, sessionId: input.sessionId, startedAt: input.now, completedAt: null, round: 0, beat: 0, selected: null, confidence: null, openedAt: input.now, records: [], pausedAt: null }),
  states: {
    home: { on: { START: { target: 'reading', actions: 'open' } } },
    reading: { on: {
      SELECT: { guard: 'validWord', actions: 'select' }, CONFIDENCE: { actions: 'confidence' },
      LOCK: { guard: 'selected', target: 'locked', actions: 'commit' },
      PAUSE: { target: 'paused', actions: 'pause' },
    } },
    paused: { on: { RESUME: { target: 'reading', actions: 'resume' } } },
    locked: { on: { NEXT: [
      { guard: 'tutorial', target: 'feedback' },
      { guard: ({ context }) => context.round >= 2 && context.round <= 4 && context.records.at(-1)?.confidence === 'certain' && context.records.at(-1)?.correctness === 'incorrect', target: 'feedback' },
      { guard: 'moreBeats', target: 'reading', actions: 'nextBeat' },
      { guard: 'diagnostic', target: 'diagnosticRouting' },
      { target: 'feedback' },
    ] } },
    diagnosticRouting: { always: [
      { guard: 'firstCold', target: 'reading', actions: 'nextRound' },
      { guard: 'needsProbe', target: 'reading', actions: 'nextRound' },
      { target: 'diagnosis' },
    ] },
    diagnosis: { on: { NEXT: { target: 'reading', actions: 'practice' }, FINISH: { target: 'recap', actions: 'finish' } } },
    feedback: { on: { NEXT: [
      { guard: 'moreBeats', target: 'reading', actions: 'nextBeat' },
      { guard: 'diagnostic', target: 'diagnosticRouting' },
      { guard: 'lastRound', target: 'recap', actions: 'finish' },
      { target: 'reading', actions: 'nextRound' },
    ] } },
    recap: { on: { RESTART: { target: 'home', actions: 'restart' } } },
  },
});
