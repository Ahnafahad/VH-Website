---
name: db-schema-change
description: Correct workflow for making a database schema change in this repo (edit schema.ts, push to Turso via drizzle-kit, watch for the local TLS gotcha and the journal-desync gotcha). Trigger - user asks to add/modify a table or column, or run a schema migration.
---

# DB Schema Change Skill

Workflow for changing the database schema in this repo. DB is Turso (libSQL), managed with Drizzle.

## Key Files

- **Schema:** `src/lib/db/schema.ts` (~1252 lines, ~30 tables) — the single source of truth for table/column definitions.
- **DB client:** `src/lib/db/index.ts` — reads `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`, exports `db`.
- **Drizzle config:** `drizzle.config.ts` — loads `.env.local` manually, migrations output dir `./drizzle`.
- **Never edit `drizzle/**` by hand** — these are generated files.

## The Correct Command

Use `npx drizzle-kit push` to apply a schema change — **NOT `drizzle-kit generate`**. `push` pushes the current state of `schema.ts` directly to the live Turso DB (no migration file step in this repo's workflow).

## Critical Gotcha 1 — Local TLS

Running `drizzle-kit` (or any local Node script that talks to Turso) requires the env var `NODE_EXTRA_CA_CERTS` pointing at `win-roots.pem`, which lives at the **outer repo root**, one level above `vh-website/` (`D:\VH Website\win-roots.pem`). Without it, local Node→Turso TLS connections fail.

Example (run from `vh-website/`, bash):
```bash
NODE_EXTRA_CA_CERTS="../win-roots.pem" npx drizzle-kit push
```
Adjust the relative path if running from a different working directory.

## Critical Gotcha 2 — Drizzle Journal Desync

On 2026-08-05, several schema changes (new tables `batches`, `audit_log`, `avatar_characters`; new columns on `lms_announcements`, `test_windows`, `class_attendance`, `users`) were applied to prod via hand-written additive SQL instead of `drizzle-kit push`. As a result, `drizzle/meta/_journal.json` has **no entry** for those changes — drizzle-kit's own view of prod schema state is stale/incomplete for that slice.

**Do not trust a `drizzle-kit push` dry-run diff against prod as complete truth** without first checking `schema.ts` against the actual live table structure. The tool may:
- propose "changes" for something that already exists in prod (applied out-of-band), or
- miss that reconciliation is needed.

If uncertain whether this affects your change, **flag it explicitly to the user before running push**.

## Steps for a Normal Schema Change

1. Edit `src/lib/db/schema.ts` — add/modify Drizzle table/column definitions.
2. Set `NODE_EXTRA_CA_CERTS` (see Gotcha 1 above).
3. Run `npx drizzle-kit push` from `vh-website/`.
4. Read the interactive prompt carefully — drizzle-kit will ask about ambiguous renames/drops. Don't blindly accept; confirm the intent matches your change.
5. If new data needs seeding, write an idempotent seed script under `scripts/` — repo convention is dry-run by default with an `--apply` flag to actually write (see e.g. `seed-batches.mjs` as precedent). Don't seed inline.
