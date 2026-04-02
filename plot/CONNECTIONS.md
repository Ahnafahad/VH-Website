# CONNECTIONS — vh-website
# AGENT: AGENT-CONNECT
# CROSS-REFS: ARCHITECTURE.md, DATA_FLOW.md, API_CONTRACTS.md, FAILURE_MAP.md

## 1. FULL DEPENDENCY GRAPH (ASCII)

```
[Google OAuth]
    ↓
[auth.ts] ← GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
    ↓ signIn callback
[db-access-control.ts]
    ├─← [access-control.json] (startup, module-level singleton)
    ├─← [MongoDB User model] (dynamic, DB query)
    └─← [emailCache Map] (60s TTL, in-memory)
    ↓ isEmailAuthorized → true/false
[JWT creation + session enrichment]
    ↓
[Authenticated session.user: {email, role, isAdmin, permissions, accessTypes, mockAccess}]
    ↓
┌─────────────────────────────────────────────────────────────────────┐
│  AUTHENTICATED REQUEST LAYER                                         │
│                                                                      │
│  Header.tsx → GET /api/auth/check-admin → isAdminEmail              │
│  ProtectedRoute.tsx → useSession() (client-side guard)              │
│                                                                      │
│  [Public Pages]       /   /registration   /eligibility-checker      │
│  [Game Pages]         /games/vocab-quiz                             │
│  [Admin Pages]        /admin/users  /admin/registrations            │
└─────────────────────────────────────────────────────────────────────┘
    ↓
[API Route Layer]
    ├─ /api/registrations (PUBLIC POST) → Registration model + Resend API
    ├─ /api/generate-questions → Gemini 2.5 Flash Lite (GOOGLE_GEMINI_API_KEY)
    ├─ /api/vocab-quiz/scores → VocabScore model
    ├─ /api/vocab-quiz/leaderboard → VocabScore.aggregate()
    ├─ /api/mental-math/scores → MathScore model
    ├─ /api/mental-math/leaderboard → MathScore.aggregate()
    ├─ /api/accounting/scores → AccountingScore + updateQuestionMastery()
    │       └─→ AccountingProgress model (upsert)
    ├─ /api/accounting/progress → AccountingProgress model
    ├─ /api/accounting/leaderboard → AccountingScore.aggregate()
    ├─ /api/user/access → db-access-control.getComputedMockAccess
    ├─ /api/admin/users (CRUD) → User model + clearAccessControlCache()
    └─ /api/admin/sync-* → access-control.json + User model

[MongoDB Atlas]
    ├─ users
    ├─ registrations
    ├─ mathscores
    ├─ vocabscores
    ├─ accountingscores
    └─ accountingprogresses

[Static Files /public/data/]
    ├─ accounting-questions.json (in-memory cached, app lifetime)
    ├─ simple-tests.json
    ├─ full-tests.json
    ├─ mock-tests.json
    ├─ fbs-mock-tests.json
    ├─ bup-mock-tests.json
    └─ students.json
    ↓ fetched by results/page.tsx (no cache, fresh each mount)
[student-matcher.ts] → studentId / email / roleNumbers lookup
    ↓
[Recharts: SeriesProgressChart, PerformanceBarChart, PercentileChart, ...]
```

---

## 2. FLAT CONNECTIONS LIST [A]→[B]: reason

### Auth & Access Control
- [auth.ts] → [db-access-control.isEmailAuthorized]: gate on every sign-in
- [auth.ts] → [db-access-control.getUserByEmail]: enriches JWT (first login) + session (every request)
- [auth.ts] → [db-access-control.isAdminEmail]: sets session.user.isAdmin flag
- [db-access-control] → [access-control.json]: startup sync read, module-level singleton
- [db-access-control] → [MongoDB User model]: DB query for students + DB admin fallback
- [db-access-control.emailCache] → [60s TTL]: write on miss, clear via clearAccessControlCache()
- [/api/admin/users PATCH] → [clearAccessControlCache()]: invalidates stale cache after user update
- [/api/admin/sync-admins] → [access-control.json]: reads JSON to sync admins to DB
- [/api/admin/grant-access] → [access-control.json]: attempts file write (DISABLED in Vercel — read-only fs)

