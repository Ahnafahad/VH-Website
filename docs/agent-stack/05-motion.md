# Motion

## Installed version
`motion` 12.38.0. The host also directly uses `framer-motion` 12.38.0; both resolve to the same React implementation version. No host-wide import migration was performed.

## Repository
`.references/motion/`, pinned v12.38.0; [upstream](https://github.com/motiondivision/motion).

## Role in Last Word
DOM/interface motion: context clauses, instructions, feedback, HUD, menus, settings, recap, overlays, navigation, and progress.

## Use this when
Animating accessible HTML through short transforms/opacity transitions while maintaining stable reading and focus.

## Do NOT use this when
Animating semantic 3D objects by default, running game flow, or inventing typography-heavy WebGL effects. Do not advance the actor from exit/animation-completion callbacks.

## Important APIs/components/hooks
Import from `motion/react`: `motion`, `AnimatePresence`, `MotionConfig`, `useReducedMotion`, `useMotionValue`, and `useTransform`. Use `initial={false}` when entrance motion is inappropriate. Keep stable keys and separate focus management from visual presence.

## Relevant official examples
- `.references/motion/packages/motion/README.md`
- `.references/motion/dev/react/src/examples/`
- `.references/motion/packages/framer-motion/src/utils/reduced-motion/use-reduced-motion.ts`
- [React accessibility](https://motion.dev/docs/react-accessibility)
- [AI installer](https://motion.dev/docs/ai-kit-install)

## Last Word examples
An actor's new beat updates DOM content immediately; its container can fade into place. Text settles while read. A selected/locked label is present independently of its transition.

## Performance considerations
Prefer opacity and transforms, limit layout animations, and avoid unnecessary mounts. Do not animate paragraph glyphs continually. The existing Motion 12 API satisfies this scope; Motion 14 is deliberately deferred.

## Accessibility considerations
Respect the system preference plus an explicit user override. Avoid hidden focusable exits, preserve logical reading order, and announce new context appropriately once. Audio/color/motion alone never communicates meaning.

## Common mistakes
Using `motion/react` for Spring-owned meshes; animated paragraph movement during reading; timers or `onAnimationComplete` as game clocks; importing paid components from the free package.

## Relationship to other libraries in our stack
XState supplies semantic states, Motion renders DOM reactions, Spring renders 3D reactions. Shared preferences can come from a scoped Zustand store.

## Agent tooling
Read `.references/motion/{AGENTS,CLAUDE}.md` for upstream package/test layout, not host workflow. Inspected `motion-ai@14.1.0 --help` and the official installer source. Its normal flow automatically configures hosted MCP servers, including Motion+. Instead copied its free skill and support files locally to `.agents/skills/motion/`. No server/account/paid service was enabled. The source snapshot is the extra `motion-ai` manifest entry; reinstall by copying `plugins/motion/skills/motion/` from that snapshot. Local best-practice guidance works offline.
