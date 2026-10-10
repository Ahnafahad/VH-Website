# Last Word bootstrap report

Checked on 2026-10-04 in isolated worktree `D:/VH Website/.worktrees/last-word-bootstrap` on branch `codex/last-word-bootstrap`. This prepares the existing app for a later Last Word implementation. It does not implement the game. The supplied design was read in full and copied unchanged to [`docs/last-word-complete-game-design.md`](../last-word-complete-game-design.md); SHA-256 of source and copy: `5857A938898E0A82337699F1CFB19D3EE4E310408DCC9052A435E2AA43834005`.

## Project detected

| Item | Value |
| --- | --- |
| Framework | Next.js 15.5.9 App Router |
| React version | React / React DOM 19.1.0 |
| Package manager | npm 11.19.0 (`package-lock.json`); pre-existing `bun.lock` unused |
| Node version | 24.20.0 |
| TypeScript | 5.9.3 |
| Build tool | Next.js webpack build with existing `next-pwa` integration |
| Database | Turso/libSQL via Drizzle; `vocab_word_contrasts` has 888 draft rows at read-only check |

The 888 contrast rows are the curriculum source of truth. No row, identifier, wording, or status was changed. `vocab_confusion_pairs` is a separate student-error dataset. The isolated worktree avoids the existing uncommitted changes in the main checkout.

## Installed dependencies

Exact resolved versions are in the lockfile. New direct runtime dependencies: `three@0.186.1`, `@react-three/fiber@9.8.1`, `@react-three/drei@10.7.9`, `@react-spring/three@10.1.2`, `@use-gesture/react@10.3.1`, and `howler@2.2.4`. New dev types: `@types/three@0.186.0` and `@types/howler@2.2.13`. Existing compatible packages retained: `motion@12.38.0`, `xstate@5.33.2`, `@xstate/react@6.1.0`, and `zustand@5.0.15`.

UIkit was studied but intentionally not installed. No physics engine, postprocessing package, GSAP, or 3D asset pipeline was added.

## Compatibility decisions

R3F 9 and Drei 10 match the host's React 19; React Spring 10 integrates with R3F 9. All selected Last Word packages plus React 19 passed an independent strict peer installation (`npm run verify:stack-peers`). The full host retains its pre-existing `legacy-peer-deps=true` because `react-pdf-highlighter-extended@8.1.0` declares React 18 only. This is a known host peer exception, not a claim of React 19 support for that PDF package. See [compatibility details](11-compatibility.md).

R3F's JSX augmentation exposed nine existing lucide icon props typed too broadly as `React.ElementType`; those props were narrowed to `React.ComponentType<LucideProps>` with no rendering change. The smoke route is development-only, lazy-loads its Canvas, and returns 404 in production. The host's root layout needs database/auth configuration even for that route, so the browser test supplies only in-memory local settings.

## Reference repositories

All paths below are relative to this worktree, shallow source-only checkouts under ignored `.references/`. Full URLs, refs, and fetch dates are in [reference-manifest.json](reference-manifest.json). Every entry was fetched 2026-10-04.

| Repository | Local path | Commit |
| --- | --- | --- |
| three.js | `.references/three` | `9b4a2ac29c63ccb43fd51c5661f2f873ac2c39b8` |
| React Three Fiber | `.references/react-three-fiber` | `53ec672ac4a7189711766b87ece18889abbb32d4` |
| Drei | `.references/drei` | `66b9bda91eee0ae98837e16c053888c34341421e` |
| React Spring | `.references/react-spring` | `59b1e5306402d3039120e2da464b66e10b1a1aa1` |
| Use Gesture | `.references/use-gesture` | `c779631aa05959638dee81b9a25fb1299a7467f6` |
| Motion | `.references/motion` | `0bfc9fe015f7170c538ca70ba4677ec59d83ee76` |
| XState | `.references/xstate` | `fbee62e7c1586315ed478c2fedf530d7e0ff5a3e` |
| Zustand | `.references/zustand` | `2115efb9e270e73ad1d3472dfe0e0c7b8c6abcd4` |
| Howler | `.references/howler` | `003b917c40cb41cf382ba47ae0ed7a35ca2abe76` |
| UIkit | `.references/uikit` | `7fbb8bb04478bfcf337274f42824ba004014a3e2` |
| Motion AI kit | `.references/motion-ai` | `d1c5c26f424adfd47c112d894e9d424b57338c7e` |

