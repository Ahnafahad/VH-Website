# XState

## Installed version
`xstate` 5.33.2; `@xstate/react` 6.1.0. The React integration package has its own major version; it peers with XState 5.28+.

## Repository
`.references/xstate/`, pinned `xstate@5.33.2`; [upstream](https://github.com/statelyai/xstate).

## Role in Last Word
Single owner of round/beat flow, reversible semantic choices, locks, evidence availability, feedback phase, pause/resume, and later orchestration.

## Use this when
Events have state-dependent validity, guards, deterministic transitions, cancellation, or invoked asynchronous work.

## Do NOT use this when
Updating mesh positions each frame, replacing every settings store, or reading animation completion to determine game state.

## Important APIs/components/hooks
`setup`, `createMachine`, typed events/context/input, `assign`, guards, invoked actors (`fromPromise`), `createActor`; React `useMachine`, `useActorRef`, `useSelector`. Actor lifecycle must be scoped to the session and survive renderer changes.

## Relevant official examples
- `.references/xstate/templates/react-ts/src/{feedbackMachine.ts,App.tsx}`
- `.references/xstate/examples/7guis-counter-react/src/`
- `.references/xstate/packages/xstate-react/{README.md,src/}`
- [React integration](https://stately.ai/docs/xstate-react), [delayed transitions](https://stately.ai/docs/delayed-transitions), [TypeScript](https://stately.ai/docs/typescript)

## Last Word examples
Future events might represent selection, explicit lock, new evidence, pause, and resume. Guards enforce whether a choice remains reversible; context carries the selected semantic ID. These are ownership examples, not an implemented or finalized machine.

## Performance considerations
Subscribe to the smallest snapshot slice needed. Keep the actor outside Canvas so Tier C/unmount does not reset a round. Do not dispatch events at animation-frame frequency.

## Accessibility considerations
Keyboard, touch, and pointer must issue the same semantic events. Learning mode timers must be extendable/removable. A semantic deadline can be modelled by the actor, but pause/resume must explicitly preserve remaining time; exiting/re-entering a timed state does not automatically mean a paused clock.

## Common mistakes
Mixing XState 4 APIs with 5; mutating context; treating `after` as animation duration; duplicate round state in Zustand; revealing correctness through presentation state before judgment.

## Relationship to other libraries in our stack
Zustand supplies settings/content cache and persisted projections. Spring, Motion, R3F, and Howler observe meaningful state/events; none controls actor progression. The only implemented actor is a disposable two-state technical toggle.
