# Last Word: content pipeline handover

- **Branch:** `claude/relaxed-goodall-ioky1j` (this folder: `docs/last-word/content-pipeline/`)
- **Snapshot of:** the untracked local working folder `D:\VH Website\last-word-content`, last touched 2026-10-04.
- **Companion docs:** [`../handover/README.md`](../handover/README.md) covers the game code; this folder covers the *content* the game needs. Read both.
- **Next agent prompt (cannot generate content):** [`AGENT_PROMPT.md`](AGENT_PROMPT.md)

## What this is

Last Word needs "chains": short situations revealed in 2-5 beats, where a player picks which of two confusable words fits best (stay / flip / false-shift). The curriculum source is the `vocab_word_contrasts` table (888 draft rows, exported to `source/pairs.json`). Content is produced by an LLM pipeline, gated by mechanical checks and an adversarial Gemini Pro review. Everything that needs an LLM is **frozen** here; this folder preserves its inputs, prompts, scripts, outputs and verdicts so work can continue without it.

## State (as of 2026-10-04, last log entry)

| Stage | Result | Files |
| --- | --- | --- |
| Source export | 888 pairs | `source/pairs.json` (`.tsv` is the same data for prompts) |
| Triage ("can context flip this pair?") | 888 judged, **532 flippable** | `source/triage.json`, `source/flippable-ids.json`, `prompts/triage.md` |
| Generation | 20 chains per pair, Gemini flash (`run-gen.mjs`) or Hermes free-tier (`hermes-draft.mjs`) | `prompts/generate.md` |
| Mechanical check | `problems()` in `scripts/run-gen.mjs` | see below |
| Adversarial review + repair | Gemini Pro, per-chain PASS / REVISE (with `revised_chain`) / REJECT | `prompts/review.md`, `critic/review-<id>.json` |
| **Audited sets** | **5 of 532**: ids 133 scrupulous/meticulous, 291 mortify/horrify, 295 eccentric/eclectic, 367 inherent/innate, 400 agnostic/atheist (17-20 chains each; a `qa` block records pass/revised/rejected counts) | `sets-audited/` |
| **Unaudited drafts** | 36 Hermes/Gemini drafts, 16-20 chains. **Not reviewed; do not ship.** Five of them (133, 291, 295, 367, 400) are the pre-review versions of the audited sets. | `drafts-unaudited/` |
| Run history | Runs stopped repeatedly on Gemini quota ("0/12 clean", "STOPPED batch 1") | `batches.log` |

About 496 flippable pairs have no usable draft, and no state after 2026-10-04 is recorded here. Per-run logs, `scratch/`, `pilot-v1/` and the `_jobs` prompt copies were left out as noise.

### Review verdicts on the five audited sets

`critic/review-*.json` (PASS/REVISE/REJECT): 133 = 1/19/0; 291 = 17/3/0; 295 = 15/3/2; 367 = 14/3/3; 400 = 12/8/0. Set 133 needed repair on 19 of 20 chains, which shows how weak first drafts are. Expect the unaudited drafts to be similar.

## Two formats, and they differ

- **Pipeline output** (`sets-audited/*.json`, `drafts-unaudited/*.json`) has keys `set_id, source_pair_id, words, semantic_axes, edge, anchors, chains` (+ `qa` once audited). See `prompts/generate.md` for the exact contract.
- **Game runtime** (`src/features/last-word/content/schema.ts`) is a strict zod schema with `schema_version`, `title`, `edges[]`, per-chain `edge_id`, `domain`, `purpose`, numeric `difficulty`, per-beat `difficulty`/`hints`, and it rejects unknown keys.

There is **no converter yet**. Writing it is deterministic engineering work (no LLM needed) and is the first useful task. Fields the pipeline does not supply (for example `purpose`, numeric chain `difficulty`) must be derived by explicit documented rules or left to a human; do not invent linguistic content.

## Mechanical checker (`problems()` in `scripts/run-gen.mjs`)

Rejects a set when: shape is not 2 words and 13-20 chains; a chain has no frame or 2-5 beats; `best_word` is not a target word or not the top `fit`; a beat text starts with either target word (minus final e/y); a `flip` never changes answer; a `stay`/`false_shift` changes answer; the share of chains ending on word A is outside 30-70%. Known ceiling (marked `ponytail:` in source): irregular derivatives such as compel/compulsion slip through; the Gemini critic was the backstop. `hermes-draft.mjs` currently `eval`s this function out of `run-gen.mjs`, which is fragile, so a standalone tested module is a good task.

## Re-running the pipeline (needs an LLM, so not for the next agent)

`scripts/` hard-codes local paths (`D:/VH Website/last-word-content`, `agy.exe`, `D:\AI-Stack\scripts\start-hermes.ps1`) and models (`gemini-3.8-flash-high` for generation, `gemini-3.1-pro-high` for critique). They are kept for reference and for the owner's machine. `loop.sh` retries across Gemini quota windows. Hermes (free tier via OmniRoute) is the draft source; Gemini is reserved for audit because its quota is the bottleneck. Planned on 2026-10-04 (not confirmed done): audit every 6 sets instead of 12, a stricter survival threshold (15 chains), a larger second-audit sample.

## Rules that must survive

- Never publish unaudited drafts. Never overwrite `vocab_word_contrasts` rows or statuses; generated game scenarios stay separate from source curriculum.
- Do not apply migrations or write to the production database.
- The existing `content/last-word/sets/*.json` fixtures (assure-ensure, confident-arrogant, frugal-thrifty-miserly, persistent-obstinate) are small hand-made demos, unrelated to the pipeline sets here.
