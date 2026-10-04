# Three.js and React Three Fiber

## Installed version
`three` 0.186.1; `@types/three` 0.186.0; `@react-three/fiber` 9.8.1.

## Repository
`.references/three/` ([upstream](https://github.com/mrdoob/three.js)); `.references/react-three-fiber/` ([upstream](https://github.com/pmndrs/react-three-fiber)). Three's reference is r186; the installed runtime includes the 0.186.1 patch. R3F is pinned to v9.8.1.

## Role in Last Word
R3F owns SemanticChamber, WordObject composition, SemanticField, connections, and CameraRig. Three supplies geometry, materials, cameras, raycasting, renderer resources, and low-level graphics behavior.

## Use this when
Constructing scene components declaratively; inspecting a material, render target, camera projection, or instancing requirement. Search Drei before creating a utility.

## Do NOT use this when
Authoring primary text, controlling round progression, calculating correctness, or storing mastery. Do not create a separate imperative scene/render loop alongside Canvas.

## Important APIs/components/hooks
`Canvas`, `useThree`, `useFrame`, `ThreeElements`, typed `Mesh` refs, `useLoader`, `invalidate`. Hooks belong below Canvas. Use a client component and a client-side dynamic boundary in Next.js.

## Relevant official examples
- `react-three-fiber/docs/getting-started/your-first-scene.mdx`
- `react-three-fiber/docs/API/{canvas,hooks,events,typescript,objects}.mdx`
- `react-three-fiber/docs/advanced/{pitfalls,scaling-performance}.mdx`
- `three/manual/pages/{fundamentals,cleanup,responsive}.html`
- `three/src/renderers/WebGLRenderer.js`; `three/llms.txt`

Paths above are under `.references/`. [Official introduction](https://r3f.docs.pmnd.rs/getting-started/introduction) documents React 19 → R3F 9.

## Last Word examples
A WordObject receives `selected` and `locked` from the actor and renders geometry. Its position is visual output. It must not infer a choice from proximity or announce correct answers before judgment. Keep the actor above the replaceable Canvas boundary.

## Performance considerations
Cap DPR, reuse resources, dispose owned resources, and use deltas for frame-based visual updates. Avoid React state updates/allocations inside `useFrame`. Prefer demand rendering for settled scenes; imperative changes must invalidate. The smoke fixture uses an always-running loop solely to observe rendered mesh values.

## Accessibility considerations
Canvas needs equivalent DOM controls/content and a no-WebGL path. Three materials, glow, and mesh interaction do not supply keyboard or screen-reader semantics.

## Common mistakes
R3F 8 with React 19; duplicate React/Three instances; hooks outside Canvas; SSR access to browser APIs; competing writers to transforms; treating render completion as a game event. WebGPU is not the bootstrap renderer.

## Relationship to other libraries in our stack
XState supplies meaning, Zustand supplies shared data, Spring owns physical transforms, Drei supplies helpers, and DOM/Motion owns reading.
