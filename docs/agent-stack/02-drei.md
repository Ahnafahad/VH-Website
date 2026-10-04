# Drei

## Installed version
`@react-three/drei` 10.7.9.

## Repository
`.references/drei/`, pinned v10.7.9; [upstream](https://github.com/pmndrs/drei).

## Role in Last Word
First stop for reusable scene utilities. Import only helpers with an identified need.

## Use this when
Projecting short DOM labels, drawing semantic connections, facing labels toward the camera, setting up cameras/environment, or managing scene quality.

## Do NOT use this when
Implementing learning logic or hiding core reading content inside a visual effect. Availability is not a reason to use all helpers.

## Important APIs/components/hooks
| Helper | Candidate use / constraint |
| --- | --- |
| `Float` | Ambient wrapper only; Spring still owns object selection movement. Disable while reading/reduced motion. |
| `Environment`, `Lightformer` | Environment lighting; prefer same-origin assets or local lightformers under the host CSP. |
| `Sparkles`, `Trail` | Sparse optional decoration; omit on reduced motion/lite. |
| `Line`, `Billboard` | Connections and front-facing small labels. |
| `Html` | Projected DOM; keep paragraph reading in a stable DOM sibling. |
| `Outlines` | Optional silhouette, with draw/geometry cost. |
| `MeshTransmissionMaterial` | Extra scene pass; Tier A only after profiling. |
| `MeshReflectorMaterial` | Offscreen render/blur cost; not a default material. |
| `shaderMaterial`, camera helpers | Reuse existing typed primitives before custom plumbing. |
| `PerformanceMonitor`, `AdaptiveDpr`, `Instances` | Measure/simplify presentation without changing logic. |

## Relevant official examples
Under `.references/drei/docs/`: `staging/{float,environment,lightformer,sparkles}.mdx`, `abstractions/{trail,billboard,outlines}.mdx`, `shapes/line.mdx`, `misc/html.mdx`, `shaders/{mesh-transmission-material,mesh-reflector-material}.mdx`, `performances/performance-monitor.mdx`. Each links its Storybook/example and implementation. Source includes `src/core/Float.tsx`, `src/core/PerformanceMonitor.tsx`, `src/web/Html.tsx`.

## Last Word examples
Use a `Line` for a mastered edge; use stable DOM text for its explanation. A projected `Html` value in the smoke test demonstrates actual renderer integration.

## Performance considerations
Bound particle counts, transmission samples/resolution, and reflection buffers. `Float autoInvalidate` keeps a demand loop active. Prevent quality oscillation using monitor bounds/fallback.

## Accessibility considerations
Projected HTML still needs logical reading/focus order. Occlusion or transparent text must never remove essential learning information. `Billboard` is visual orientation, not accessibility.

## Common mistakes
Fetching preset HDRIs through a restrictive CSP; too many render passes; mounting heavy material effects on every object; putting Float and Spring on the same transform.

## Relationship to other libraries in our stack
Drei extends R3F. Spring owns physical motion; XState owns semantic state. Quality callbacks may update a Zustand presentation preference only.
