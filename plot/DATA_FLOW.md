# DATA FLOW — vh-website
# AGENT: AGENT-FLOW
# CROSS-REFS: ARCHITECTURE.md, API_CONTRACTS.md, FAILURE_MAP.md

## MASTER DATA FLOWS

### [FLOW-AUTH] → Google OAuth → NextAuth → JWT → Session
source: Google OAuth 2.0 (external)
transforms:
  1. Google credential exchange (clientId/clientSecret)
  2. Email authorization check via isEmailAuthorized(email) → db-access-control.ts
  3. JWT token creation with role/permissions/accessTypes
  4. Session enhancement with user metadata
sinks:
  - NextAuth session object (per-request, memory)
  - JWT token (HTTP-only secure cookie, client)
state_owner: NextAuth + db-access-control cache
side_effects:
  - emailCache Map<string, {user, timestamp}> (60s TTL)
  - DB query on cache miss → User.findOne()
  - console.log on auth events

Session shape after auth:
```typescript
session.user = {
  email: string        // normalized lowercase
  name: string
  role: 'super_admin' | 'admin' | 'student'
  isAdmin: boolean     // computed
  permissions: string[]
  studentId?: string   // 6-digit IBA or 7-digit FBS ID
  roleNumbers?: string[]
  accessTypes: { IBA: boolean, FBS: boolean }
  mockAccess: { duIba: boolean, bupIba: boolean, duFbs: boolean, bupFbs: boolean, fbsDetailed: boolean }
  class?: string
  batch?: string
}
```

Flow:
```
Google OAuth → signIn callback → isEmailAuthorized() →
  [Admins: access-control.json | Students: MongoDB User model] →
  jwt callback → Enhanced JWT →
  session callback → Enhanced Session
```

Failure path: unauthorized email → false returned → redirect to /auth/error

---

### [FLOW-REGISTRATION] → Form → Validation → MongoDB + Email
source: /src/app/registration/page.tsx (multi-step client form)
transforms:
  1. Step 1: name, email, phone (client validation)
  2. Step 2: educationType (hsc|alevels) + year info
  3. Step 3: programMode (mocks|full) + pricing calculation
  4. Serialize to JSON → POST /api/registrations
  5. Server: validate all fields, normalize email to lowercase
  6. MongoDB: create Registration document
  7. Async: sendRegistrationNotification() → Resend API → admin emails
sinks:
  - MongoDB Registration collection
  - Resend email (fire-and-forget, async)
state_owner: MongoDB (authoritative), Resend (notification side-channel)
side_effects:
  - Registration saved even if email fails
  - Admin notification: ahnaf816@gmail.com, hasanxsarower@gmail.com, ahnafahad16@gmail.com (HARDCODED in email.ts)

Validation:
- name, email, phone: required + trimmed
- email: must contain '@'
- educationType: enum hsc|alevels
- programMode: enum mocks|full
- if mocks: selectedMocks non-empty + mockIntent required
- if full: selectedFullCourses non-empty

Response: {success, registrationId}

---

### [FLOW-VOCAB-QUIZ] → AI Generation → Gameplay → Score → Leaderboard
source: /src/app/games/vocab-quiz/page.tsx (client component, requires auth)

Substep A — Question Generation:
  POST /api/generate-questions
  payload: {prompt, type}
  external: Google Gemini 2.5 Flash Lite API (server-side only)
  env: GOOGLE_GEMINI_API_KEY
  output: structured Question[] array

Substep B — Gameplay (client state):
```typescript
{
  sentence: string
  wordBank: string[]
  correctAnswer: string
  difficulty: string
}
```
  state_owner: React useState (ephemeral, per session)

Substep C — Score Submission:
  POST /api/vocab-quiz/scores
  payload: {questionsAnswered, questionsCorrect, totalSections, selectedSections, difficulty}
  sink: VocabScore MongoDB document
  side_effect: isAdmin boolean computed + stored with score

Substep D — Leaderboard:
  GET /api/vocab-quiz/leaderboard
  aggregation:
    $match: {isAdmin: {$ne: true}}
    $group by playerEmail: sum questionsAnswered (rank key), count games, avg accuracy
    $sort: totalQuestionsAnswered DESC
    $limit: 10
  cache: none (fresh each fetch)

Schema: VocabScore
```
playerEmail(indexed), playerName, questionsAnswered, questionsCorrect,
totalSections, selectedSections[], difficulty, playedAt(indexed), isAdmin
```

---

### [FLOW-MENTAL-MATH] → Client Game → Score → Dual Leaderboard
source: /src/app/games/mental-math/page.tsx (client component)

