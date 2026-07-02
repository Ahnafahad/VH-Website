# Online Tests Module — Build Spec (single source of truth)

Everything in this doc is already implemented on the backend. UI agents build against
these contracts exactly. Do not invent new endpoints or change response shapes.

## Stack conventions
- Next.js 15 App Router, React 19, TypeScript strict, Tailwind CSS v4.
- Dynamic API params are `params: Promise<{ slug: string }>` → `(await params).slug`.
- Auth: NextAuth v4. Server: `getServerSession(authOptions)` from `@/lib/auth`.
  Client: `useSession()`. `session.user.isAdmin` is true for admin/super_admin/instructor.
- All client-facing types: import from `@/lib/tests/types` (NOT the Drizzle schema).
- Math + markdown rendering: reuse `@/components/workbook/RichText`
  (`<RichText content={...} />`) — handles `$...$`, `$$...$$`, `**bold**`, `_italic_`.
  Question stems, options, passages are stored in this format.
- Framer Motion: type variants as `Variants`, use `type: 'spring' as const` in transitions.
- Dev server: port 6960 (`npm run dev`). DO NOT run the dev server, DO NOT run
  `drizzle-kit push`, DO NOT commit. Verify with `npx tsc --noEmit` only.

## Student API (all require login; 401/403 handled by `safeApiHandler`)
- `GET /api/tests` → `{ tests: TestListEntry[] }`
- `POST /api/tests/[slug]/start` body `{ windowId }` → `{ attemptId, resumed, deadline }`
  - errors: `WINDOW_NOT_OPEN` 409, `ATTEMPT_BANNED` 403, `ALREADY_SUBMITTED` 409, `MODE_LOCKED` 409
- `GET /api/tests/[slug]/attempt` → `AttemptPayload`
  - errors: `NO_ATTEMPT` 404, `ATTEMPT_BANNED` 403, `ALREADY_SUBMITTED` 409, `TIME_UP` 409
- `POST /api/tests/[slug]/answer` body `{ questionId, selectedKey?: string|null, flagged?: boolean }` → `{ saved: true }`
- `POST /api/tests/[slug]/violation` → `{ action: 'warning'|'reset'|'ban', tabLeaveCount }`
  (server owns the ladder: 1st warning, 2nd reset = answers wiped, 3rd ban)
- `POST /api/tests/[slug]/submit` → `{ submitted: true }` (score NOT returned; hidden until windows close)
- `GET /api/tests/[slug]/results` → `ResultsPayload`
  - error `RESULTS_NOT_PUBLISHED` 403 until every window closed (staff bypass)

Error body shape: `{ error: string, code?: string }` with HTTP status.

## Staff API (admin + instructor unless noted)
- `GET /api/admin/tests` → tests incl. drafts, windows with `state`, attemptCounts
- `PATCH /api/admin/tests/[id]` (ADMIN ONLY) body `{ status?, allowedProducts?: string[]|null, publishResults?: boolean }`
- `POST /api/admin/tests/[id]/windows` body `{ mode, opensAt(ms), closesAt(ms), durationMinutes? }` (online requires duration)
- `PATCH /api/admin/tests/windows/[windowId]` body `{ status?: 'scheduled'|'open'|'closed', opensAt?, closesAt?, durationMinutes? }`
- `DELETE /api/admin/tests/windows/[windowId]` (409 if attempts exist)
- `GET /api/admin/tests/[id]/attempts` → `{ attempts: [...] }` w/ user, violations, scores
- `POST /api/admin/tests/attempts/[attemptId]` body `{ action: 'reset'|'unban' }`
- `GET|PATCH /api/admin/tests/[id]/answer-key` (ADMIN ONLY) — PATCH body `{ keys: { [questionId]: 'A'|null } }`, re-scores submitted attempts

## Timing model
- Online window: opensAt–closesAt + durationMinutes. Attempt deadline =
  min(startedAt + duration, closesAt). Server returns `deadline` (epoch ms) — the
  client timer counts down to it; never trust client time for enforcement.
