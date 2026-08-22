# Math Marathon Module — Build Spec (single source of truth)

Multi-day chapter drills for IBA batch students. Reuses the online-tests module's
taking mechanics (KaTeX/markdown MCQs, autosave, one attempt per student per
sitting) but with three deliberate differences — see the header comment above
`marathonChapters` in `src/lib/db/schema.ts` for the "why":

1. **Calendar unlock, not a window.** A `marathon_assignments` row pins a chapter
   to a product/batch with a `startDate`. Day N unlocks `startDate + (N-1) days`
   for everyone in the batch — never re-locks, so latecomers catch up while later
   days keep unlocking on schedule. `src/lib/marathon/unlock.ts`.
2. **Live per-question timing.** The client heartbeats elapsed on-screen time to
   `POST .../time` every ~4s and on navigate/hide/unmount, accumulating into
   `marathon_answers.time_spent_ms` across revisits (free navigation is allowed
   within a day, unlike the linear "attempt or skip" framing of the original
   ask — confirmed with the user). "Spent too long" is self-calibrating: flagged
   when a student's time is more than 2× the class median for that question/day,
   and only once ≥5 other timings exist. `src/lib/marathon/time-flags.ts`.
3. **Self-serve pause, no ban ladder.** Max 2 pauses per day, enforced server-side
   (`marathon_attempts.pause_count`/`paused_at`). Practice, not a proctored exam —
   there is no tab-leave escalation here, unlike `test_violations`.

Scoring is plain correct-count — **no negative marking** (mastery practice, not a
scored test). Results (answer key + solution, when authored + live class stats +
a chapter-wide subtopic-weakness rollup) are available immediately after a
student submits that day — no cohort window to wait out.

## Stack conventions (same as the tests module)
- Dynamic API params are `params: Promise<{ slug: string; day: string }>`.
- Client-facing types: import from `@/lib/marathon/types` (not the Drizzle schema).
- Math + markdown rendering: `@/components/workbook/RichText` — handles `$...$`,
  `$$...$$`, `**bold**`, `_italic_` (NOT single-asterisk `*italic*` — the import
  prep script converts those; see below).
- `requireUser`/`requireStaff` are reused from `@/lib/tests/route-helpers`
  (generic auth, not test-specific) rather than duplicated.
- DO NOT run `drizzle-kit generate` in this repo — the project's `drizzle/meta/`
  snapshots are stale relative to the real (push-only) DB history, so `generate`
  will try to recreate dozens of unrelated tables it thinks don't exist yet.
  Schema changes reach Turso via `npx drizzle-kit push` only.

## Student API (all require login)
- `GET /api/marathon` → `{ chapters: MarathonChapterListEntry[] }` — every
  chapter assigned to the caller, each day's lock state + the caller's attempt.
- `POST /api/marathon/[slug]/[day]/start` → `{ attemptId, resumed, startedAt }`
  — errors: `DAY_LOCKED` 403, `ALREADY_SUBMITTED` 409, `MARATHON_ACCESS_DENIED` 403
- `GET /api/marathon/[slug]/[day]/attempt` → `MarathonAttemptPayload` (no
  correctKey/solution) — error `NO_ATTEMPT` 409
- `POST /api/marathon/[slug]/[day]/answer` body `{ questionId, selectedKey: string|null }` → `{ saved: true }`
- `POST /api/marathon/[slug]/[day]/time` body `{ questionId, deltaMs (≤30000) }` → `{ saved: true }`
  — error `ATTEMPT_PAUSED` 409 (client must stop heartbeating while paused)
- `POST /api/marathon/[slug]/[day]/pause` body `{ action: 'pause'|'resume' }` → `{ pausedAt, pauseCount }`
  — error `NO_PAUSES_LEFT` 409 once `pauseCount` hits 2
- `POST /api/marathon/[slug]/[day]/submit` → `{ attemptId, totalCorrect, totalWrong, totalSkipped }`
- `GET /api/marathon/[slug]/[day]/results` → `MarathonResultsPayload` — error `NOT_SUBMITTED` 409

Error body shape: `{ error: string, code?: string }` with HTTP status, same as tests.

## Staff API
- `GET /api/admin/marathon/chapters` → all chapters (draft + published)
- `PATCH /api/admin/marathon/chapters/[id]` body `{ status: 'draft'|'published' }`
- `GET /api/admin/marathon/assignments` / `POST` body `{ chapterId, product, batch: string|null, startDate(ms) }`
  (batch `null` = every student on that product; reuses `GET /api/admin/batches` for the batch picker)

## Data model
`marathon_chapters` → `marathon_days` → `marathon_questions` (stem/options/solution
are markdown + `$...$`, same RichText format as `test_questions`; `solution` is
nullable — the results UI shows "solution coming soon" until authored).
`marathon_assignments` (chapter × product × batch × startDate) governs both
visibility and the unlock schedule. `marathon_attempts` (one per day×user) +
`marathon_answers` (one per attempt×question, `time_spent_ms` accumulates) +
`marathon_pause_events` (audit log). Subtopic tags (`primary_tag_code/label`,
`secondary_tag_code/label`) live directly on `marathon_questions` and drive
`getSubtopicWeakness()` in `src/lib/marathon/service.ts` — deliberately absent
from the plain tests module (`src/lib/tests/analytics.ts` explicitly vetoes
topic tags), present here because per-subtopic weakness is the whole point.

## Importing a new chapter
Two-step pipeline (`scripts/prep-marathon-from-tagged-json.mjs` → canonical JSON
→ `scripts/import-marathon.mjs` seeds it), mirroring `scripts/import-test.mjs`:

```
node scripts/prep-marathon-from-tagged-json.mjs \
  --questions <path to *_TAGGED.json>   \  # { days: [{ day, questions: [{ number, question, options, tags:{primary,secondary} }] }] }
  --answers   <path to *_answer_keys*.json> \  # { days: [{ day, answers: [{ question, answer }] }] }
  --solutions-dir <dir of Day_N_Solutions.md>  \  # optional; "### Question N" / "**Answer: (X)**" / "**Solution.** ..." / "---" blocks
  --slug <kebab-case> --title "<Chapter>" --subject math --product iba \
  --out marathon-import/<slug>.json

node scripts/import-marathon.mjs marathon-import/<slug>.json --dry-run   # validate only
node scripts/import-marathon.mjs marathon-import/<slug>.json            # seed (needs TURSO_* in .env.local)
```

The prep script converts single-asterisk `*italic*` spans in solution markdown
to `_italic_` (RichText doesn't recognize single-asterisk italics — see its
`parseMarkdown`) and re-derives `correctKey` per question from the answer-key
file rather than trusting anything embedded in the questions file. A day
missing its answer key is dropped with a warning; a day is never partially
seeded with unkeyed questions (`import-marathon.mjs` validation rejects that
outright — a marathon day must ship fully keyed, unlike draft tests).

Imported chapters start `status='draft'`; publish via `PATCH
/api/admin/marathon/chapters/[id]` (or the `/admin/marathon` UI) before
creating an assignment for it — students only ever see `published` chapters
(staff bypass this check to preview).

## Current content
`marathon-import/number-system.json` — Chapter 1 "Number System", 14 days × 30
questions (420 total), fully keyed. Solutions authored for Days 1–3 only; Days
4–14 show the answer key with "solution coming soon" until follow-up solution
sheets are prepped through the same pipeline.