Three's r186 source is the closest release tag to runtime patch 0.186.1. Use Gesture, UIkit, and Motion AI kit use pinned default-branch snapshots. Source examples may refer to omitted binary assets; no dependencies were installed into reference repositories. Runtime declarations and the verified smoke fixture take precedence where reference versions differ.

## Agent documentation discovered

Inspected `.references/motion/{AGENTS.md,CLAUDE.md}`, `.references/xstate/{AGENTS.md,CLAUDE.md}`, `.references/react-spring/CLAUDE.md`, `.references/three/{llms.txt,docs/llms.txt}`, and `.references/motion-ai/plugins/motion/skills/motion/SKILL.md` as upstream reference material. Local Last Word guidance takes precedence over broad upstream agent suggestions. Motion's official free local skill and supporting files were copied to ignored `.agents/skills/motion/`; `motion-ai@14.1.0 --help` ran. Its interactive installer was not run because it would configure hosted MCP services, including Motion+; no paid or hosted account was connected.

The [nine library guides](README.md), [stack map](10-last-word-stack-map.md), and [compatibility guide](11-compatibility.md) record inspected source locations, APIs, examples, role boundaries, state/animation ownership, DOM readability, reduced motion, and performance tiers. A later agent should read those before implementation.

## Verification

| Check | Result | Evidence |
| --- | --- | --- |
| Install | PASS | `npm install`, `npm ls --depth=0`, strict Last Word peer check |
| Typecheck | PASS | `npm run typecheck` after smoke fixture |
| Lint | PASS | `npm run lint`; existing host warnings remain |
| Tests | PASS | `npm test`: 55 files, 488 tests |
| Build | PASS | `npm run build`: optimized compile and 198/198 static pages, exit 0, with network access for existing Google Fonts |
| Smoke test | PASS | `npm run test:stack`: 2 Playwright Chromium cases, normal/reduced motion, exit 0 |

The smoke fixture at `/dev/last-word-stack` verifies real Canvas/mesh rendering, a Drei centering callback, React Spring mesh scale, Use Gesture drag, Motion DOM transition, XState toggle, Zustand sharing between DOM and R3F, Howler construction, reduced motion, disabled animation, and a DOM-only presentation without changing semantic state. It contains no game screen or curriculum content.

## Known limitations

- The host PDF highlighter has the React 18 peer declaration described above. The strict Last Word subset passed; this does not validate that unrelated PDF feature at runtime.
- Browser smoke proves integration in local desktop Chromium, not production mobile WebGL support, device performance, real audio output, or finished accessibility. The DOM fallback is a technical fixture, not a product screen.
- The existing app's Google Fonts require network access during a production build. A sandboxed attempt was blocked by `EACCES` connecting to Google; the network-enabled rerun passed.
- References and the Motion local skill are intentionally ignored local artifacts. They are available in this worktree, and the manifest identifies exact upstream snapshots for recovery; they are not part of the tracked patch.
- Next warns that the parent workspace contains another lockfile. This does not affect the selected app package-lock or the passing checks.

## Deferred optional technologies

UIkit runtime, Motion 14 migration, R3F 10 alpha, GSAP, physics, gltfjsx, postprocessing, additional renderers, and hosted Motion MCP/Motion+ access. Add any only against a concrete game requirement and with fresh compatibility/performance checks.

## Ready-for-implementation checklist

- [x] Supplied specification read fully and preserved unchanged
- [x] Existing curriculum rows identified and preserved
- [x] Runtime stack installed with explicit compatibility decisions
- [x] Read-only source repositories and local guides prepared
- [x] State, animation, DOM/3D, performance, and accessibility ownership documented
- [x] Browser smoke, typecheck, lint, and existing tests pass
- [x] Production build passes
- [x] No actual Last Word gameplay or visual design was built
