# ARCHITECTURE — vh-website
# AGENT: AGENT-ARCH
# CROSS-REFS: DATA_FLOW.md, API_CONTRACTS.md, CONNECTIONS.md

## EXECUTIVE SUMMARY
vh-website is a Next.js 15 (App Router) full-stack application for IBA/BUP admission program management and game-based learning. Dual-layer hybrid access control: static build-time (access-control.json) for admins + dynamic runtime (MongoDB) for students. Google OAuth + NextAuth, 3 educational games, admin panel, results analytics.

---

## LAYER MAP

```
[Presentation]    Pages, Client Components, Charts (React 19 + Tailwind v4)
      ↓
[API Layer]       Next.js Route Handlers (src/app/api/**)
      ↓
[Business Logic]  auth.ts, db-access-control.ts, accounting-utils.ts, api-utils.ts, email.ts
      ↓
[Data Layer]      MongoDB + Mongoose (6 models) + Static JSON (/public/data/)
```

---

## PAGES

[HOME_PAGE] → type:Marketing | file:src/app/page.tsx
  role: Landing/hero, university info, course details, instructor profiles, CTAs
  deps: lucide-react, next/link

[AUTH_SIGNIN_PAGE] → type:Auth | file:src/app/auth/signin/page.tsx
  role: Google OAuth entry point (delegates to NextAuth)

[AUTH_ERROR_PAGE] → type:Error | file:src/app/auth/error/page.tsx
  role: Auth failure display

[REGISTRATION_PAGE] → type:Multi-step Form | file:src/app/registration/page.tsx
  role: 4-step student self-registration (personal → education → program → pricing)
  deps: React useState, POST /api/registrations
  prices: DU IBA 3000, BUP IBA 2200, DU FBS 2500, BUP FBS 2000, FBS Detailed 6500 BDT

[ELIGIBILITY_CHECKER_PAGE] → type:Tool | file:src/app/eligibility-checker/page.tsx
  role: Interactive form to check university program eligibility
  deps: session required

[DU_FBS_COURSE_PAGE] → type:Content | file:src/app/du-fbs-course/page.tsx
  role: DU FBS course info, lecture structure

[MOCK_EXAMS_PAGE] → type:Protected | file:src/app/mock-exams/page.tsx
  role: Mock exam listing with access gates (IBA/FBS accessTypes)

[GAMES_VOCAB_QUIZ_PAGE] → type:Game | file:src/app/games/vocab-quiz/page.tsx
  role: Vocabulary quiz game
  deps: session, POST /api/vocab-quiz/scores, GET /api/vocab-quiz/leaderboard

[GAMES_MENTAL_MATH_PAGE] → type:Game | file:src/app/games/mental-math/page.tsx
  role: Math trainer, adaptive difficulty, time pressure
  deps: session, POST /api/mental-math/scores, GET /api/mental-math/leaderboard

[GAMES_FBS_ACCOUNTING_PAGE] → type:Complex Game | file:src/app/games/fbs-accounting/page.tsx
  role: 16-question FBS accounting game with dual scoring + mastery tracking
  deps: FBS access required, accounting-utils.ts, GET /api/accounting/progress, POST /api/accounting/scores

[RESULTS_PAGE] → type:Dashboard | file:src/app/results/page.tsx
  role: Student results + analytics + game leaderboards
  deps: session, all leaderboard endpoints, /api/auth/check-admin, /api/user/access

[RESULTS_ADMIN_PAGE] → type:Admin Dashboard | file:src/app/results/admin/page.tsx
  role: Class-wide analytics; admin-only

[RESULTS_TEST_PAGE] → type:Dynamic | file:src/app/results/test/[testName]/page.tsx
  role: Per-test detailed analysis; dynamic route

[ADMIN_REGISTRATIONS_PAGE] → type:Admin Panel | file:src/app/admin/registrations/page.tsx
  role: Registration management CRUD; admin-only

[ADMIN_USERS_PAGE] → type:Admin Panel | file:src/app/admin/users/page.tsx
  role: User management, role/access control; admin-only

[MOCKRESULTS_PAGE] → file:src/app/mockresults/page.tsx (dev helper)
[MOCKSAMPLE_PAGE] → file:src/app/mocksample/page.tsx (dev helper)

---

## SHARED COMPONENTS

[HEADER] → file:src/components/Header.tsx
  role: Top nav (responsive, sticky, role-based link visibility)
  consumes: useSession(), GET /api/auth/check-admin

[FOOTER] → file:src/components/Footer.tsx
  role: Static footer with links + branding

[AUTH_PROVIDER] → file:src/components/AuthProvider.tsx
  role: NextAuth SessionProvider wrapper (wraps entire app in layout.tsx)

