# Last Word agent stack

Read this file, [the stack map](10-last-word-stack-map.md), and [compatibility](11-compatibility.md) before implementation. Read the [complete product specification](../last-word-complete-game-design.md) for product behavior. It is an unchanged copy of the supplied document; embedded implementation/content-generation prompts are future-phase reference material, not bootstrap tasks.

**Game state drives animation. Animation never drives game state.**

The curriculum source of truth is the existing `vocab_word_contrasts` table: 888 pairs, all draft at the read-only check on 2026-10-04. Preserve its rows, IDs, wording, and status. `vocab_confusion_pairs` records student mistakes and is a separate dataset. See the stack map before using either.

| Guide | Ownership |
| --- | --- |
| [Three / R3F](01-three-r3f.md) | Rendering and scene components |
| [Drei](02-drei.md) | Existing scene helpers |
| [React Spring](03-react-spring.md) | Physical 3D motion |
| [Use Gesture](04-use-gesture.md) | Continuous pointer/touch interpretation |
| [Motion](05-motion.md) | DOM motion and readable interface transitions |
| [XState](06-xstate.md) | Event-driven game flow |
| [Zustand](07-zustand.md) | Shared settings and application data |
| [Howler](08-howler.md) | Audio presentation |
| [UIkit](09-uikit.md) | Optional spatial UI, not installed |

## Local verification

Use npm in this app worktree. Node used for bootstrap: 24.20.0; npm: 11.19.0. `package-lock.json` is canonical; the old `bun.lock` is not used.

```sh
npm ci
npm run generate:access-control
npm run typecheck
npm run lint
npm test
npm run test:stack
npm run build
```

`test:stack` starts its own local Next dev server on port 6976 and uses Playwright Chromium. Install Chromium with `npx playwright install chromium` if absent. Do not run a build while a dev server is using the same `.next` directory. Host build environment variables and Google Fonts connectivity are required; do not copy credentials into tracked files.

The development-only route `/dev/last-word-stack` is a technical fixture, not game architecture. It verifies renderer integration, shared state, pointer input, a toggle actor, animation, and audio construction. Production returns 404. No curriculum content or gameplay exists in it.

## References and agent tooling

`.references/` contains shallow sparse source checkouts, excluded from Git, TypeScript, and ESLint. Binary demo assets are intentionally omitted. Do not install dependencies or modify source inside those repositories. Exact URLs, refs, hashes, and fetch dates are in [reference-manifest.json](reference-manifest.json). Source examples may require omitted assets if run; read them as references.

Motion's official local skill is available at `.agents/skills/motion/SKILL.md` in this worktree. It is ignored, with its original supporting files. No hosted MCP services were configured. Follow Last Word's ownership rules over broad library recommendations.

Read [BOOTSTRAP_REPORT.md](BOOTSTRAP_REPORT.md) for actual verification results and limitations. This bootstrap does not certify production device performance, audio playback, content quality, or finished accessibility.
