# React Three UIkit

## Installed version
Not installed. npm candidate inspected: `@react-three/uikit` 1.0.76. Its peers accept React >=18 and R3F >=8, but optional compatibility is not a reason to add it now.

## Repository
`.references/uikit/`; [upstream](https://github.com/pmndrs/uikit). Default-branch commit is pinned in the manifest; re-check version-specific APIs before adoption.

## Role in Last Word
Possible future world-space Mastery Map inspection panels or spatial controls. It has no immediate bootstrap runtime requirement.

## Use this when
A specific spatial interface genuinely benefits from layout/materials inside the rendered world and has an equivalent accessible DOM path.

## Do NOT use this when
Rendering primary context, explanations, tutorials, standard HUD, menus, or accessibility-critical text. Do not replace the normal DOM reading layer.

## Important APIs/components/hooks
`Container`, `Text`, `Fullscreen`, `Content`, layout properties, event/hover properties, and refs/signals for frequent visual updates. These are studied APIs, not enabled dependencies.

## Relevant official examples
- `.references/uikit/README.md` (minimal two-container example)
- `.references/uikit/docs/getting-started/`
- `.references/uikit/docs/advanced/{performance,pitfalls}.md`
- `.references/uikit/examples/performance/src/App.tsx`
- [First layout](https://docs.pmnd.rs/uikit/getting-started/first-layout)

## Last Word examples
Later, a selected mastery node might reveal a small world-space panel; the same distinction/status must remain available in DOM. No such panel is implemented in bootstrap.

## Performance considerations
More font families/material classes increase draw calls. Avoid per-frame React rerenders; use supported visual updates. Async measured content needs correctly placed Suspense boundaries.

## Accessibility considerations
Spatial glyphs are not a substitute for native readable/selectable HTML. Maintain keyboard focus, screen-reader content, scalable text, and a Tier C alternative.

## Common mistakes
Assuming WebGL UI has DOM semantics; adding UIkit purely because Canvas exists; transparent-object sorting mistakes; measuring async content before it resolves.

## Relationship to other libraries in our stack
UIkit can sit inside R3F; it does not own game state or supersede Motion's DOM responsibilities. Its optional signals must remain presentation-only and not duplicate XState/Zustand state.