Question generation: CLIENT-SIDE (no AI, pure JS math)
Game state: React useState
  {selectedOperations, difficulty, timeLimit, gameState, currentQuestion, score, questionsAnswered}

Score Submission:
  POST /api/mental-math/scores
  payload: {score, questionsCorrect, questionsAnswered, accuracy, difficulty, operations[], timeLimit}
  sink: MathScore MongoDB document

Dual Leaderboard (GET /api/mental-math/leaderboard):
  1. Individual top games (top 10 best games, sort by score DESC)
  2. Accumulated scores (top 20 players, group by email, sum all scores)

Schema: MathScore
```
playerEmail(indexed), playerName, score, questionsCorrect, questionsAnswered,
accuracy, difficulty, operations[], timeLimit, playedAt(indexed), isAdmin
```

---

### [FLOW-ACCOUNTING] → JSON Questions → Mastery-Aware Selection → Score + Progress
source: /src/app/games/fbs-accounting/page.tsx (client, requires FBS access)

Access Gate: user.accessTypes.FBS === true OR isAdmin → else 403 FBS_ACCESS_REQUIRED

Substep A — Question Loading:
  data: /public/data/accounting-questions.json (static file)
  cache: In-memory JS object in accounting-utils.ts (getAccountingQuestions())
  cache_ttl: Application runtime (reset on restart)
  structure: {lectures[12], totalQuestions: 281}

Substep B — Mastery-Aware Selection (getQuestionsByLectures()):
  1. Fetch AccountingProgress for user → GET /api/accounting/progress
  2. Build unmastered question pool from selected lectures
  3. Always deliver exactly 16 questions
  4. Prioritize unmastered → backfill with mastered if needed
  5. Final shuffle

Substep C — Gameplay (client state):
```typescript
gameState: 'setup' | 'playing' | 'finished' | 'leaderboard'
questions: AccountingQuestion[16]
userAnswers: (string | null)[]   // null = skipped
questionTimes: number[]          // seconds per question
```

Substep D — Score Calculation (dual system):
```
Simple: +1.0 correct, -0.25 wrong, 0 skip → max(0, sum)

Dynamic: simpleScore + speedBonus + lectureCoverageBonus
  speedBonus per correct question:
    <5s:  +0.5
    5-10s: +0.3
    10-15s: +0.15
    15-20s: +0.05
    >20s: 0
  lectureCoverageBonus: 0.1 × numLectures (max 1.2 for all 12)
```

Substep E — Score + Mastery Submission (POST /api/accounting/scores):
  payload: {simpleScore, dynamicScore, totalSpeedBonus, lectureCoverageBonus,
            questionsAnswered:16, correctAnswers, wrongAnswers, skippedAnswers,
            accuracy, selectedLectures[], timeTaken, questionResults[]}
  sinks:
    - AccountingScore document (one per game)
    - AccountingProgress document (upsert, cumulative mastery)
  side_effects:
    - updateQuestionMastery() async (non-blocking, catch logged)
    - Admin scores: NOT saved (response: {success:true, isAdmin:true, scoreId:'admin-not-saved'})

Mastery Update Logic:
  1. Fetch/create AccountingProgress (findOneAndUpdate upsert)
  2. Add correct question IDs to masteredQuestions Set
  3. Update per-lecture: masteredCount, completionCount, lastPlayed
  4. Update totalMastered = masteredQuestions.size
  5. Save

Schema: AccountingScore
```
playerEmail(indexed), playerName, simpleScore, dynamicScore(indexed), totalSpeedBonus,
lectureCoverageBonus, questionsAnswered:16, correctAnswers, wrongAnswers, skippedAnswers,
accuracy, selectedLectures[], timeTaken, playedAt(indexed), isAdmin
```

Schema: AccountingProgress (one per user, upsert)
```
playerEmail(unique,indexed), masteredQuestions:Set<string>,
lectureProgress: Map<lectureNum,{totalQuestions,masteredCount,completionCount,lastPlayed}>,
totalMastered, totalQuestions:281, lastUpdated(indexed), createdAt, updatedAt
```

Dual Leaderboard (GET /api/accounting/leaderboard):
  1. Best single game: group by playerEmail → take highest dynamicScore → sort DESC → limit 20
  2. Cumulative: group by playerEmail → sum dynamicScore → sort DESC → limit 20

---

### [FLOW-ACCESS-CONTROL] → access-control.json + MongoDB → Auth Gates
source_1: /access-control.json (admins, filesystem, immutable)
source_2: MongoDB User model (students, dynamic)