- Offline window: the window itself is the answer-entry slot; deadline = closesAt.
- Auto-submit at 0:00 (server grants 2 min grace).

## Anti-cheat UX (online mode only)
- On `visibilitychange` → hidden (or window `blur`), POST `/violation` once per leave
  (debounce; don't double-fire for blur+hidden of the same event).
- `warning` → full-screen modal: "Warning 1 of 2 — next time your progress resets."
- `reset` → modal, local answer state cleared, re-fetch attempt payload, timer keeps running.
- `ban` → terminal screen: banned from this test, contact admin. No further API calls.
- Before start, show the rules screen (must acknowledge) — both modes get the rules;
  violations are only reported in online mode.

## Design system — "Examination Hall" sub-brand
Tokens already defined in `src/app/globals.css` (`--color-exam-*`), usable as Tailwind
utilities e.g. `bg-exam-base text-exam-ink border-exam-border`.
- Dark: base `#14100E`, surface `#1E1815`, elevated `#2A221E`, border `#3A2F29`.
- Brand maroon `#760F13` / bright `#9A1B20` (primary actions, current question).
- Gold `#C8A24B` / bright `#E4C169` (flags, seals, emphasis). Glow `--color-exam-glow-gold`.
- Ink `#F3ECE2`, muted `#B7A99A`, faint `#7C6E60`. Success `#4CB882`, danger `#D4625A`, warning `#E4A93C`.
- OMR/offline sheet: light paper `#FAF5EF` card on dark base (real answer-sheet feel).
- Typography: use existing site fonts; serif display (Cormorant Garamond is loaded for
  vocab — reuse for big scores/headers), UI in the default sans.
- Micro-interactions: spring-based (framer-motion is installed). Option select = physical
  press; palette chips animate state changes; timer pulses gold under 5 min, red under 1 min.
- FULLY RESPONSIVE: mobile-first. On mobile the question palette becomes a bottom
  drawer/sheet; passage collapses to an expandable panel above the question.
- Premium ≠ generic: no default-looking cards; characterful, editorial, crafted.

## Existing code to imitate
- Admin pages: `src/app/admin/layout.tsx`, `src/components/admin/AdminSidebar.tsx`
- Dark sub-brand precedent: `src/app/vocab/*` (LexiCore) and math game components
- API route style: `src/app/api/tests/*` (already built — read before writing UI fetches)

## Import JSON format (canonical, for the test-import skill)
```json
{
  "slug": "iba-mock-4",
  "title": "IBA Mock Test 4",
  "bucket": "iba",
  "description": "Full-length IBA mock — 70 questions, 70 marks.",
  "sections": [
    {
      "order": 1,
      "title": "Language and Communication",
      "marksPerCorrect": 1,
      "penaltyPerWrong": 0.25,
      "thresholdPercent": null,
      "groups": [
        { "ref": "s1-instr-1", "kind": "instruction", "title": null, "content": "Each of the following sentences..." },
        { "ref": "s1-passage-1", "kind": "passage", "title": null, "content": "The sloth bear, an insect-eating..." }
      ],
      "questions": [
        {
          "number": 1,
          "group": "s1-instr-1",
          "stem": "The professor's ______ demeanor and ______ outlook influenced the team.",
          "options": [
            { "key": "A", "text": "reticent, mundane" },
            { "key": "B", "text": "austere, laconic" }
          ],
          "correctKey": "D",
          "imageUrl": null,
          "explanation": null
        }
      ]
    }
  ]
}
```
Rules: `group` references a `ref` in the same section (nullable). `correctKey` nullable
(key can be loaded later via admin API). Math inside content uses `$...$` (RichText
format). Images: place under `public/tests/{slug}/` and set `imageUrl` to `/tests/{slug}/...`.
Totals (totalQuestions/totalMarks) are computed by the seeder, not stored in JSON.
Seeder: `scripts/import-test.mjs` (validates then upserts via `@libsql/client` using
`TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` from `.env.local`).
