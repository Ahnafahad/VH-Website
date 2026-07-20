# VH Website — Project Context

> This file is identical in `D:\VH Website\` and `D:\VH Website\vh-website\` — if you edit one, copy it to the other. All paths below are absolute so it works from either.

**What this project is:** educational coaching platform for Bangladesh university admissions (IBA DU, BUP, FBS). Next.js 15 / React 19 / TS / Tailwind v4 / Turso+Drizzle / NextAuth v4.

## Navigation Protocol (read this first, every session)

This repo has a persistent index system so no session wastes tokens re-exploring. **Do not search or explore the codebase before checking the index — it already tells you where everything is.**

1. **Session start:** Read `D:\VH Website\.claude\index\SESSIONS.md` (last 2–3 entries) + `D:\VH Website\.claude\index\STATE.md`. That tells you where things stand, what was last worked on, and current git/deploy facts. Read `D:\VH Website\.claude\index\CODEBASE.md` sections only as the task needs them — file locations, routes, DB tables, scripts, gotchas all live there.
2. **Deep architecture questions:** read `D:\VH Website\vh-website\graphify-out\GRAPH_REPORT.md` (knowledge graph: 797 nodes, 32 communities, god nodes flagged) before grepping unfamiliar code.
3. **Core files** (used by nearly every API route): `src/lib/db/index.ts` (db client), `src/lib/api-utils.ts` (safeApiHandler, validateAuth, ApiException), `src/lib/auth.ts` (NextAuth + getServerSession), `src/lib/db/schema.ts` (all tables), `src/lib/db-access-control.ts` (roles), `src/middleware.ts` (route protection), `src/lib/utils.ts` (cn). Feature lookup pattern: API → `src/app/api/[feature]/`, UI → `src/components/[feature]/`, logic → `src/lib/[feature]/`, pages → `src/app/[feature]/`.
4. **Heavy reading:** the index exists so you rarely need bulk exploration — check it first. For large multi-file reading jobs that the index doesn't cover, consider delegating to a subagent instead of reading everything yourself.
5. **Session end = git push (MANDATORY):** any `git push` to GitHub marks the end of a work session. BEFORE pushing, always:
   - Append a 3–6 line entry to `.claude/index/SESSIONS.md` (format defined in that file).
   - Update the affected section of `.claude/index/CODEBASE.md` if files/routes/tables/scripts were added, moved, or removed.
   - Update `.claude/index/STATE.md` (git state, deploy, open-work status) — include the commit being pushed.
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
- **Local admin testing (DEV ONLY):** to sign in as super-admin (`ahnaf816@gmail.com`) without the Google OAuth round-trip, run the dev server (with the Turso TLS cert env, else the session stays empty), open **`/dev-login`**, and enter the `DEV_LOGIN_CODE` value from `vh-website/.env.local`. Backed by a `dev-login` NextAuth CredentialsProvider in `src/lib/auth.ts`, hard-gated to `NODE_ENV==='development'` (the provider is never constructed in prod and `/dev-login` 404s). Roles come from the DB, so this yields the same super-admin session a real login would. The normal `/auth/signin` page is Google-only and shows nothing about this.
- **Loose PNGs / logs at both roots:** session debris (screenshots), not assets. Don't index, don't delete unasked

## Behavioral Guidelines

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

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