Hybrid Strategy:
  Admins → stored in access-control.json (survives DB outage, no bootstrap issues)
  Students → stored in MongoDB User model (dynamic, admin-managed)

Key functions in db-access-control.ts:
  isEmailAuthorized(email) → bool (signIn gate)
  isAdminEmail(email) → bool (API auth gate)
  getUserByEmail(email) → UserObject (full user data)
  getComputedMockAccess(email) → mockAccess object
    logic: duIba = mockAccess.duIba || accessTypes.IBA
  hasMockAccess(email, mockName) → bool (per-mock gate)

Cache:
  emailCache: Map<email, {user, timestamp}>
  TTL: 60 seconds
  Invalidation: clearAccessControlCache() called after admin updates OR TTL expiry

Build-time layer:
  scripts/generate-access-control.js reads access-control.json →
  generates src/lib/generated-access-control.ts →
  used as fallback/fast-path for admin checks

Flow:
```
API Request → check session email →
  emailCache hit → return cached user
  emailCache miss → getAdminFromJson() | User.findOne() →
  write to cache → return user
```

---

### [FLOW-RESULTS] → JSON Files → Student Matcher → Dashboard Charts
source_files:
  /public/data/simple-tests.json
  /public/data/full-tests.json
  /public/data/mock-tests.json
  /public/data/fbs-mock-tests.json
  /public/data/bup-mock-tests.json
  /public/data/students.json
  /public/data/metadata.json

Note: These JSON files come from external process (Google Sheets exports or manual uploads). NOT generated in realtime.

Student Matching (/src/utils/student-matcher.ts):
  findStudentResult(results, studentsMap, email?, studentId?, roleNumbers?)
  Priority:
    1. Direct studentId match
    2. Email reverse-lookup through students.json
    3. roleNumbers[] match (multiple IDs per student)
    4. null fallback (student has no result)

Client fetch pattern (page load):
  Promise.all([
    fetch('/data/simple-tests.json'),
    fetch('/data/full-tests.json'),
    fetch('/data/mock-tests.json'),
    fetch('/api/auth/check-admin'),
    fetch('/api/user/access')
  ])
  → setState
  → Admin: show student selector dropdown
  → Student: show own stats only

Computed stats:
  totalTests, averageScore, rank, recentScore, improvement (delta last 2)

Rendering:
  Recharts: SeriesProgressChart, PerformanceBarChart, PercentileChart,
            ClassDistributionChart, SkillRadarChart, Top5LeaderboardTable

state_owner: React useState (client, ephemeral per page load)
cache: None — fresh fetch on every mount

---

## STATE MANAGEMENT SUMMARY

No Redux/Zustand/MobX. Architecture:

| Layer | Mechanism | Owner | Lifetime |
|-------|-----------|-------|---------|
| Session/Auth | NextAuth + JWT cookie | NextAuth | Per session |
| Game state | React useState | Component | Per game |
| Access control | In-memory Map + DB | db-access-control.ts | 60s TTL |
| Accounting questions | In-memory JS object | accounting-utils.ts | App lifetime |
| Results data | React useState | Page component | Per page load |
| Scores/Users | MongoDB collections | Database | Permanent |

---

## ASYNC FLOWS

Registration email:
  sendRegistrationNotification().catch(console.error)  ← fire-and-forget, never blocks

Mastery update:
  updateQuestionMastery().catch(console.error)  ← fire-and-forget after score save

Leaderboard aggregation:
  await Model.aggregate([...])  ← blocking, client waits

---

## EXTERNAL INTEGRATIONS

| Service | Where | Auth | Failure Mode |
|---------|-------|------|-------------|
| Google OAuth | NextAuth | GOOGLE_CLIENT_ID + SECRET | Redirect to /auth/error |
| Google Gemini | /api/generate-questions | GOOGLE_GEMINI_API_KEY (server) | 500 returned to client |
| Resend | /lib/email.ts | RESEND_API_KEY | Silent fail (logged) |
| MongoDB Atlas | /lib/mongodb.ts | MONGODB_URI | 500 on all DB ops |
| Vercel Analytics | layout.tsx | Auto | Silent fail (client-side) |

---

## LATENCY ESTIMATES

| Flow | P50 | P95 | Bottleneck |
|------|-----|-----|-----------|
| Auth | <200ms | <500ms | DB lookup on cache miss |
| Registration | 1-2s | 3s | Resend API (async) |
| Question generation | 2-5s | 10s | Gemini API |
| Score submit | <300ms | <1s | MongoDB write |
| Leaderboard | <300ms | <1s | Aggregation pipeline |
| Results dashboard | 2-3s | 5s | Multiple JSON fetches |
