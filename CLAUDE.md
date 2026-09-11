# VH Website — Project Context

> This file is identical in `D:\VH Website\` and `D:\VH Website\vh-website\` — if you edit one, copy it to the other. All paths below are absolute so it works from either.

**What this project is:** educational coaching platform for Bangladesh university admissions (IBA DU, BUP, FBS). Next.js 15 / React 19 / TS / Tailwind v4 / Turso+Drizzle / NextAuth v4.

## Navigation Protocol (read this first, every session)

This repo has a persistent index system so no session wastes tokens re-exploring. **Do not search or explore the codebase before checking the index — it already tells you where everything is.**

The index is split by concern so a normal session only ever reads a small, current slice of it — not an ever-growing log:

1. **Session start — read `STATE.md` in full, that's it.** `.claude/index/STATE.md` is a small (~4KB), always-current snapshot: open security items, git/deploy facts, genuinely open work, environment quirks. It has no commit history and nothing "resolved" or "superseded" — stale facts get replaced in place, not appended to. Skim `.claude/index/SESSIONS.md`'s top 2-3 entries only if you need very recent narrative detail STATE.md doesn't carry.
2. **`SESSIONS.md` is a search-only archive, not a proactive read.** It holds the last ~10 session write-ups (newest on top); older ones rotate out to `.claude/index/archive/SESSIONS-archive-*.md`. Grep either only when a task needs the story behind a specific past change — don't read either file in full by default. Same for `.claude/index/archive/STATE-archive-*.md` (old STATE.md content, before a trim).
3. Read `.claude/index/CODEBASE.md` sections only as the task needs them — file locations, routes, DB tables, scripts, gotchas all live there.
4. **Deep architecture questions:** read `D:\VH Website\vh-website\graphify-out\GRAPH_REPORT.md` (knowledge graph: 797 nodes, 32 communities, god nodes flagged) before grepping unfamiliar code.
5. **Core files** (used by nearly every API route): `src/lib/db/index.ts` (db client), `src/lib/api-utils.ts` (safeApiHandler, validateAuth, ApiException), `src/lib/auth.ts` (NextAuth + getServerSession), `src/lib/db/schema.ts` (all tables), `src/lib/db-access-control.ts` (roles), `src/middleware.ts` (route protection), `src/lib/utils.ts` (cn). Feature lookup pattern: API → `src/app/api/[feature]/`, UI → `src/components/[feature]/`, logic → `src/lib/[feature]/`, pages → `src/app/[feature]/`.
6. **Heavy reading:** the index exists so you rarely need bulk exploration — check it first. For large multi-file reading jobs that the index doesn't cover, consider delegating to a subagent instead of reading everything yourself.
7. **Session end = git push (MANDATORY):** any `git push` to GitHub marks the end of a work session. BEFORE pushing, always:
   - Append a **short** entry (the format below — 1-3 lines under "Did", not a full writeup) to `.claude/index/SESSIONS.md`.
   - If `SESSIONS.md` now holds more than ~10 entries, cut the oldest ones out to a dated file under `.claude/index/archive/` (same format, one-line header noting the date range) — keep today's entry in the live file so the pre-push hook can find it.
   - Update the affected section of `.claude/index/CODEBASE.md` if files/routes/tables/scripts were added, moved, or removed.
   - Update `.claude/index/STATE.md` **in place** — edit/replace the relevant fact (git state, deploy, open-work status), don't append a new paragraph on top of an old one. If something listed as open is now resolved, delete that bullet rather than striking it through.
   - Include these index updates in the commit when pushing the outer repo, so the index on GitHub always matches the code.

   This is not optional. A push without an index update means the next session starts blind.
   **Enforced mechanically:** a `pre-push` git hook (installed in both repos, source: `scripts/git-hooks/pre-push`) blocks any push when SESSIONS.md lacks an entry dated today. Never bypass with `--no-verify` unless the user explicitly says so.

## Repo Hygiene

- **Never write scratch files (screenshots, test outputs, logs, temp scripts) to repo root.** Use the session scratchpad directory. Root `.gitignore` blocks loose images/logs as backstop.
- Old debris lives in `_archive/session-debris/` (gitignored) — ignore it.

## Key Facts (the ones sessions keep forgetting)

- **Domain:** https://www.vh-beyondthehorizons.org/ (canonical, used in metadataBase/sitemap/robots/JSON-LD)
- **App code:** `vh-website/` — Next.js 15 App Router, React 19, TS, Tailwind v4, its own git repo inside this one
- **Git:** root repo → `origin` = github.com/Ahnafahad/VH-Website.git, branch `main`. Inner `vh-website/` repo has TWO remotes: `origin` (VH-Website) and `blank-canvas` — verify remote before pushing
- **DB:** Turso (libSQL) + Drizzle. Schema: `vh-website/src/lib/db/schema.ts`. Schema changes reach DB via `npx drizzle-kit push` (NOT generate). Local Node→Turso needs TLS workaround: `NODE_EXTRA_CA_CERTS` → `win-roots.pem` at repo root
- **Deploy:** Vercel, region bom1, 11 cron jobs in `vh-website/vercel.json`. npm is canonical (bun.lock is stale)
- **Dev servers** (`.claude/launch.json`): vh-website → :6960, lecture-template → :7788, omr-station → :8765
- **Local admin testing (DEV ONLY):** to sign in as super-admin (`ahnaf816@gmail.com`) without the Google OAuth round-trip, either open **`/dev-login`** in a browser (dev server running, Turso TLS cert env set) and enter the login code, or — cheaper, zero browser tokens — run `bash scripts/dev-login.sh [port]` against a running dev server: it auto-detects the port (6960-6975), decrypts the code, does the NextAuth `csrf` + `callback/dev-login` POST dance, leaves a curl cookie jar (`curl -b <jar> ...` for authed API calls), and writes a Playwright session-injection snippet to `.playwright-mcp/pw-login.js` for an authed browser. The login code itself is stored as a Fernet-encrypted `DEV_LOGIN_FERNET_KEY`/`DEV_LOGIN_FERNET_TOKEN` pair in `vh-website/.env.local` (decrypted via `scripts/decrypt-dev-login-code.mjs`, using the `fernet` npm package) rather than plaintext. Both `scripts/dev-login.sh` and `scripts/decrypt-dev-login-code.mjs` are deliberately gitignored — local-only, never commit. **Gotcha:** the code is non-ASCII (CJK); curl.exe on Windows/MSYS mangles non-ASCII argv strings to `?`, so the code must be passed via `--data-urlencode name@<winpath-file>`, not as a literal argv string — `dev-login.sh` already does this correctly. Backed by a `dev-login` NextAuth CredentialsProvider in `src/lib/auth.ts`, hard-gated to `NODE_ENV==='development'` (the provider is never constructed in prod and `/dev-login` 404s). Roles come from the DB, so this yields the same super-admin session a real login would. The normal `/auth/signin` page is Google-only and shows nothing about this.
- **Loose PNGs / logs at both roots:** session debris (screenshots), not assets. Don't index, don't delete unasked

## Automations (skills, hooks, subagents, MCP servers)

New machine? See `MACHINE_SETUP.md` (outer repo root) for what to install/configure first — env vars, the local TLS workaround, and how to re-register the MCP servers below (they're per-machine, not synced via git).

**MCP servers** (`claude mcp list` to check status; registered at local/project scope, not `.mcp.json`, so they don't sync via git):
- **context7** — live library/framework documentation lookup. Claude invokes it automatically when it needs current docs for a dependency (Next.js, Drizzle, NextAuth, etc.) instead of relying on training-data knowledge, which can be stale for fast-moving libraries.
- **turso** — direct read access to the live Turso DB (list tables, inspect schema, run `SELECT`s) from inside Claude Code, via `mcp-turso`. Carries a live `TURSO_AUTH_TOKEN` — this is why it's local-scope only, never project-shared. Useful for verifying actual DB state against `schema.ts` (see the drizzle-journal-desync gotcha in `.claude/index/CODEBASE.md` §5) without writing a throwaway script.

**Skills** (`vh-website/.claude/skills/`):
- `db-schema-change` — the correct workflow for changing the DB schema (edit `schema.ts` → `npx drizzle-kit push`, not `generate` → the `NODE_EXTRA_CA_CERTS`/`win-roots.pem` TLS gotcha → the 2026-08-05 journal-desync gotcha). Both Claude and the user can invoke it (Claude reaches for it automatically on schema-change tasks).
- `lms-feature-conventions` — Claude-only background knowledge (`user-invocable: false`) on the role-tier system (`isStaffRole`/`isAdminRole`/`isSuperAdminRole`, the `isAdminEmail()`-is-actually-staff-level gotcha, the `isUltimateTesterEmail` visibility-vs-authorization rule) and the LMS shared-primitive modules (tx-retry, vocab points/attempt-stats, `resolveAudience`, admin LMS design tokens). Loaded automatically whenever Claude touches auth/admin/LMS code — not meant to be run as a `/slash` command.
- Pre-existing: `magic-ui`, `ui-ux-pro-max`, `test-import` (see their own SKILL.md files).

**Hooks** (`vh-website/.claude/settings.json`, team-shared/git-tracked):
- **PostToolUse** on `Edit|Write|MultiEdit` — after any `.ts`/`.tsx`/`.js`/`.jsx` write under `src/`, runs ESLint on that file and surfaces findings back to Claude. Report-only, never blocks — a lint error doesn't stop the edit.
- **PreToolUse** on `Edit|Write|MultiEdit` — blocks any attempted edit to `drizzle/**` (generated migrations — use the `db-schema-change` skill's workflow instead) or `.env.local` (live secrets — edit by hand, outside Claude).
- Personal/local overrides (Bash permission allowlist etc.) stay in the separate, gitignored `.claude/settings.local.json` — untouched by the above.

**Subagents** (`vh-website/.claude/agents/`), invoke via the Agent tool:
- `security-reviewer` — read-only (Read/Glob/Grep/Bash), checks diffs against this repo's specific known auth bug patterns: the `isAdminEmail()`/`isAdminRole` staff-vs-admin confusion, `isUltimateTesterEmail` leaking into an authorization gate, missing/wrong-tier `requireAdmin()`/`requireStaff()` gates, and content-visibility-vs-authorization conflation. Reach for it on any diff touching `src/lib/auth/**`, `src/app/api/admin/**`, or route-level staff/admin gates.
- `code-reviewer` — read-only, general PR-review substitute (no CI/CD exists in this repo). Checks admin-LMS design-token discipline, the Server/Client Component `lms-shared.tsx` import boundary, duplicated logic that should reuse a shared primitive (tx-retry, vocab points/attempt-stats, `resolveAudience`), and general repo-style conventions. Extra scrutiny for `src/app/admin/**` (flagged god-node in `graphify-out/GRAPH_REPORT.md`).

## Behavioral Guidelines

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 0. Understand the problem before touching anything

Do not make a change until you actually understand the problem or the vision behind the request — not just the literal words. If the user's message is even slightly ambiguous (e.g. they say something as underspecified as "okay, this" while pointing at something unclear, or a request could reasonably mean two different things), **stop and ask simple, direct questions** before doing anything. Guessing at intent and building the wrong thing costs more than one clarifying question.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
