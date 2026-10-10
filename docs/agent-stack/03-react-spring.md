# React Spring Three

## Installed version
`@react-spring/three` 10.1.2.

## Repository
`.references/react-spring/`, pinned v10.1.2; [upstream](https://github.com/pmndrs/react-spring).

## Role in Last Word
Physical object motion: selection pull, release, recoil, inertial tilt, switch, lock snap, and mastery settling.

## Use this when
An R3F object's visual target changes because a semantic state or gesture changes. Springs can follow a new target while already moving.

## Do NOT use this when
Revealing paragraphs, running menus, or deciding whether a beat has closed. Do not dispatch game advancement from `onRest`.

## Important APIs/components/hooks
`animated.mesh`, `animated(Component)`, `useSpring`, imperative `api.start`, `api.stop`, interpolated SpringValues, `config` (`mass`, `tension`, `friction`), and `immediate` for animation-disabled presentation.

## Relevant official examples
- `.references/react-spring/docs/app/routes/docs.guides.react-three-fiber.mdx`
- `docs/app/routes/docs.concepts.imperative-api.mdx`
- `docs/app/routes/docs.advanced.{config,events,interpolation}.mdx`
- `demo/src/sandboxes/webgl-switch/src/App.tsx`
- `targets/three/src/index.ts` (R3F demand-loop integration)

All relative paths in this list are below `.references/react-spring/`.

## Last Word examples
Illustrative adapter only: `useSpring({ x: selected ? focusX : restX, immediate: reducedMotion })` drives `<animated.mesh position-x={x}>`. A lock state changes the visual target/config; it does not wait for settling to become locked. Gesture offsets can feed an imperative spring without React rendering every pointer movement.

## Performance considerations
Animated values update renderer properties outside React renders. The installed Three target connects its frame loop to R3F and requests invalidation when spring work appears; do not add a second frame clock. One owner per property.

## Accessibility considerations
Use immediate/minimal movement when requested. The DOM selected/locked state must remain readable when motion is absent. Stop idle motion during reading.

## Common mistakes
Importing the web target for meshes; passing SpringValues to a non-animated component; coupling semantic transitions to animation callbacks; attempting to make frame position authoritative.

## Relationship to other libraries in our stack
Use Gesture measures input, XState accepts semantic events, Spring renders the resulting physical response, R3F hosts it. Motion owns DOM transitions.