[PROTECTED_ROUTE] → file:src/components/ProtectedRoute.tsx
  role: Client-side auth guard, redirects to login if no session

[LOGIN_BUTTON] → file:src/components/LoginButton.tsx
  role: Sign In / Sign Out button using next-auth/react signIn/signOut

[ELIGIBILITY_CHECKER] → file:src/components/EligibilityChecker.tsx
  role: Reusable eligibility evaluation form

[THRESHOLD_RESULT_CARD] → file:src/components/ThresholdResultCard.tsx
  role: Card showing pass/fail relative to thresholds, conditional styling

## RESULT CHART COMPONENTS (src/app/results/components/)
[SKILL_RADAR_CHART]       SkillRadarChart.tsx        — radar chart (Math/English/Analytical)
[PERCENTILE_CHART]        PercentileChart.tsx         — percentile position
[CLASS_DISTRIBUTION_CHART] ClassDistributionChart.tsx — score histogram
[PERFORMANCE_BAR_CHART]   PerformanceBarChart.tsx     — score trends over time
[SERIES_PROGRESS_CHART]   SeriesProgressChart.tsx     — cumulative game progress
[TOP5_LEADERBOARD_TABLE]  Top5LeaderboardTable.tsx    — top 5 players

---

## API ROUTE GROUPS

### Auth
[AUTH_NEXTAUTH] → /api/auth/[...nextauth] | GET,POST | NextAuth handler, Google OAuth
[AUTH_CHECK_ADMIN] → /api/auth/check-admin | GET | returns {isAdmin:bool} | session required

### Admin
[ADMIN_DEBUG] → /api/admin/debug | GET | system diagnostics | session required
[ADMIN_GRANT_ACCESS] → /api/admin/grant-access | POST/GET/PATCH | student enrollment | admin
[ADMIN_SYNC_ADMINS] → /api/admin/sync-admins | POST | sync JSON admins → DB | session required
[ADMIN_SYNC_ROLE_NUMBERS] → /api/admin/sync-role-numbers | POST | migrate IDs | admin
[ADMIN_USERS] → /api/admin/users | GET/POST/PATCH/DELETE | full user CRUD | admin/super_admin
[ADMIN_STUDENTS] → /api/admin/students | ? | student-specific management

### Games
[VOCAB_SCORES] → /api/vocab-quiz/scores | POST | save score | auth
[VOCAB_LEADERBOARD] → /api/vocab-quiz/leaderboard | GET | top 10 | auth
[MATH_SCORES] → /api/mental-math/scores | POST | save score | auth
[MATH_LEADERBOARD] → /api/mental-math/leaderboard | GET | dual top 10/20 | auth
[ACCT_SCORES] → /api/accounting/scores | POST | save score + mastery | FBS access
[ACCT_LEADERBOARD] → /api/accounting/leaderboard | GET | dual top 20 | FBS access
[ACCT_PROGRESS] → /api/accounting/progress | GET | mastery data | FBS access

### Registration
[REGISTRATIONS] → /api/registrations | POST public / GET admin
[REGISTRATIONS_ID] → /api/registrations/[id] | GET,PATCH | admin

### User
[USER_ACCESS] → /api/user/access | GET | IBA/FBS/isAdmin flags | session optional

### AI/Content
[GENERATE_QUESTIONS] → /api/generate-questions | POST | Gemini AI question gen | auth

### Utility
[HEALTH] → /api/health | GET | env+DB+auth status | public
[INIT_ADMIN] → /api/init-admin | POST | one-time super_admin bootstrap | secret
[ADD_FBS_STUDENTS] → /api/add-fbs-students | POST | bulk FBS enrollment | admin
[MIGRATE_STUDENTS] → /api/migrate-students | POST | JSON→DB migration | super_admin

---

## LIBRARY MODULES