### Games
- [fbs-accounting/page.tsx] → [/api/user/access]: FBS access gate (three-state: null/true/false)
- [fbs-accounting/page.tsx] → [accounting-utils.getAccountingQuestions]: questions JSON (module cache)
- [fbs-accounting/page.tsx] → [/api/accounting/progress GET]: loads mastery for adaptive selection
- [fbs-accounting/page.tsx] → [accounting-utils.getQuestionsByLectures]: mastery-aware 16-Q selection
- [fbs-accounting/page.tsx] → [accounting-utils.calculateSimpleScore]: +1/-0.25 scoring
- [fbs-accounting/page.tsx] → [accounting-utils.calculateDynamicScore]: speed + lecture bonuses
- [fbs-accounting/page.tsx] → [/api/accounting/scores POST]: fire-and-forget optimistic save
- [/api/accounting/scores] → [accounting-utils.updateQuestionMastery]: async, non-blocking
- [accounting-utils.updateQuestionMastery] → [AccountingProgress model]: upsert mastery document
- [vocab-quiz/page.tsx] → [/api/generate-questions POST]: AI question generation per session
- [/api/generate-questions] → [Google Gemini API]: server-side only (GOOGLE_GEMINI_API_KEY)
- [vocab-quiz/page.tsx] → [/api/vocab-quiz/scores POST]: save score
- [mental-math/page.tsx] → [/api/mental-math/scores POST]: save score
- [All score endpoints] → [isAdmin flag]: admin scores excluded from leaderboards

### Registration
- [registration/page.tsx] → [/api/registrations POST]: public form submit
- [/api/registrations POST] → [Registration model]: create document
- [/api/registrations POST] → [email.sendRegistrationNotification]: async fire-and-forget
- [email.ts] → [Resend API]: RESEND_API_KEY, 3 hardcoded recipient emails

