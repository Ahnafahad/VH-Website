# Redline — Sentence Correction Mastery

Levelled sentence-correction practice for **IBA 2026-27** (product `iba`, batch `2026-27`; staff always). Modelled on Sprint's
immediate-reveal taker, but built around *diagnosis*: every answer is stored with its interaction signals and analysed into a
topic-wise weakness map shown beneath the level path on `/redline`.

## Content

- Source: the 850-record Sentence Correction Mastery bank (YAML per question: options, answer + proof, five-option autopsy,
  two hints, explanations, why-students-miss, how-to-catch, transfer item, QA notes). **The bank is not in this repo** (public
  repo, full answer key). Import from the file: `node scripts/import-redline.mjs <bank.md> [--apply] [--relevel]`
  (dry-run by default; `NODE_EXTRA_CA_CERTS` needed locally for Turso). Everything is stored losslessly in `redline_questions.content`.
- 6 records with `BLOCKED - GRAMMAR/ANSWER AMBIGUITY` QA status are `status='held'` (Q55, 82, 359, 740, 785, 807), no level.
- Answer keys are AI-derived and QA re-solved, not from a published key. The admin page flags questions where one wrong option
  dominates so a human can review.
- 844 live questions → **42 levels of 20** (last level 24). Difficulty ramps by band of 3 levels using a composite score (authored label
  + secondary-skill count + author confidence + QA flags + length); skills are dealt evenly across a band's levels. Once attempts
  exist, level assignment is frozen unless `--relevel`.
- Taxonomy (`src/lib/redline/taxonomy.json`): 60 raw skill labels → 18 canonical skills; free-text misconception tags → 16 error
  families; distractor "attraction" text → 7 trap types. `trapBase`/`familyBase` are the global base rates used for over-index;
  regenerate them if the taxonomy or bank changes.

## Flow and rules

- Finish (any score) level N → level N+1 opens. Replays allowed (`?replay=1`); **only first attempts feed analysis**.
- Per question: pick option (switches logged) → Sure/Unsure/Guess → server grades and reveals proof, autopsy of the picked trap,
  explanation, how-to-catch. A miss offers the record's **transfer question**; solving it reclassifies the miss as a *slip*.
  Hints (2) are logged with timestamps; time to first click, total time and time on the explanation are logged.
- Response classes: mastered, fragile, lucky, slip, gap, misconception (`classify.ts`). Correctness never reaches the client before lock-in.
- Attempts are saved per question, so a level can be resumed. Admin switch `redline_config.active` (default off); staff preview always,
  and staff/non-student data is excluded from cohort analytics.

## Analysis (`analysis.ts`, pure and unit-tested)

Evidence-weighted mastery per skill (class credit × recency × difficulty, secondary skills at 0.4, shrunk toward 50%, with a
margin and an "insufficient data" state); repeated error families; trap over-index vs base rate; behaviour profile (calibration of
"Sure", rushing, overthinking, hints, answer switching incl. talked-out-of-correct, fatigue within a level, letter bias, transfer
success); ranked weaknesses that quote the authored why-miss / how-to-catch text; level trend. No LLM at runtime.

## Where things live

`src/lib/redline/` (service, analysis, classify, taxonomy, access) · `src/app/api/redline/**` · `src/app/api/admin/redline/**` ·
`src/app/redline/**` · `src/app/admin/redline/**` · `src/components/redline/**` · tables `redline_config|questions|attempts|responses`
(DDL in `scripts/redline/schema.sql`, applied by the importer; `drizzle-kit push` is avoided per the journal-desync gotcha) ·
tests `src/lib/redline/__tests__/` (service tests run on in-memory libSQL using the same `schema.sql`).