[LIB_AUTH] → src/lib/auth.ts
  type: NextAuth config | role: Security backbone
  exports: authOptions: NextAuthOptions
  providers: GoogleProvider (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
  callbacks:
    signIn: validates via isEmailAuthorized()
    jwt: stores role/permissions/studentId/accessTypes/mockAccess in token
    session: enriches session from JWT
  CRITICAL: This file is the single source of auth policy. Touch with extreme care.

[LIB_MONGODB] → src/lib/mongodb.ts
  type: Raw MongoClient singleton
  exports: clientPromise: Promise<MongoClient>
  note: Legacy; prefer Mongoose via db.ts for new code

[LIB_DB] → src/lib/db.ts
  type: Mongoose connection manager
  exports: connectToDatabase(), isConnected(), disconnectDatabase()
  config: maxPoolSize:1, selectionTimeout:5s, socketTimeout:45s (serverless optimized)
  behavior: reuse existing connection if readyState==1

[LIB_DB_ACCESS_CONTROL] → src/lib/db-access-control.ts
  type: Hybrid access decision engine | CRITICAL: all auth gates flow through here
  architecture: JSON admins (fast, no DB) + MongoDB students (dynamic)
  cache: emailCache Map<email,{user,timestamp}> TTL=60s
  exports:
    isEmailAuthorized(email): bool  ← signIn gate
    isAdminEmail(email): bool  ← API auth gate
    getUserByEmail(email)  ← full user object
    getComputedMockAccess(email)  ← ORed accessTypes+mockAccess
    hasMockAccess(email, mockName): bool
    clearAccessControlCache()  ← call after admin updates

  computed mock access logic:
    duIba  = mockAccess.duIba  || accessTypes.IBA
    bupIba = mockAccess.bupIba || accessTypes.IBA
    duFbs  = mockAccess.duFbs  || accessTypes.FBS
    bupFbs = mockAccess.bupFbs || accessTypes.FBS
    fbsDetailed = mockAccess.fbsDetailed  (individual only)

[LIB_API_UTILS] → src/lib/api-utils.ts
  exports:
    ApiException(message, status, code)  ← custom error
    createErrorResponse(error): NextResponse
    validateAuth(): Promise<{email,name}>  ← throws on fail
    validateEnvironment()  ← checks MONGODB_URI, NEXTAUTH_SECRET
    safeApiHandler(handler)  ← wraps with env validation + error handling

[LIB_EMAIL] → src/lib/email.ts
  service: Resend (RESEND_API_KEY env var)
  exports: sendRegistrationNotification(data: RegistrationEmailData)
  recipients: HARDCODED — ahnaf816@gmail.com, hasanxsarower@gmail.com, ahnafahad16@gmail.com
  behavior: sends HTML+text to all 3, returns {success, successful, failed, total}
  WARNING: changing admin emails requires code change + redeploy

[LIB_ACCOUNTING_UTILS] → src/lib/accounting-utils.ts
  exports:
    getAccountingQuestions(): LectureData[]  ← JSON cache (app lifetime)
    getQuestionsByLectures(lectures, selected, masteredIds)  ← 16-Q mastery-aware selection
    calculateSpeedBonus(timeTaken, isCorrect): number
    calculateLectureCoverageBonus(count): number  ← 0.1 per lecture, max 1.2
    calculateSimpleScore(questions, answers)  ← +1/-0.25 scoring
    calculateDynamicScore(questionResults, lectureCount)  ← simple + bonuses
    updateQuestionMastery(email, results, lectures)  ← updates AccountingProgress
    saveScore(results): bool  ← POST to /api/accounting/scores
    fetchLeaderboard()  ← GET /api/accounting/leaderboard

---

## MONGOOSE MODELS

[USER] → src/lib/models/User.ts | collection: users
  key fields: email(unique,idx), name, role(super_admin|admin|student)
  student fields: studentId(sparse,unique,6-7dig), roleNumbers[], class, batch
  access fields:
    accessTypes: {IBA:bool, FBS:bool}  ← broad access
    mockAccess: {duIba,bupIba,duFbs,bupFbs,fbsDetailed:bool}  ← fine-grained
  indexes: {email,active}, {studentId} sparse, {adminId} sparse, {role,active}
  virtual: computedMockAccess  ← ORed access result
  method: hasMockAccess(mockName)

[REGISTRATION] → src/lib/models/Registration.ts | collection: registrations
  key fields: name,email(idx),phone, educationType(hsc|alevels),
              programMode(mocks|full), status(pending|contacted|enrolled|cancelled)
  mocks fields: selectedMocks[], mockIntent(trial|full), pricing{subtotal,discount,finalPrice}
  full fields: selectedFullCourses[]
  optional: referral{name,institution,batch}, years, notes
  indexes: {createdAt:-1,status}, {email,createdAt:-1}, {programMode,status}

[MATH_SCORE] → src/lib/models/MathScore.ts | collection: mathscores
  key fields: playerEmail(idx), score(idx:-1), difficulty(easy|medium|hard|extreme)
  game fields: questionsCorrect, questionsAnswered, accuracy(0-100), operations[], timeLimit
  indexes: {score:-1,playedAt:-1}, {playerEmail,score:-1}, {isAdmin,score:-1}

[VOCAB_SCORE] → src/lib/models/VocabScore.ts | collection: vocabscores
  key fields: playerEmail(idx), questionsAnswered(idx:-1), difficulty, selectedSections[]
  indexes: {questionsAnswered:-1,playedAt:-1}, {playerEmail,questionsAnswered:-1}

[ACCOUNTING_SCORE] → src/lib/models/AccountingScore.ts | collection: accountingscores
  key fields: playerEmail(required,idx), dynamicScore(idx:-1), simpleScore
  scoring: totalSpeedBonus, lectureCoverageBonus, correctAnswers, wrongAnswers, skippedAnswers
  game fields: selectedLectures[], timeTaken, accuracy, questionsAnswered:16
  indexes: {dynamicScore:-1,playedAt:-1}, {playerEmail,dynamicScore:-1}, {selectedLectures}

[ACCOUNTING_PROGRESS] → src/lib/models/AccountingProgress.ts | collection: accountingprogresses
  purpose: per-student cumulative mastery tracking (drives adaptive difficulty)
  key fields: playerEmail(unique,idx), masteredQuestions:Set<questionId>
  per-lecture: lectureProgress Map<lectureNum,{totalQuestions,masteredCount,completionCount,lastPlayed}>
  aggregates: totalMastered(0-281), totalQuestions:281(immutable)
  serialization: Set→Array, Map→Object in toJSON
  indexes: {playerEmail} unique, {lastUpdated:-1}, {totalMastered:-1}

---

## ACCESS CONTROL SYSTEM (DUAL-LAYER HYBRID)

```
Layer 1: Build-Time Static
  Source: access-control.json (root)
  Generated: src/lib/generated-access-control.ts (build artifact)
  Contains: admins[] with {id,name,email,role,permissions,active}
  Generation: scripts/generate-access-control.js
  Purpose: fast admin lookup without DB round-trip at auth time

Layer 2: Runtime Dynamic
  Source: MongoDB users collection
  Purpose: student CRUD without redeploy
  Admin fallback: if admin not in JSON, checked in DB as backup

Hybrid Check Flow (db-access-control.ts):
  normalize(email) → cache check →
  [cache miss] getAdminFromJson() | User.findOne() →
  write to cache → return user object
```

Role hierarchy: super_admin > admin > student

---

## GAMES SUBSYSTEM

```
Game 1: Vocab Quiz
  route: /games/vocab-quiz
  questions: AI-generated via Gemini API (POST /api/generate-questions)
  scoring: questionsCorrect / questionsAnswered
  leaderboard: top 10 by questionsAnswered
  access: all authenticated students

Game 2: Mental Math Trainer
  route: /games/mental-math
  questions: client-side JS generation (no AI)
  scoring: points per correct answer + speed factor
  leaderboard: dual (top 10 best games, top 20 accumulated)
  difficulty: easy|medium|hard|extreme
  access: all authenticated students

Game 3: FBS Accounting (most complex)
  route: /games/fbs-accounting
  questions: /public/data/accounting-questions.json (281 Q, 12 lectures)
  scoring: dual (simple +1/-0.25 + dynamic with speed/lecture bonuses)
  mastery: AccountingProgress tracks per-question mastery
  adaptive: unmastered questions prioritized in selection (16 per game)
  leaderboard: dual (top 20 best game, top 20 accumulated)
  access: FBS accessType required OR admin
```

---

## BUILD PIPELINE

```
Step 1: npm run generate:access-control
  script: scripts/generate-access-control.js
  input: access-control.json
  output: src/lib/generated-access-control.ts (TypeScript constants)
  purpose: bake admin list into bundle, avoid runtime file I/O

Step 2: npm run parse-accounting (prebuild)
  script: scripts/parse-accounting-questions.js
  output: /public/data/accounting-questions.json
  purpose: process raw accounting question source into game-ready JSON

Step 3: next build
  output: .next/ (standalone + Vercel optimized)
```

---

## EXTERNAL INTEGRATIONS

| Service | Purpose | Auth | Env Var |
|---------|---------|------|---------|
| Google OAuth | Sign-in | clientId+Secret | GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET |
| Google Gemini | Quiz questions | API key | GOOGLE_GEMINI_API_KEY |
| Resend | Admin emails | API key | RESEND_API_KEY |
| MongoDB Atlas | Database | URI | MONGODB_URI |
| Vercel Analytics | Usage tracking | Auto | None (NEXT_PUBLIC auto) |

---

## DEPLOYMENT

- Platform: Vercel (Node.js serverless)
- File system: READ-ONLY at runtime (critical: cannot write files in production)
- Serverless constraints: maxPoolSize:1, stateless, cold-start aware
- Build runs: generate:access-control + parse-accounting before next build
- Required env vars: MONGODB_URI, NEXTAUTH_SECRET, NEXTAUTH_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

---

## KNOWN TECH DEBT / CONSTRAINTS

1. File system writes in /api/admin/grant-access disabled in production (Vercel read-only)
2. Admin emails hardcoded in email.ts (requires deploy to change)
3. students.json sync disabled in production (same reason)
4. Access control JSON loaded at startup; restart needed for new JSON admins
5. Accounting question count hardcoded as 281
6. No rate limiting anywhere
7. No CSRF protection on state-changing APIs
