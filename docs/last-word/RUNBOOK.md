# Last Word — runbook

Exact steps for the four operations the owner performs. Run everything from the app repository root (`vh-website/`).

## 1. Add content

1. Put the new pipeline output (one JSON per pair, the `generate.md` shape, with a `qa` block from the critic) in any folder. **Never** use `docs/last-word/content-pipeline/drafts-unaudited/`; the importer refuses it.
2. Import:
   ```sh
   npm run last-word:import-content -- path/to/folder
   ```
   Each file becomes `content/last-word/sets/<set_id>.json` with status `audited` (or `draft` without a `qa` block). Re-importing keeps whatever status the set already has.
3. Validate:
   ```sh
   npm run last-word:validate-content -- --verbose
   ```
   `✗` lines are chains withheld from play. `·` lines are editorial warnings. A file listed as "not loadable" must be fixed before anything in it plays.
4. Review: deploy a preview (or run locally), sign in as staff, open `/admin/last-word`, then **Preview in game** for the set. Work through the checklist in `content/last-word/README.md`.
5. Approve:
   ```sh
   npm run last-word:set-status -- <set_id> approved
   ```
6. Commit `content/last-word/sets/` and deploy. Nothing else is needed. The game, scheduler, mastery map and API pick the set up automatically.

To withdraw a set: `npm run last-word:set-status -- <set_id> draft`, then commit and deploy. Learner history for it is kept. Guest progress skips it, and it disappears from the map.

## 2. Add or replace assets

1. Save the file at its exact path from `docs/last-word/ASSETS_NEEDED.md` under `public/last-word/assets/`.
2. Check it:
   ```sh
   npm run last-word:validate-assets
   ```
   `✓` means accepted, `·` means still a placeholder, `✗` means rejected (the reason is printed).
3. Optional local check: `npm run last-word:validate-assets -- --write`, then reload `/last-word`.
4. Commit and deploy. `prebuild` regenerates `available.json`, so only validated files are ever served. A rejected file never breaks the build; it is simply left out, and its placeholder stays.

## 3. Apply the database migration to production

> **Done 2026-10-12.** All five Last Word tables, plus the six Essays/PrintDesk tables this branch also needed, were created in production in one atomic batch after a dry run. Production now matches `schema.ts` (see `FINAL_REPORT.md` → Production). Keep these steps for rebuilding a database from scratch.

Without this step the game still works: guests save in the browser, and signed-in saves fail with a retry button. The migration adds five new tables and changes no existing table.

**Prerequisites:** an up-to-date Turso CLI login with access to `vh-beyond-the-horizon`, and `NODE_EXTRA_CA_CERTS=D:\VH Website\win-roots.pem` set for any local Node→Turso step.

1. Back up (recommended):
   ```sh
   turso db shell vh-beyond-the-horizon .dump > backup-before-last-word.sql
   ```
2. Confirm the tables do not exist yet. This should return no rows; as of 2026-10-11 it returns none.
   ```sh
   turso db shell vh-beyond-the-horizon "SELECT name FROM sqlite_master WHERE name LIKE 'last_word_%';"
   ```
3. Apply **exactly** this file and nothing else:
   ```sh
   turso db shell vh-beyond-the-horizon < drizzle/0005_last_word.sql
   ```
   Use this, not `npx drizzle-kit push`, because the repo's Drizzle journal has known desyncs (see the `db-schema-change` skill). `push` may try to reconcile unrelated tables, whereas this file only creates tables.
4. Verify there are 5 tables and 3 indexes:
   ```sh
   turso db shell vh-beyond-the-horizon "SELECT type, name FROM sqlite_master WHERE name LIKE 'last_word_%' ORDER BY type, name;"
   ```
   Expected tables: `last_word_decisions`, `last_word_edge_mastery`, `last_word_node_mastery`, `last_word_reviews`, `last_word_sessions`. Expected indexes include `last_word_sessions_user_idx`, `last_word_reviews_due_idx`, `last_word_decisions_edge_idx` and the auto-indexes behind the UNIQUE constraints.
5. Sign in, play one session at `/last-word`, and confirm the recap says "Saved to your account." `/admin/last-word` should then stop saying "Live analytics are unavailable".

**Rollback** (drops only the Last Word data):
```sql
DROP TABLE last_word_decisions; DROP TABLE last_word_reviews; DROP TABLE last_word_edge_mastery;
DROP TABLE last_word_node_mastery; DROP TABLE last_word_sessions;
```

This exact SQL is tested on a disposable database in `src/features/last-word/__tests__/database.test.ts`, which applies all six migrations in order and compares the result with `schema.ts`.

## 4. Deploy

1. Verify locally:
   ```sh
   npm ci
   npm run typecheck && npm run lint && npm test
   npm run last-word:validate-content -- --strict
   npm run last-word:validate-assets -- --strict
   npm run build
   ```
2. Browser suite against the production build (software WebGL makes the tier tests slow, about 8 min):
   ```sh
   next start --port 6977   # in one terminal, after the build, with any local env
   LW_BASE_URL=http://127.0.0.1:6977 npm run test:stack -- tests/last-word
   ```
   Do not run a build while a dev server uses the same `.next/`.
3. Merge `claude/relaxed-goodall-ioky1j` into `main` and push the inner repo's `origin`. Vercel builds and deploys. `prebuild` writes `available.json`.
4. After the deploy:
   - `/last-word` loads and **Enter the chamber** starts the tutorial.
   - `/admin/last-word` lists the sets.
   - If step 3 of the migration was done, a signed-in session saves.

The route is public. Remove the header link, or add `/last-word` to the middleware matcher, if it should stay hidden until content is approved. With no approved sets, the page says "No distinctions are published yet."
