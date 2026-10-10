# Last Word — decisions

Running log of implementation decisions. Newest first within each area. The design spec
(`docs/last-word-complete-game-design.md`) controls product behaviour; these record how it was built
and why, where the spec leaves room.

## Assets (2026-10-10)

- **Visual specification lives in ASSETS_NEEDED.md Part I.** Three signature elements carry the
  premium identity at low render cost: **the Fulcrum** (a filament balanced on a pivot jewel that
  tilts toward the player's *current selection*, never the answer, and releases identically on stay
  and flip beats), **Evidence Strata** (earlier beats recede as text-free glass panes behind the live
  DOM context), and **the Seal** (lock ring + one-time gold underline on the Last Word). The mastery
  map is the **Lexicon Observatory**. Added `model.fulcrum`, `model.evidence-pane`,
  `texture.star-dust` (all nice-to-have with procedural fallbacks); 52 assets, 12 must-have.

- **Manifest-driven, all optional.** Every asset is declared once in
  `src/features/last-word/assets/asset-manifest.json` (id, path, format, tier, budgets, fallback).
  Code refers to assets by id only. The game must run with zero files: each id has a procedural
  placeholder, so the asset spec is never on the critical path.
- **Availability is published at build, not probed at runtime.** `npm run last-word:validate-assets
  -- --write` (run automatically in `prebuild`) writes `public/last-word/assets/available.json` with
  only the ids whose files passed validation. The client loads that list once; anything not on it
  uses its placeholder. This avoids 404 probing, keeps a malformed file from ever reaching players,
  and makes drop-in replacement a no-code change. `available.json` is generated and gitignored.
- **Validator reads bytes, not names.** `scripts/last-word/lib/asset-checks.mjs` sniffs formats from
  magic numbers and parses headers (PNG/WebP/JPEG/HDR dimensions, GLB JSON for triangles, node names,
  world bounds and extensions, MP3 frame-summed duration, Ogg granule duration, SVG hygiene). No new
  dependencies.
- **No mesh/texture compression in GLBs.** The host CSP (`default-src 'self'`, no `worker-src`/blob)
  blocks the worker-based Draco/KTX2 decoders, and meshopt adds a WASM path for little gain at these
  budgets. GLBs are uncompressed with embedded WebP/PNG textures; the validator rejects
  `KHR_draco_mesh_compression`, `EXT_meshopt_compression` and `KHR_texture_basisu`.
- **Placeholder audio is synthesized with Web Audio, not data: URLs.** The existing checkpoint fed
  Howler `data:audio/wav` URLs; the production CSP (`media-src 'self'`, `connect-src 'self'`) blocks
  those, so sound would silently fail in production. Real files are same-origin MP3 (+ optional WebM
  Opus twin) played through Howler; placeholders use an OscillatorNode envelope.
- **Text never baked into art** (spec §41, LexiCore brief §8). Tiles have a calm front face; the live
  DOM word is aligned over it. Status icons encode meaning by shape, with the status word printed
  beside them (no meaning by colour alone).
- **Palette:** LexiCore tokens (charcoal base/surface/elevated, ivory, crimson = selection/active,
  gold = earned mastery). Art must not colour-code correctness (§17.3–17.4); the runtime tints rims.

## Tooling (2026-10-10)

- `playwright.last-word.config.ts` accepts `PLAYWRIGHT_CHROMIUM_EXECUTABLE` so hosts whose
  preinstalled Chromium build differs from the pinned Playwright (e.g. this cloud image: 1194 vs
  1217) can run `npm run test:stack` without downloading a browser. Default behaviour is unchanged.
