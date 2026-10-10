# Compatibility and integration decisions

Checked against npm registry package manifests on 2026-10-04 and the installed lockfile. Exact resolved versions, rather than floating latest versions, were selected for additions.

| Package | Version | Relevant peers / decision |
| --- | --- | --- |
| React / React DOM | 19.1.0 / 19.1.0 | Existing host versions retained |
| Next.js | 15.5.9 | Existing App Router host retained |
| TypeScript | 5.9.3 | Existing strict/bundler config retained |
| three / @types/three | 0.186.1 / 0.186.0 | Same Three release line |
| @react-three/fiber | 9.8.1 | React and React DOM >=19 <19.4; Three >=0.156 |
| @react-three/drei | 10.7.9 | React ^19; R3F ^9; Three >=0.159 |
| @react-spring/three | 10.1.2 | React includes ^19; R3F >=6; Three >=0.126 |
| @use-gesture/react | 10.3.1 | React >=16.8 |
| motion | 12.38.0 | Compatible existing host release; latest major 14 deferred |
| xstate / @xstate/react | 5.33.2 / 6.1.0 | React integration requires XState ^5.28 and accepts React ^19 |
| zustand | 5.0.15 | Optional React / types peers >=18 |
| howler / @types/howler | 2.2.4 / 2.2.13 | Browser lifecycle tested; no React peer |
| @react-three/uikit | Not installed | Candidate 1.0.76 accepts React >=18 / R3F >=8; optional only |

R3F 10 alpha, Motion 14 migration, UIkit runtime, GSAP, physics engines, gltfjsx, additional renderers, and postprocessing packages were not introduced as direct dependencies. Drei may bring internal/transitive rendering helpers; that does not authorize using their features in Last Word.

## Existing host peer exception

The committed host `.npmrc` already sets `legacy-peer-deps=true`. A strict installation was attempted first and failed solely on the existing `react-pdf-highlighter-extended@8.1.0` declaring React/React DOM ^18.3.1. Registry inspection found no newer release. Downgrading React or replacing the PDF viewer is outside this bootstrap and would alter existing features.

The inherited setting is therefore retained and commented. No `--force`, overrides, dependency patch, or fake peer metadata was used. This is an explicit host exception, **not a claim that the PDF package declares React 19 support**.

The selected Last Word dependencies, React 19.1.0, and required types were independently installed in `.tmp/last-word/peer-check` with:

```sh
npm install --ignore-scripts --legacy-peer-deps=false --strict-peer-deps --no-audit --no-fund
```

That strict installation succeeded. The temporary manifest uses exact versions from the app's installed packages. `npm run verify:stack-peers` reproduces it. The full app and the browser smoke route must still pass after any version change.

## JSX integration fix

Importing R3F augments React's intrinsic JSX element namespace. Several host icon props used unconstrained `React.ElementType`; after the augmentation they rejected `size`, `style`, and other SVG props with `never` errors. Narrowed only those icon types to `React.ComponentType<LucideProps>` (inline type import). This adds no rendering behavior. The baseline compiled before importing Canvas; the corrected host is checked again afterward.

## Next.js and validation boundaries

- The smoke Canvas/audio module loads via `dynamic(..., { ssr: false })` inside a client boundary.
- The server route calls `notFound()` outside development.
- Actor/store instances survive presentation changes. No browser storage singleton is read by Server Components.
- Smoke server configuration provides an in-memory database URL and local-only auth secret because the existing root layout imports the DB/auth stack. It does not authenticate, seed a DB, or access production.
- `.references/` and `.tmp/` are excluded from TypeScript/ESLint, so upstream projects cannot pollute the app's build.
- Host CSP can block remote environment presets, assets, or fonts used by examples. Prefer same-origin assets later; do not weaken CSP to run a demo.
- npm 11 reports unapproved install scripts in existing transitive tooling and deprecation warnings; actual build/test execution determines whether needed binaries work. Do not blanket-approve all install scripts.

## Reference-version caveats

Three source snapshot is r186 while runtime is 0.186.1. Use Gesture, optional UIkit, and Motion AI use recorded default-branch snapshots; other core repositories are release-tagged. Installed declarations and verified behavior take precedence over examples from a different release. No dependencies were installed inside reference repositories.
