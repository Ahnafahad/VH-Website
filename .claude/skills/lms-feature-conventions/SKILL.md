---
name: lms-feature-conventions
description: Background knowledge on this repo's auth/role-tier system and LMS shared-primitive conventions (roles.ts predicates, isAdminEmail staff-vs-admin gotcha, ultimate-tester visibility-vs-authorization rule, shared dedup modules, audience resolution, admin LMS design tokens). Use automatically whenever touching LMS, admin, or auth code.
user-invocable: false
---

# LMS Feature Conventions

Authoritative background on this repo's auth/role-tier system and LMS shared primitives, so existing logic isn't reinvented or misused. Source of truth: `.claude/index/CODEBASE.md` §4 "Shared primitives".

## 1. Role Tiers (`src/lib/auth/roles.ts`)

This file is THE definition of each privilege tier:
- `isStaffRole` = admin | super_admin | instructor
- `isAdminRole` = admin | super_admin **ONLY** (excludes instructors)
- `isSuperAdminRole` = super_admin only

These are pure predicates — they don't read the session or throw. Callers keep their own lookup/status/message handling.

**GOTCHA (has bitten this repo before):** `isAdminEmail()` (in `db-access-control.ts`) and the `session.user.isAdmin` flag derived from it are actually **STAFF-level, not admin-only** — instructors pass this check too. The name predates the instructor role and is misleading.

**Any authorization gate built on `isAdminEmail()`/`session.user.isAdmin` admits instructors.** Use `isAdminRole` from `roles.ts` when the intent is truly "admins only, not instructors."

### `isUltimateTesterEmail(email)`

Hardcoded, case-insensitive match on a single specific QA email — a plain `student`-role account that bypasses CONTENT-VISIBILITY gating (draft/published status, product/batch assignment, day-unlock, result windows, anti-cheat exemption, recording watchability) so QA can see student-facing content before real students see it.

**Rule: never OR this into an admin-AUTHORIZATION gate** (`isStaffRole`/`isTestStaff`/`isMarathonStaff`, which gate `/api/admin/*` routes). It must only ever be OR'd into content-VISIBILITY checks — e.g. `tests/access.ts` results/violation checks, `marathon/service.ts`, `lms/access.ts`'s private `isStaff` helper, `lms/homework-access.ts`, the recordings watch-url route.

Mixing these two purposes would let a student-role QA account into admin-only surfaces.

## 2. Shared Dedup Modules — Prefer These Over Re-deriving the Same Logic

- `src/lib/db/tx-retry.ts` — `MAX_TX_ATTEMPTS` (3) + `isTursoConflict()`, the Turso write-contention retry predicate.
- `src/lib/vocab/points.ts` — `awardPoints(dbOrTx, userId, points, now)`, the single write path for `vocab_user_progress.total_points`/`weekly_points`. No-ops at `points <= 0`. Does NOT create a missing progress row.
- `src/lib/vocab/attempt-stats.ts` — `nextAttemptStats(prev, rating)`, the attempt/streak/accuracy fold shared by practice + flashcard rate routes. "unsure" rating is neutral (no attempt/streak change).
- `src/lib/lms/access.ts` — has:
  - `lmsScopeConditions` — generic LMS content visibility, used by most content tables.
  - `lmsStudentAudienceConditions(content)` — "which students is this content for", used by notifications.
  - `lmsAnnouncementScopeConditions` — a SEPARATE function kept deliberately apart from the generic one, because only announcements carry `target_user_ids` (individual targeting). An individually-targeted announcement must not leak to the rest of its batch via the generic path.

## 3. Audience Resolution

`src/lib/audience/resolve.ts`'s `resolveAudience` is the SINGLE path for computing "who gets this" across the email blast, LMS feed, and push notifications.

**Never build a second/parallel audience-resolution path** — this repo already had a bug where the email blast and LMS feed computed recipients independently and drifted; `resolve.ts` replaced both.

## 4. Admin LMS Design Tokens

- `src/components/admin/lms/tokens.ts` — pure, no `'use client'`, safe for Server Components. Token source (colors, radius, type scale, shadows, `Z_*` stacking constants) matching `brand-kit/BRAND_KIT.md`.
- `src/components/admin/lms/lms-shared.tsx` — `'use client'`. Re-exports the tokens plus shared UI primitives (`PrimaryBtn`/`GhostBtn`/`DangerBtn`/`IconBtn`/`FieldInput`/`FieldSelect`/`Modal`/`ConfirmDialog`/`PageHeader`/`EmptyState`/`Toggle`) and at-risk popover primitives.

**Server Components must import tokens directly from `./tokens`, not from `lms-shared.tsx`** — importing anything from a `'use client'` file in a Server Component proxies ALL its exports as client references and breaks at runtime.

Rules for these admin LMS screens:
- Never hardcode a hex/`rgba()` — derive tints from a token with an alpha-hex suffix.
- Never write a raw z-index — use the `Z_*` constants.
- Every LMS screen must render `<style>{SPIN_CSS}</style>` exactly once — hover/focus-visible states for shared primitives depend on it.