### Results
- [results/page.tsx] → [/public/data/*.json]: fresh fetch on mount (no caching)
- [results/page.tsx] → [/api/auth/check-admin]: determine admin vs student view
- [results/page.tsx] → [/api/user/access]: get access flags for mock display
- [results/page.tsx] → [student-matcher.ts]: resolve session email → test results
- [student-matcher.ts] → [students.json]: email reverse lookup + roleNumbers matching

### Build Pipeline
- [scripts/generate-access-control.js] → [access-control.json]: reads source
- [scripts/generate-access-control.js] → [src/lib/generated-access-control.ts]: writes TypeScript
- [scripts/parse-accounting-questions.js] → [/public/data/accounting-questions.json]: writes JSON
- [package.json prebuild] → [both scripts]: runs before every build

---

## 3. COMPONENT → API OWNERSHIP MAP

| Component | Owns/Manages | Consumes APIs |
|-----------|-------------|---------------|
| auth.ts | JWT/session shape | db-access-control (isEmailAuthorized, getUserByEmail, isAdminEmail) |
| db-access-control.ts | Email cache, access decisions | User model, access-control.json |
| Header.tsx | Nav visibility | GET /api/auth/check-admin |
| ProtectedRoute.tsx | Client-side auth gate | useSession() |
| fbs-accounting/page.tsx | Full game state machine | GET /api/user/access, GET /api/accounting/progress, POST /api/accounting/scores, GET /api/accounting/leaderboard |
| vocab-quiz/page.tsx | Quiz state | POST /api/generate-questions, POST /api/vocab-quiz/scores, GET /api/vocab-quiz/leaderboard |
| mental-math/page.tsx | Game state (client-side Qs) | POST /api/mental-math/scores, GET /api/mental-math/leaderboard |
| registration/page.tsx | Multi-step form state | POST /api/registrations |
| results/page.tsx | Chart + student selector | GET /data/*.json, GET /api/auth/check-admin, GET /api/user/access |
| admin/users/page.tsx | User CRUD UI | GET/POST/PATCH/DELETE /api/admin/users |
| admin/registrations/page.tsx | Registration management | GET/PATCH /api/registrations |
| accounting-utils.ts | Question selection, scoring, mastery | /data/accounting-questions.json, AccountingProgress model |
| email.ts | Transactional email | Resend API (RESEND_API_KEY) |
| api-utils.ts | Shared API patterns | validateAuth(), ApiException, safeApiHandler |

---

## 4. FAILURE PROPAGATION PATHS

### [FPATH-1] MongoDB Down → Login Outage
```
MongoDB unavailable
  → db-access-control.getCachedUser throws (after cache TTL expires)
  → auth.ts.signIn has no try-catch
  → signIn callback throws
  → ALL sign-ins fail
  → Users locked out
RISKS: RISK_001 + RISK_003
SCOPE: 100% login outage for students (admins degrade to JSON-only lookup)
```

### [FPATH-2] Access Control Divergence → Split-Brain Auth
```
Admin added to DB via /api/admin/users POST
  → generated-access-control.ts NOT updated (build artifact is stale)
  → Cross-region Vercel instances have different generated files
  → Some instances: admin found → granted access
  → Other instances: admin not found → denied access
RISKS: RISK_002 + RISK_012
SCOPE: Admin inconsistency; unpredictable auth for new admins
```

### [FPATH-3] FBS Check Failure → Unauthorized Score Submission
```
/api/accounting/scores called with session but dbUser lookup returns null
  → Access check: `if (!dbUser?.accessTypes?.FBS && !isAdmin)` — dbUser null check inconsistent
  → Non-FBS user score saved to AccountingScore
  → Leaderboard aggregation includes unauthorized entry
RISKS: RISK_005 + RISK_011
SCOPE: Leaderboard contamination; FBS exclusivity violated
```

### [FPATH-4] Cache Stale → Active Session After Deactivation
```
Admin deactivates user in /api/admin/users PATCH
  → clearAccessControlCache() called immediately (good)
  → BUT: existing JWT cookie still valid (no revocation list)
  → Next request: getCachedUser finds user active again (fresh DB hit returns active:false, correct)
  → However: session.user.role is from JWT (stale, not re-queried from session callback)
  → JWT check vs DB check can conflict
RISKS: RISK_022 + RISK_030
SCOPE: Deactivated user may continue activity for session duration
```

### [FPATH-5] Score Cheating → Leaderboard Fraud
```
Attacker crafts POST /api/accounting/scores with:
  { simpleScore: 16.0, dynamicScore: 999.0, correctAnswers: 16 }
  → Server validates structure (types, ranges) — passes
  → Server does NOT recalculate scores from questionResults[]
  → Score saved to AccountingScore with fake values
  → Leaderboard aggregation: sort by dynamicScore DESC
  → Attacker appears at top
RISKS: RISK_011
SCOPE: Permanent leaderboard corruption until manual cleanup
```

### [FPATH-6] Gemini Down → Vocab Quiz Unavailable
```
GOOGLE_GEMINI_API_KEY revoked OR Gemini API quota exceeded
  → /api/generate-questions returns 500
  → vocab-quiz/page.tsx shows error state
  → No fallback questions
  → Feature 100% unavailable
RISKS: RISK_019
SCOPE: Vocab quiz feature completely down; no degraded mode
```

### [FPATH-7] Mastery Question ID Mismatch → Silent Mastery Loss
```
parse-accounting-questions.js changes output question ID format
  → Questions JSON has IDs like "q_001" instead of "lecture1_q1"
  → accounting-utils.updateQuestionMastery filters: id.startsWith(`lecture${num}_`)
  → No match found, nothing added to masteredQuestions Set
  → AccountingProgress.totalMastered = 0 (stale from before)
  → All questions treated as "unmastered" forever
  → Adaptive selection breaks silently
RISKS: (unlisted, implicit) → AGENT_NOTES.md#ambiguity-2
SCOPE: Silent mastery loss; no error thrown; feature "works" but incorrectly
```

---

## 5. STATE BOUNDARY CROSSINGS

### Client → Server
| Crossing | Transport | Risk |
|----------|-----------|------|
| Game answers + scores | POST body JSON | No schema validation on questionResults[] (RISK_025) |
| Registration form | POST body JSON | email validated only with includes('@') (RISK_008) |
| Auth token | HTTP-only cookie | JWT stale after first login (RISK_023) |
| Prompt for Gemini | POST body JSON | Passed to Gemini unfiltered (prompt injection) |

### Server Cache → Database
| Cache | Storage | TTL | Invalidation Gap |
|-------|---------|-----|-----------------|
| emailCache (db-access-control) | In-memory Map | 60s | User deactivation not reflected for 60s (RISK_022) |
| adminsFromJson (db-access-control) | Module singleton | App lifetime | Only server restart (RISK_002) |
| cachedData (accounting-utils) | Module singleton | App lifetime | Questions update invisible until restart |
| JWT token | HTTP-only cookie | 24h+ | No revocation mechanism (RISK_023) |

### File → Memory
| File | Load Time | Used By | Risk |
|------|-----------|---------|------|
| access-control.json | Module init (once) | db-access-control.ts | Missing file = silent empty admin list (RISK_002) |
| accounting-questions.json | First request (cached) | accounting-utils.getAccountingQuestions | Missing file = 500 on progress endpoint |
| students.json | Per-request (no cache) | /api/admin/sync-role-numbers | Stale file = out-of-sync role numbers |
| /public/data/*.json | Per mount (no cache) | results/page.tsx | Large files = slow page load |

---

## 6. CRITICAL PATHS (Break these = most damage)

### CRITICAL-1: Sign-In Flow (Severity: TOTAL OUTAGE)
```
Sequence: OAuth → signIn callback → isEmailAuthorized → getCachedUser → DB/JSON lookup
Break at: getCachedUser (DB down, no cache)
Result: 100% sign-in failure
Fix: try-catch in signIn; fallback to generated-access-control.ts for admins
```

### CRITICAL-2: FBS Accounting Game (Severity: FEATURE OUTAGE)
```
Sequence: FBS access check → load questions → mastery selection → play → submit score → update mastery
Break at: FBS access check fails (API 500)
Result: Game inaccessible to all FBS students
Break at: /public/data/accounting-questions.json missing
Result: Game loads but questions empty, throws on startQuiz
```

### CRITICAL-3: Admin User Management (Severity: ACCESS CONTROL BREAK)
```
Sequence: Admin PATCH user → clearCache → next request re-fetches user
Break at: clearAccessControlCache() not called after update
Result: Stale access for up to 60s (RISK_022)
Break at: PATCH endpoint validates session.user.role === 'admin' (correct)
Result: Non-admins blocked (safe)
```

### CRITICAL-4: Score Integrity (Severity: DATA QUALITY)
```
Sequence: Client calculates scores → POST /api/scores → server accepts → saved to DB
Break at: Client sends inflated scores
Result: Leaderboard corrupted; no detection mechanism
Break at: questionResults[] contains nulls
Result: updateQuestionMastery crashes silently
```

### CRITICAL-5: Results Display (Severity: FEATURE DEGRADED)
```
Sequence: Mount page → fetch 5+ JSON files → student-matcher lookup → render charts
Break at: Any JSON file missing
Result: Dashboard shows empty/blank (graceful)
Break at: student-matcher returns null (no matching ID)
Result: Student sees blank results (no error, just empty)
```

---

## 7. PERMISSION FLOW (Full Trace)

```
User authenticates:
  Google OAuth → auth.ts.signIn → isEmailAuthorized() → {bool}
  if true:
    jwt callback: getUserByEmail() → {role, permissions, accessTypes, mockAccess} → stored in JWT
    session callback: getUserByEmail() → enriches session.user (every request, cached 60s)

Request arrives:
  API handler reads session.user.role (from JWT, stale)
    OR
  API handler queries User.findOne({email}) (fresh, direct DB)
    ├─ role === 'admin' || 'super_admin' → admin gates pass
    ├─ accessTypes.FBS === true → FBS game access granted
    └─ mockAccess.duIba || accessTypes.IBA → duIba mock access granted

Permission computation:
  Admins: all access = true (bypass all checks)
  Students:
    duIba  = mockAccess.duIba  || accessTypes.IBA
    bupIba = mockAccess.bupIba || accessTypes.IBA
    duFbs  = mockAccess.duFbs  || accessTypes.FBS
    bupFbs = mockAccess.bupFbs || accessTypes.FBS
    fbsDetailed = mockAccess.fbsDetailed (no group grant)
```

---

## 8. DATA INTEGRITY CHAIN (Leaderboard Trust)

```
Game play (client)
  → Client calculates: simpleScore, dynamicScore, speedBonus, lectureBonus
  → POST /api/{game}/scores
  → Server: structure validation only (types, ranges, correct+wrong+skipped === 16)
  → Server: NO math recalculation ← TRUST BREAK (RISK_011)
  → MongoDB: saves both client-calculated values
  → GET /api/{game}/leaderboard
  → MongoDB aggregate: sort by dynamicScore DESC
  → Client: displays leaderboard

Trust chain: Client (untrusted) → Server (no validation) → DB (accepts) → Display
RISK: Leaderboard is not trustworthy for competitive use
FIX: Server recalculate simpleScore from questionResults[]; verify dynamicScore within tolerance
```

---

## 9. ADMIN ACTION IMPACT MAP

| Admin Action | Immediate Effect | Cache Effect | Propagation |
|-------------|-----------------|-------------|-------------|
| POST /api/admin/users | Create User doc in DB | None | Next request: email lookup finds new user |
| PATCH /api/admin/users (active:false) | DB update | clearCache() called | ~60s window before all checks reflect deactivation |
| PATCH /api/admin/users (accessTypes) | DB update | clearCache() called | ~60s window for access change |
| DELETE /api/admin/users | User doc deleted | clearCache() called | Immediate (next cache miss queries → null) |
| POST /api/admin/sync-admins | DB upsert from JSON | None | DB now has admin users matching JSON |
| POST /api/admin/grant-access | Attempts JSON write (fails in prod) | None | Student NOT added; silent failure in Vercel |

---

## 10. EXTERNAL DEPENDENCY RISK MAP

| Service | If Down | Fallback | Severity |
|---------|---------|----------|---------|
| Google OAuth | Login 100% broken | None | CRITICAL |
| MongoDB Atlas | All DB ops fail; auth breaks after cache expires | JSON admins (60s) | CRITICAL |
| Google Gemini API | Vocab quiz broken | None | HIGH |
| Resend email | Admin notification lost | None (fire-and-forget) | MEDIUM |
| Vercel | App down entirely | None | CRITICAL |

---

## 11. ORCHESTRATION SEQUENCES

### New Student Enrollment (Correct Path)
```
1. Admin creates user: POST /api/admin/users
   body: {email, name, role:'student', accessTypes:{FBS:true}}
2. User doc created in MongoDB
3. clearAccessControlCache() called
4. Student signs in → getCachedUser → DB query finds new user → access granted
5. Student FBS access: accessTypes.FBS = true → game unlocked

ISSUE: If admin uses /api/admin/grant-access instead:
  → Tries to write to access-control.json (fails silently in Vercel)
  → User not added to DB either in this path
  → Student denied access; admin sees 200 OK
  → RISK_012
```

### Admin Bootstrap (Initial Deployment)
```
1. Deploy with INIT_ADMIN_SECRET set in Vercel env
2. POST /api/init-admin {secret: "..."}
3. Creates super_admin + admin User docs in DB
4. access-control.json manually edited with same admins
5. npm run generate:access-control creates generated-access-control.ts
6. Rebuild + redeploy
7. Both layers (JSON + DB) now have admin

RISK: Step 2 uses default secret 'your-secret-key-change-this' if env not set → RISK_009
```

### Score Submission + Mastery Update
```
1. User finishes game in fbs-accounting/page.tsx
2. Client calculates scores (client-side)
3. setGameState('finished') [optimistic update]
4. fetch('/api/accounting/scores', {...}) [background, non-awaited]
5. Server: validates structure (but NOT math)
6. Server: saves AccountingScore document
7. Server: calls updateQuestionMastery() [async, non-blocking]
   → updateQuestionMastery: upsert AccountingProgress, add mastered IDs, update lecture completion
8. Server response: {success, mastery feedback}
9. Client: setMasteryFeedback(data.mastery)
10. Client: reload /api/accounting/progress [adds 500-1000ms]

RISK: Step 4 is fire-and-forget; score loss not visible to user → RISK_006 (analogy)
RISK: Step 7 mastery update async; silent fail → mastery data stale
```
