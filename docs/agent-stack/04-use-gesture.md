# Use Gesture

## Installed version
`@use-gesture/react` 10.3.1.

## Repository
`.references/use-gesture/`; [upstream](https://github.com/pmndrs/use-gesture). The requested v10.3.1 tag was absent; the default-branch snapshot is recorded in the manifest. Check installed types when source differs.

## Role in Last Word
Interpret continuous pointer/touch input into drag, swipe, hover, movement, wheel, and any later justified pinch interaction.

## Use this when
Tracking gesture direction, offset, velocity, intentional movement, release, or cancellation on an interaction surface.

## Do NOT use this when
Choosing semantic correctness, owning selected-word state, creating a presentation timer, or replacing normal keyboard/button interactions.

## Important APIs/components/hooks
`useDrag`, `useGesture`, `useMove`, `useHover`, state fields `active`, `first`, `last`, `movement`, `offset`, `velocity`, `direction`, `canceled`; options `axis`, `threshold`, `filterTaps`, `target`, pointer capture, and coordinate transforms.

## Relevant official examples
- `.references/use-gesture/documentation/pages/docs/{gestures,state,options,extras}.mdx`
- `.references/use-gesture/demo/src/sandboxes/gesture-simplest/`
- `.references/use-gesture/demo/src/sandboxes/viewpager/`
- `.references/use-gesture/packages/react/src/`

## Last Word examples
Read a horizontal gesture from a DOM input surface; update temporary Spring offset during drag, and send a typed selection event when the intended choice changes. XState guards accept it only while choice is open. Release/cancel must not silently finalize a semantic decision.

## Performance considerations
Avoid storing each pointer sample in React/Zustand. Use refs or Spring's imperative API for transient visual values. Coordinate scaling must use the current viewport, not assume pixels equal world units.

## Accessibility considerations
Use appropriate `touch-action` on the smallest input surface. Horizontal drag can allow `pan-y` to retain vertical scrolling. Preserve zoom and provide tap, arrows/A-D, number selection, and Enter/Space alternatives. Handle pointer cancellation and focus.

## Common mistakes
Disabling touch scrolling globally; interpreting every tap as a swipe; two gesture systems competing on the same element; spreading DOM gesture assumptions onto R3F raycast events without adapting coordinates/capture.

## Relationship to other libraries in our stack
Gesture reports input; XState decides accepted actions; Spring handles physical response. Motion's hover/tap effects may decorate DOM controls but must not compete with the same drag interaction.
