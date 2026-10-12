# Last Word — decisions

Running log of implementation decisions. Newest first within each area. The design spec
(`docs/last-word-complete-game-design.md`) controls product behaviour; these record how it was built
and why, where the spec leaves room.

## Question bank and production (2026-10-12)

- **The full question bank was imported and approved** at the owner's request. The importer reads a bank file (`{ sets: [...] }`), and `set-status all-audited approved` promotes every audited set in one step. Chains with errors are still withheld automatically.
- **Converter fixes, still with no wording changes:**
  - Edge ids are slugified (accents removed), so `cliché` and `protégé` work. The words themselves keep their accents.
  - Beat difficulty is optional, because the critic dropped it on some revised beats. Inventing ratings would break the rule against generating content.
- **Content is delivered as a static, cacheable JSON route,** not page props. 200 sets would add megabytes to every page load; a build-time route is fetched once and revalidated by ETag. Staff previews still come from the server, one set at a time.
- **Runtime file reads are declared to the bundler** (`outputFileTracingIncludes`). Otherwise Vercel functions would not ship `content/last-word/sets`, and the progress API and admin page would fail in production only.
- **Migration by generated SQL, not `drizzle-kit push`.** Production lacked the Essays/PrintDesk tables as well as Last Word's. Their `CREATE` statements came from `schema.ts` via `drizzle-kit export`. All 24 statements were dry-run on a disposable database, then applied as one atomic batch. `push` was avoided because the repo's journal is known to be out of sync with production, so `push` could propose unrelated changes.

## Content (2026-10-11)

- **Content is versioned files, not database rows.** `content/last-word/sets/*.json` ships with the deploy.
  Review status lives in each file (`draft → audited → approved → published`); a status change is a
  reviewed commit (`npm run last-word:set-status`). Players see `approved`/`published` only. This keeps
  the editorial history in Git, needs no migration, and means the game never depends on a write path.
  The source curriculum `vocab_word_contrasts` is never read by the game and never written by anything
  here (read-only recheck 2026-10-11: 888 rows, all `draft`).
- **Schema checks shape; `problems.ts` checks quality.** Previously one bad beat failed the whole set at
  parse time. Now the zod schema rejects a file only for shape/reference errors, and the ported
  `problems()` reports per chain: errors withhold that chain, warnings are editorial. 2 of the 95 audited
  chains are withheld (a `rehabilitate` beat that keeps the answer; a 24-word `feedback_short`).
- **Paraphrased decisive clues are allowed** (warning, not error). The pipeline's critic wrote clues as
  paraphrases (276 of 278 beats). They are shown quoted under the sentence instead of highlighted in it.
  Rejecting them would leave no playable pipeline content, and the wording cannot be changed here.
- **Pipeline sets import as `audited`, not approved.** Critic review is not human approval (§46 step 7).
  The five audited sets are playable by staff via `?preview=` until someone approves them.
- **Converter derivations** are documented in `content/last-word/README.md`. Notably, every pipeline
  chain becomes `practice` or `transfer`; diagnostic and probe rounds are chosen at runtime from those
  (easiest unseen chain for the cold read; a shift/transfer chain for the probe), so no field is invented.
- **Unaudited drafts cannot reach players three ways:** the import command refuses `drafts-unaudited/`,
  the loader rejects any set whose recorded source path contains it, and nothing is ever imported as
  approved.

## Learning and flow (2026-10-11)

- **One pure planner (`game/session.ts`) decides every step; XState only sequences it.** This makes the
  whole adaptive session testable without a browser (simulated learners in `learning.test.ts`) and
  guarantees identical decisions in every presentation tier.
- **Diagnostic (§14):** two cold reads with optional confidence and no feedback, then a probe if both
  are right. A = both cold + probe correct, unhinted, probe exercises a shift/hold/transfer → instruction
  skipped, review scheduled. B = at least half right. C = mostly wrong. D = any confident miss → the
  feedback screen appears immediately (§37), then contrast and a remedial context.
- **Remediation (§16):** C, D, or two misses in practice show the two-card contrast (word senses +
  boundary rule from content), then one remedial chain chosen to hit the missed misconception tag; a
  third miss earns a second. Outcome C additionally shows the set's positive anchors once, if present.
- **Journey shape (§23):** tutorial (first visit) → up to two due reviews → one warm-up on a strong
  edge → a new or in-progress edge (misconceptions first). A learned edge gets two practice rounds, one
  shift, one transfer. The journey adds another edge until six rounds are played; it ends at an edge
  boundary, never mid-remediation.
- **Scoring/evidence** keep §8/§13 values. Fixes: diagnostic B requires ≥ 50% right (one lucky hit among
  misses is C); the probe may be a held false shift. Tutorial decisions are never mastery evidence on
  either client or server.
- **§33 adjusted for two-word sets:** "same word correct in the same position repeatedly" is enforced as
  "not three times running". The literal "not twice" rule made two-word banks deadlock after one round.
  Word order is shuffled per session and chain.
- **Review rounds always ask confidence** (§37 "difficult reviews") and prefer transfer chains; a chain
  the learner has seen in an earlier session is used only when nothing novel is left (§15).
- **No timers.** Reading is self-paced with explicit pause (§41); `reactionTimeMs` excludes paused time.

## Presentation (2026-10-11)

- **The DOM button is the word; the 3D tile sits behind it.** Focus, labels, keyboard, screen readers
  and touch hit-testing never depend on WebGL. The canvas is `aria-hidden` and receives no events.
- **The answer cannot leak through animation:** the scene receives `best` only after the machine has
  judged the beat. The fulcrum tilts to the *selection*. Every new beat plays the same arrival cue and
  pane recession, so stay and flip beats are indistinguishable until judged (§17.3, §17.5).
- **Tiers:** Full = GLB tiles with clearcoat, HDR environment, sparkles on lock; Standard = Standard GLB,
  lightformer environment, no sparkles; Lite = CSS 2.5D on `tile-surface.lite.webp` over the backdrop
  image, no WebGL. Reduced motion = springs immediate, no float/panes/sparkles, text fades only. A WebGL
  failure or lost context drops to Lite without resetting the round (the actor lives above the canvas).
  An e2e test proves Full, Standard, Lite and reduced motion produce byte-identical outcomes.
- **Chamber shell is a separate static canvas** (`frameloop="demand"`) behind the page, so the tiles'
  live canvas stays small.
- **Mastery map is SVG + lists, not R3F.** It must work in Lite and with a screen reader anyway, and the
  spec's MVP asks for a basic map. Edges encode status by dash pattern *and* the status word.
- **Standard tile shares one material between rim and body** (2-material budget). Each tile clones its
  materials before tinting, so the selection glow lights only that tile.
- **Keyboard on `window`,** not the game root, so arrows/numbers/Enter still work after focus moves to
  a new screen heading.
- **Auth stall guard:** if the session check hangs for 5 s, play continues as a guest instead of
  leaving Continue disabled.

## Persistence and admin (2026-10-11)

- **Server recomputes everything** from the submitted raw decisions against the content the user may
  see (players: approved/published; staff: any loadable status). Sessions are idempotent by client id;
  a replay with different content is rejected. Guest progress replays tolerantly when content is later
  withdrawn.
- **Migration 0005 unchanged.** It is tested by applying all six journal migrations in order to a
  disposable libSQL file and comparing every Last Word table column-for-column with `schema.ts`.
- **Editorial page `/admin/last-word` is read-only, staff tier.** It shows validator output, a preview
  link and live item-quality flags (§45) computed from learner decisions only (staff and non-live sets
  excluded, per the security review).

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
