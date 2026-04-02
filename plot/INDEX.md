# CODEBASE INDEX — VH Website (vh-website)
# STATUS: FINAL
# Generated: 2026-03-30

## SYSTEM IDENTITY
name: VH Beyond the Horizons Educational Platform
domain: Bangladesh university admissions coaching (IBA DU, BUP, DU FBS)
type: Full-stack web application
purpose: Student registration, educational games, mock exam results, eligibility checking
url: https://vh-beyondthehorizons.vercel.app

## TECH STACK
framework: Next.js 15.5 (App Router, TypeScript, React 19)
database: MongoDB Atlas + Mongoose ODM
auth: NextAuth v4 (Google OAuth only — no password auth)
ai: Google Gemini 2.5 Flash Lite (quiz question generation)
email: Resend (server-side admin notifications) + EmailJS (client-side, legacy)
styling: Tailwind CSS v4
charts: Recharts
spreadsheet: xlsx, googleapis
deployment: Vercel (serverless Node.js, read-only filesystem)

## CODEBASE SIZE
total_files: 235 (excl. git/node_modules/.next)
src_files: 76
language: TypeScript/TSX (primary), JavaScript (scripts), Python (data generation)

## ENTRY POINTS
web: src/app/layout.tsx → wraps all pages with AuthProvider + Header + Footer
auth: src/app/api/auth/[...nextauth]/route.ts (NextAuth handler)
db: src/lib/db.ts (Mongoose connection singleton, maxPoolSize:1 for Vercel)
build: package.json prebuild → generate:access-control + parse-accounting

## CRITICAL ARCHITECTURE: DUAL-LAYER ACCESS CONTROL
Layer 1 (build-time): access-control.json → scripts/generate-access-control.js → src/lib/generated-access-control.ts
Layer 2 (runtime): MongoDB users collection, managed via /api/admin/users
Runtime engine: src/lib/db-access-control.ts (60s cache, priority: cache > JSON > DB)
RISK: Layers can diverge — new admins in DB may not be in JSON fast-path
→ See FAILURE_MAP.md#RISK_002, AGENT_NOTES.md#NOTE-A1

## GAMES SUBSYSTEM (3 games)
1. Vocab Quiz (/games/vocab-quiz) — AI-generated questions via Gemini, all students
2. Mental Math (/games/mental-math) — client-side question gen, all students
3. FBS Accounting (/games/fbs-accounting) — 281 questions, 12 lectures, mastery tracking, FBS access only
   Most complex: dual scoring (simple +1/-0.25 + dynamic with speed/lecture bonuses)
   Question ID format CRITICAL: `lectureN_qM` — changing breaks mastery silently

## ROLES
super_admin: full access, can delete users, cannot be deleted by admins
admin: user CRUD, registration management, view all results
student: game access, own results only
IBA student: accessTypes.IBA grants duIba + bupIba mocks
FBS student: accessTypes.FBS grants duFbs + bupFbs mocks + FBS accounting game
fbsDetailed: individual grant only (no group path), separate premium offering

## PLOT FILES
- ARCHITECTURE.md   — Component map, layers, all 25 API routes, 6 Mongoose models, build pipeline
- DATA_FLOW.md      — 8 data flows (auth, registration, vocab, math, accounting, access control, results, mock)
- API_CONTRACTS.md  — Every API endpoint contract (in/out/errors/auth), env vars, Mongoose schemas
- FAILURE_MAP.md    — 37 risks RISK_001–RISK_037 (severity 1-5), ordered by priority
- CONNECTIONS.md    — Dependency graph, failure propagation paths, state boundaries, orchestration sequences
- DEEP_DIVES.md     — Line-by-line analysis of 5 critical files (auth.ts, db-access-control.ts, generate-questions, fbs-accounting/page.tsx, accounting-utils.ts)
- AGENT_NOTES.md    — Anomalies, dangerous assumptions, ambiguities, questions needing human clarification

## KEY EXTERNAL DEPENDENCIES
MongoDB Atlas: MONGODB_URI — all persistent data
Google OAuth: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET — auth provider
Google Gemini: GOOGLE_GEMINI_API_KEY (server-side only) — vocab quiz questions
Resend: RESEND_API_KEY — registration notifications to 3 hardcoded admin emails
Vercel: hosting, analytics, read-only filesystem (critical constraint)

## TOP 5 RISKS (from FAILURE_MAP.md)
RISK_009 sev:5 — Weak default init-admin secret (attacker creates super_admin)
RISK_003 sev:4 — No try-catch in auth callbacks (DB failure = 100% login outage)
RISK_015 sev:4 — No rate limiting anywhere (DoS, spam, cost abuse)
RISK_014 sev:4 — No CSRF protection on state-changing APIs
RISK_002 sev:4 — Dual access control divergence (JSON vs DB split-brain)

## IMPORTANT FILES TO READ BEFORE MAKING CHANGES
auth system:      src/lib/auth.ts, src/lib/db-access-control.ts
scoring:          src/lib/accounting-utils.ts, src/app/games/fbs-accounting/page.tsx
api patterns:     src/lib/api-utils.ts
models:           src/lib/models/ (6 files)
data access:      src/lib/db.ts, src/lib/mongodb.ts

## NON-OBVIOUS FACTS (read AGENT_NOTES.md for full context)
1. /api/admin/grant-access file writes FAIL silently in Vercel — use /api/admin/users POST instead
2. JWT role is from first login only — role changes need re-login
3. Accounting question IDs must match `lectureN_qM` format or mastery silently breaks
4. hasMockAccess() bypasses cache — don't call in a loop
5. Admin game scores are silently discarded (not a bug, but undocumented)
6. Registration notification emails go to hardcoded personal Gmail addresses
7. update-results.bat is the likely pipeline for updating test results in /public/data/
8. /api/admin/sync-admins has no admin role check (any auth'd user can call it)
