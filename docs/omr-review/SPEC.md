# OMR Review — spec (2026-11-04)

Two halves:
- **Website** (`D:\VH Website\.worktrees\omr-review`, Next.js, branch `claude/omr-review`): DB columns, a secret-protected station API, student-facing result changes.
- **Station** (`D:\OMR Station Package`, local FastAPI + one-page UI at :8765, not git — backup at `D:\OMR Station Package.bak-2026-11-04`): new "Website mock" workflow that does matching + review and publishes through the API.

The website stays the single source of truth for answer keys, student list, scoring and ranking. The station never touches the DB and never re-implements scoring.

## Workflow (what the admin does)

1. Station → "Website mock" → pick a mock (list from website) → upload 30–40 scanned JPGs → run the existing engine (IBA engine: 6-digit roll, 90 Q A–E; only Q1..N are used, N = mock's question count, e.g. 70 for Mock 1).
2. Station fetches the mock bundle (questions in order, students, existing attempts + their entered answers) and auto-matches every sheet.
3. Review screen, grouped:
   - **Matched** — scanned roll exactly equals a student's `studentId`, no duplicates. Shows OMR score vs entered score, diff, and a per-question discrepancy list (Q, OMR letter, entered letter). Click a sheet → discrepancies + the marked image. Per question the admin can tick **"system error"** → the final answer for that question becomes the student's *entered* answer. Unticked → OMR answer stands (student's own marking mistake). Default decision **Accept**; "Accept all matched" bulk button. Admin may switch any one to Reject.
   - **Needs match** — roll unreadable / unknown / duplicate. Station proposes ranked candidates by (a) roll similarity (positional digit agreement, blank/unreadable digits = wildcard) and (b) answer-pattern similarity against entered answers of students not yet matched to a paper. Admin views the image + roll crop, picks a candidate or types an ID, then Accept or Reject. Once assigned it behaves like Matched (discrepancy view if the student had entered answers).
   - **Paper only** — matched student never entered answers online. Default Accept.
   - **No paper** (informational) — students with a self-entered attempt but no sheet after matching. No action: they keep their entered result, ranked, shown with an **Online** tag.
   - **Online takers** — students whose attempt `mode='online'`: never modified. If a sheet maps to one, warn and skip it.
4. Publish: blocked until every sheet is assigned to a student and has a decision. Station uploads each sheet's **marked** (engine "checked") image, then sends all decisions. Re-publishing is idempotent (overwrites).

## Decision semantics (website)

- **Accepted**: final answers (OMR with system-error overrides already applied by the station) replace the attempt's answers; `result_source='omr'`, `omr_status='accepted'`. Ranked normally.
- **Rejected**: same answer replacement and full results/analysis, `omr_status='rejected'`; **excluded from the rank/leaderboard** (not from class averages / per-question stats); student's result page shows "Your paper was rejected" and no rank.
- Attempts with `result_source='self'` (no paper, or online takers) stay ranked and get an **Online** tag on the leaderboard and their own result.
- Students see a "View your OMR sheet" button on their mock result page when `omr_image_key` is set (presigned R2 URL, own attempt only; staff can view any).

## DB (testAttempts, additive nullable columns)

- `omr_status` text — null | 'accepted' | 'rejected'
- `omr_image_key` text — R2 key `omr-sheets/<testId>/<userId>.jpg`
- `omr_meta` text — JSON audit `{ scannedRoll, matchedBy: 'exact'|'manual', systemErrorQuestions: number[], omrScore, enteredScore }`

## Station API (website)

Auth: every route requires header `Authorization: Bearer <OMR_STATION_SECRET>` (env var; constant-time compare; 401 otherwise; if the env var is unset the routes return 503). No NextAuth session. Base path `/api/omr-station`. Note middleware only blocks read-only *session* tokens; these requests carry none, so they pass.

All question numbers below are 1-based positions in test order (section order, then question order) — the same order as `importOmr` in `src/lib/mocks/omr-import.ts`.

```
GET  /api/omr-station/mocks
  → { mocks: [{ id, slug, title, examCode, totalQuestions, status }] }        // tests.is_mock = 1

GET  /api/omr-station/mocks/:id
  → { test: { id, slug, title, examCode, totalQuestions },
      questions: [{ no, id, section }],                                         // no answer keys sent
      students:  [{ userId, studentId, name }],                                 // every user with a non-null student_id
      attempts:  [{ userId, studentId, mode, status, resultSource, omrStatus,
                    totalScore, answers: (string|null)[] }] }                   // answers indexed by no-1, length = totalQuestions

POST /api/omr-station/mocks/:id/score
  body { sheets: [{ ref: string, answers: (string|null)[] }] }                  // length = totalQuestions
  → { results: [{ ref, totalScore, totalCorrect, totalWrong, totalUnattempted }] }   // pure, no writes; uses scoreAttempt

POST /api/omr-station/mocks/:id/image?userId=123     (raw image/jpeg body, ≤ 4 MB)
  → { key }                                                                     // stored in R2

POST /api/omr-station/mocks/:id/publish
  body { dryRun?: boolean,
         decisions: [{ userId, status: 'accepted'|'rejected', answers: (string|null)[],
                       imageKey?: string, meta?: object }] }
  → { applied, created, overwritten, skippedOnline: number[], skippedBanned: number[], errors: [{ userId, error }] }
```

Publish per decision: skip (report) if the existing attempt is `mode='online'` or `status='banned'`; otherwise create (against the latest offline window, like `importOmr`) or overwrite the attempt, rescored with `scoreAttempt`, inside one transaction per student. Reuse `importOmr`'s internals by extracting a shared helper instead of duplicating.

## Station config

`station/config.py`: `WEBSITE_URL` (default `https://www.vh-beyondthehorizons.org`, overridable by env `OMR_WEBSITE_URL`, e.g. `http://localhost:6960`) and secret from env `OMR_STATION_SECRET` or a gitignored-style local file `data/website_secret.txt`. Never hardcode the secret.
