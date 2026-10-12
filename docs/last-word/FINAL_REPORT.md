# Last Word: final report

**Branch:** `claude/relaxed-goodall-ioky1j`. **Verified:** 2026-10-11, re-verified 2026-10-12 with the full question bank, on Windows 11, Node 24.20, against a production build (`next build` + `next start`) with a disposable in-memory database. **Production (2026-10-12, with the owner's permission):** migration applied, and the branch merged to `main` and deployed (see "Production").

## Verification

| Check | Result |
|---|---|
| `npm run verify:stack-peers` | pass |
| `npm run typecheck` | pass, 0 errors |
| `npm run lint` | pass, no warnings or errors |
| `npm test` (Vitest) | **66 files, 623 tests pass**. Last Word: 67 tests in `content.test.ts`, `learning.test.ts`, `database.test.ts` and `asset-checks.test.ts` |
| `npm run last-word:validate-content` | **200 sets (1,568 chains) load, 0 broken, all approved**; 5 chains withheld (see "Content still needed") |
| `npm run last-word:validate-assets -- --strict` | 52/52 assets accepted |
| `npm run build` | pass, 216 static pages |
| Playwright `tests/last-word/game.spec.ts` (production build) | **10/10 pass** |
| Playwright `tests/last-word-stack` (dev server) | 2/2 pass |
| Security review, auth gates (`security-reviewer`) | no critical or high findings; the two low findings were fixed |
| Read-only recheck of `vocab_word_contrasts` | 888 rows, all `draft`. Untouched |

Screenshots are in `docs/last-word/screenshots/`: Full desktop home and round, Standard and Lite at 390 px.

## §51: product experience

| Criterion | Status | Evidence |
|---|---|---|
| A new user understands the mechanic in under two minutes | **Pass** (structure); timing not measured with real users | Tutorial follows §21 exactly: choose, flip ("One detail can change the word."), hold ("New information doesn't always mean a new answer."), then the closing line. Two short chains. e2e `tutorial: choose, flip, hold, then the Last Word line — keyboard only`; unit `a first visit starts with the tutorial…` |
| A student who already knows a set can prove it and skip teaching | **Pass** | Diagnostic A skips all practice and moves to the next distinction. e2e `a learner who knows a distinction proves it and skips teaching`; unit `a learner who already owns a distinction proves it and skips instruction`; the recap reports "N distinctions skipped" |
| A student who knows a word but not its boundary gets contrast practice, not definitions | **Pass** | Outcomes B/C/D lead to practice, or to the two-card contrast (senses + boundary rule) and a remedial chain aimed at the missed misconception. Definitions are never repeated. Unit `a struggling learner gets contrast practice…`, `a confident misconception is corrected immediately`; e2e `wrong answers get the decisive clue and a contrast` |
| Context can change the answer without confusing the player about why | **Pass** | Feedback highlights the decisive clue in the sentence (or quotes it), gives the short reason, and "Why?" shows the counterfactual (what the earlier word fit, and what changed it). `RoundFeedback` in `presentation/screens.tsx` |
| The student can reverse a choice naturally | **Pass** | Selection stays open until Lock, via tap, arrows/A-D, number keys or swipe. e2e tutorial (arrow right/left then number) and `touch: swipe…switches the selection` |
| Feedback explains meaning, not just correctness | **Pass** | Every feedback screen shows the verdict, `feedback_short`, the decisive clue and `contrast_rule`. Same e2e as above |
| Replay uses novel contexts, not rote repetition | **Pass** | No chain repeats within a session; chains seen in earlier sessions are deprioritised (−100) and reused only when the bank is exhausted. Unit `never repeats a chain within a session…` (25 sessions), `review mode tests a due distinction in a context the learner has not seen` |
| The mastery map shows words and distinctions separately | **Pass** | Map has a word group (node status) and a distinction list (edge status), plus the SVG graph. e2e `a session saves on this browser and the mastery map reflects it after reload` |
| Reviews test delayed retrieval and transfer | **Pass** | Review mode selects due edges, prefers transfer chains and asks for confidence. A ≥ 7-day gap counts as retention evidence. Unit `review scheduling`, `review mode tests…` |
| Looks and feels premium without hurting readability | **Pass** (subjective; see screenshots) | Text is plain DOM on a calm card, never over particles. 3D tiles sit behind it. Motion settles before reading |
| Reduced-motion and low-performance modes keep the full learning interaction | **Pass** | e2e `identical learning outcome` for Full, Standard, Lite, and Full + reduced motion all match one snapshot; `WebGL unavailable falls back to the Lite chamber with the same game` |
| Content analytics can detect bad questions | **Pass** (logic); collects live data from the 2026-10-12 deploy | `content/quality.ts` flags items strong learners miss, split answers, implausible picks and slow reads, plus position bias. Shown on `/admin/last-word`. Unit `content QA flags (§45)`. Needs the migration and real play to produce data |

## §50: round quality

Most §50 items are editorial judgements about the wording, which this build can neither make nor change. The table shows how each one is enforced.

| Criterion | How it is enforced | Status |
|---|---|---|
| Real semantic confusion; intended sense | Pipeline triage and critic; editor checklist in `content/last-word/README.md` | Editorial |
| Situation sounds natural; beat 1 judgeable | Critic; checklist | Editorial |
| Later beats add evidence; flips caused by one clue; stays distracting not deceptive | Validator errors on shift-type and answer-path contradictions (`problems.ts`); the rest is the checklist | **Mechanical part passes** |
| Best answer more precise; defensible alternatives credited | Validator errors on non-top or tied best fit; scoring gives fit ≥ 0.4 partial credit (55 or 30) | **Pass** |
| No outside knowledge; no obvious lexical overlap | Validator errors when a candidate word or its stem leaks into the text; the rest is the checklist | **Mechanical part passes** |
| Feedback names the decisive clue | Every beat has `decisive_clue`, shown in feedback; a warning when it is not an exact excerpt | **Pass** (276 of the pipeline beats are paraphrased: shown quoted, not highlighted) |
| No harmful stereotypes | Critic; checklist | Editorial |
| Adds evidence about a real edge | Schema requires `edge_id` to exist; every decision updates that edge | **Pass** |
| **Animation does not reveal the answer** | The scene receives the best word only after judgment; the fulcrum follows the selection; identical arrival treatment on every beat | **Pass** (code invariant, `ChamberProps.best`; no test can see a difference before judgment) |

## §48: MVP scope

| Item | Status |
|---|---|
| 2–3 word confusion sets | Pass: 4 hand-made sets (one with 3 words) + 196 pipeline pairs |
| 3-beat evolving scenarios | Pass |
| Stay, flip and false-shift rounds | Pass (plus narrow, reframe, corrupt and rehabilitate in the pipeline sets) |
| Best/acceptable/incorrect scoring | Pass |
| Diagnostic skip logic | Pass |
| Node + edge mastery | Pass |
| Short explanations with decisive clues | Pass |
| Adaptive review queue | Pass |
| Premium shallow-3D word cards and context panel | Pass |
| Motion + haptic hooks | Pass (Web Vibration + Capacitor native haptics, `patterns.json` override) |
| Reduced-motion mode | Pass |
| Session recap | Pass |
| Basic mastery map | Pass |
| AI generation + critic pipeline | **Out of scope by instruction**: content is produced elsewhere. The import, validation and review gate for its output are built |

## What exists

- **Content:** `content/last-word/sets/*.json`, plus `src/features/last-word/content/{schema,convert,problems,load,quality}.ts`, `scripts/last-word/content.ts`, `npm run last-word:{validate-content,import-content,set-status}`, and `content/last-word/README.md`.
- **Learning:** `core/{learning,selection,types}.ts`; `game/{session,machine,store}.ts`.
- **Presentation:** `LastWordGame.tsx` and `presentation/{SemanticChamber,screens,audio,tokens}.tsx`; `assets/runtime.ts`; `last-word.css`.
- **Persistence/API:** `persistence/*`, `/api/last-word/progress`, `drizzle/0005_last_word.sql` (unchanged, tested).
- **Admin:** `/admin/last-word` (read-only, staff), and a staff-only `?preview=<set_id>` on `/last-word`.
- **Docs:** `DECISIONS.md`, `RUNBOOK.md`, `ASSETS_NEEDED.md`, this report.

## Assets

All 52 are supplied and pass strict validation. Earlier audit results are recorded in `ASSETS_NEEDED.md`. Two observations remain, with no code change needed:

- Listen to `mastery.mp3` and `perfect-read.mp3`; their shimmer is very quiet.
- The production backdrop canvas renders the shell at 70% opacity over the backdrop image. If the image alone looks better, delete `model.chamber-shell.*`.

## Content

- **200 approved sets are live**, 1,568 chains:
  - 4 hand-made sets.
  - 196 sets from `last-word-content/output/last-word-question-bank.json` (2026-10-12). Every chain in the bank had passed or been repaired in the independent audit, and the owner approved the bank for play.
- **One bank set was not imported:** `exorbitance-extravagance` (source pair 775). Its edge names definitions ("unfair/unreasonable demand…") instead of the two words. Skipped; the wording was not changed.
- **5 chains are withheld until reworded:**
  - `agnostic-atheist_019`, `purportedly-reportedly_016` and `stigmatize-stereotype_019`: a "rehabilitate" beat keeps the same answer.
  - `inept-inapt_012`: a "corrupt" beat keeps the same answer.
  - `mortify-horrify_017`: `feedback_short` is 24 words; the maximum is 22.
- **Clue wording:** the bank's clues are paraphrased the same way as before. Only 212 of 3,290 are exact quotes, and 10 more differ only in capitalisation or punctuation. The game now matches clues regardless of capitalisation. The rest are shown quoted under the sentence, not highlighted in it. Making them exact quotes is a wording job for the content pipeline.
- **6 critic-revised beats have no difficulty ratings.** They play normally; the validator lists them and decisions store `null` for them.
- **Coverage:** 196 of the 532 flippable curriculum pairs now have content.

## Production

- **Database (2026-10-12):** 11 new tables in production, created in one atomic batch:
  - 5 from `drizzle/0005_last_word.sql`.
  - 6 for Essays and PrintDesk. These features were on this branch, but their tables had never been created in production. Their `CREATE` statements were generated from `schema.ts` with `drizzle-kit export`.
- **How it was applied:**
  - The batch was dry-run first on a disposable database.
  - It was applied with nothing existing touched: 11 tables and 13 indexes, `CREATE` only.
  - A check afterwards found production matches every table and column in `schema.ts`.
  - `drizzle-kit push` was deliberately not used, because of the documented journal desync.
- **Deploy:** branch merged into `main` and pushed; Vercel builds from `main`.
- **Content delivery:** the bank (about 5 MB as files) is served as a statically built, cacheable `/api/last-word/content` with unused fields removed, instead of being embedded in every page. `next.config.ts` `outputFileTracingIncludes` ships `content/last-word/sets` with the routes that read it at runtime.

## Not done or not verified

- Real-device performance (Chromium software rendering only), audio playback on devices, haptics on phones, and the "under two minutes" claim with real learners.
- Phase 2 items (§49): Daily Chain, Shift/Transfer Run modes, a dedicated "What Would Flip It?" interaction (the feedback counterfactual covers the idea), and teacher-authored sets in the UI.
