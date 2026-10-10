# Zustand

## Installed version
`zustand` 5.0.15.

## Repository
`.references/zustand/`, pinned v5.0.15; [upstream](https://github.com/pmndrs/zustand).

## Role in Last Word
Shared application data across React DOM/R3F: preferences, sound, reduced motion, quality tier, session metadata, cached curriculum, and client projections of persisted mastery.

## Use this when
Multiple consumers need application data that does not require event-driven state-machine orchestration.

## Do NOT use this when
Duplicating current beat, selected word, whether choice is open, or lock status owned by XState. Client state must not become authoritative server mastery or authorization.

## Important APIs/components/hooks
`createStore` from `zustand/vanilla`, `useStore(store, selector)`, `getState`, `setState`, `subscribe`, `persist` and `createJSONStorage` when persistence is later required; `useShallow` for suitable compound selectors.

## Relevant official examples
- `.references/zustand/README.md`
- `.references/zustand/docs/learn/guides/{nextjs,ssr-and-hydration,advanced-typescript}.md`
- `.references/zustand/docs/reference/hooks/use-store.md`
- `.references/zustand/src/{vanilla,react}.ts`

## Last Word examples
Create one store per mounted game/session provider, with matching initial server/client data where SSR applies. Pass the same store to DOM and Canvas consumers. The smoke fixture creates its store once inside the client component and demonstrates this sharing with one counter.

## Performance considerations
Select primitives/stable references. Avoid selectors that allocate a new object every read without equality handling. Do not push pointer/mesh coordinates through reactive store subscriptions every frame.

## Accessibility considerations
Store a user's override separately from the observed system preference so changes to either remain meaningful. Persistence hydration must not briefly enable unwanted motion/audio. Quality-tier changes preserve actor identity and content.

## Common mistakes
Server module singleton leaking state across requests; reading/writing stores in React Server Components; browser storage during SSR; persisting full actor snapshots or credentials by accident; treating word mastery as distinction mastery.

## Relationship to other libraries in our stack
XState owns transient flow. Backend/Turso remains durable content/mastery authority. Zustand shares client data with DOM/Motion and R3F/Spring; Howler consumes sound preferences.
