# DEEP DIVES — vh-website
# AGENT: AGENT-DEEP
# CROSS-REFS: ARCHITECTURE.md, DATA_FLOW.md, FAILURE_MAP.md

## OVERVIEW
5 most complex/critical files. Line-by-line analysis. Written for an agent with zero context.

---

## DIVE 1: src/lib/auth.ts (Security Backbone)

**Why critical:** Every authenticated request starts here. Wrong behavior = everyone locked out or unauthorized access.

### signIn Callback (Lines ~13-27)
```typescript
async signIn({ user, account }) {
  if (account?.provider === 'google') {
    const email = user.email?.toLowerCase() || ''
    const isAuthorized = await isEmailAuthorized(email)
    return isAuthorized  // TRUE = allow, FALSE = deny
  }
  return false  // Non-Google providers always rejected
}
```

NON-OBVIOUS:
- `user.email?.toLowerCase() || ''` — if email undefined, passes empty string to isEmailAuthorized (which returns false — safe)
- The callback returns `false` silently on rejection; user just gets generic error page
- **No try-catch** — if isEmailAuthorized throws (DB down), the callback crashes → ALL sign-ins fail
- This runs on every sign-in attempt; DB down = 100% login outage

### jwt Callback (Lines ~58-84)
```typescript
async jwt({ token, user }) {
  if (user?.email) {  // ← This condition is only true on FIRST login
    const userInfo = await getUserByEmail(user.email)
    token.role = userInfo.role
    token.permissions = userInfo.permissions
    // ... more fields
  }
  return token
}
```

NON-OBVIOUS:
- `if (user?.email)` — `user` is only present on fresh login, not token refresh
- **Token is only populated once (on first login)**; if user's role changes in DB, the JWT is stale until they log out and back in
- No way to force token refresh without user action
- Role stored in JWT = can be >24h stale if session is long-lived

### session Callback (Lines ~28-56)
```typescript
async session({ session }) {
  if (session.user?.email) {
    const userInfo = await getUserByEmail(session.user.email)
    if (userInfo) {
      session.user.role = userInfo.role  // mutates session object directly
      session.user.isAdmin = await isAdminEmail(session.user.email)
      // ...
    }
  }
  return session
}
```

NON-OBVIOUS:
- Runs on EVERY request that reads session (not just login)
- Makes fresh DB call every time (but db-access-control.ts caches for 60s, so actually fast)
- If getUserByEmail() throws, session callback fails = user effectively logged out
- Duck-typing: `'studentId' in userInfo` to detect student vs admin (fragile if schema changes)
- **Two DB calls for admins**: isEmailAuthorized (in signIn) + isAdminEmail (in session callback) = redundant

### State Machine
```
Google OAuth callback
    ↓
signIn: isEmailAuthorized()
    ├─ false → /auth/error
    └─ true
        ↓
jwt: getUserByEmail() → populate token (ONCE, first login)
        ↓
session: getUserByEmail() → enrich session object (EVERY request, cached 60s)
        ↓
request proceeds with enriched session.user
```

### What to know before touching auth.ts:
1. No error handling in callbacks — add try-catch before changing anything
2. JWT is stale after first login; role changes require re-login
3. isAdminEmail is called redundantly (session callback + elsewhere)
4. Email normalization (.toLowerCase()) must never be removed
5. Dependencies: db-access-control.ts must be reliable for auth to work

---

## DIVE 2: src/lib/db-access-control.ts (Authorization Engine)

**Why critical:** Every API auth check flows through here. This determines who can do what.

### Module-Level Init (Lines ~1-36)
```javascript
let adminsFromJson: any[] = [];
try {
  const jsonPath = path.join(process.cwd(), 'access-control.json');
  if (fs.existsSync(jsonPath)) {
    const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    adminsFromJson = jsonData.admins || [];
  }
} catch (error) {
  console.error('[Access Control] Failed to load admins from JSON:', error);
  // continues silently
}
```

NON-OBVIOUS:
- **Runs synchronously at module load time** (server startup, not per-request)
- If file missing in production: warning logged, admins array is empty, all admins fall back to DB lookup
- If file is malformed JSON: error caught, admins array empty, silent fallback
- **In Vercel: process.cwd() resolves to /var/task (build dir)** — access-control.json must be in build artifact or this fails silently
- adminsFromJson is shared across ALL requests (module singleton)
- Only reload: server restart / redeploy

### getCachedUser — The Core (Lines ~59-105)
```typescript
async function getCachedUser(email: string): Promise<any | null> {
  // 1. Cache check (60s TTL)
  const cached = emailCache.get(normalizedEmail);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.user;
  }

  // 2. JSON admins first (O(n) linear scan)
  const adminFromJson = getAdminFromJson(normalizedEmail);
  if (adminFromJson) {
    emailCache.set(normalizedEmail, { user: adminUser, timestamp: Date.now() });
    return adminUser;
  }

  // 3. DB query for students
  const user = await User.findOne({ email: normalizedEmail, active: true }).lean();
  if (user) {
    emailCache.set(normalizedEmail, { user, timestamp: Date.now() });
  }
  return user;
}
```

NON-OBVIOUS:
- **Priority: cache > JSON > DB** — if in JSON, DB is never queried
- If email in both JSON (admin) AND DB (student somehow), JSON admin wins → student gets admin access (privilege escalation risk)
- Cache miss for non-existent users: DB is queried every time (no negative caching)
- JSON admin object is reconstructed (only email,name,role,permissions,active) — loses any other fields
- DB admin object is .lean() result (full object including mockAccess, accessTypes, etc)
- **Asymmetry**: JSON admins don't have accessTypes/mockAccess in cache; DB admins do

### hasMockAccess — Skips Cache (Lines ~300-337)
```typescript
export async function hasMockAccess(email: string, mockName: string): Promise<boolean> {
  await connectToDatabase();
  const user = await User.findOne({ email: email.toLowerCase(), active: true });
  // ... switch statement for mock type
}
```

NON-OBVIOUS:
- **Does NOT use emailCache** — fresh DB query every time
- Called when checking per-mock access (results pages etc.)
- Performance: if called 10x per page load = 10 DB queries
- Mock name normalization: "DU IBA" → "duiba" (removes hyphens and spaces, lowercases)
- Default case: returns false (safe)
- Admins get all mocks (role check before student check)

### Access Logic (Computed Mock Access)
```
duIba  = mockAccess.duIba  || accessTypes.IBA
bupIba = mockAccess.bupIba || accessTypes.IBA
duFbs  = mockAccess.duFbs  || accessTypes.FBS
bupFbs = mockAccess.bupFbs || accessTypes.FBS
fbsDetailed = mockAccess.fbsDetailed  // ONLY individual control; no group
```

NON-OBVIOUS:
- IBA access type grants BOTH duIba AND bupIba
- FBS access type grants BOTH duFbs AND bupFbs
- fbsDetailed has NO group grant — must be set individually
- Admins: all mocks = true (bypasses all checks)

### What to know before touching db-access-control.ts:
1. clearAccessControlCache() MUST be called after any user update in admin panel
2. hasMockAccess is uncached — consider memoizing if called frequently
3. The 60s TTL is a performance/consistency tradeoff; changing it is safe but affects stale-data window
4. JSON admin fields are explicitly mapped (not spread) — adding new fields to access-control.json requires code change here
5. Verbose logging is intentional (debug aid) — don't remove

---

## DIVE 3: src/app/api/generate-questions/route.ts (Gemini Integration)

**Why critical:** AI integration point; handles API keys server-side; security and cost concerns.

### Auth Chain (Lines ~15-54)
```typescript
// Two checks: session + email authorized
const session = await getServerSession(authOptions);
if (!session?.user?.email) return 401;

const isAuthorized = await isEmailAuthorized(session.user.email.toLowerCase());
if (!isAuthorized) return 403;

// Prompt validation
const { prompt, type } = await request.json();
if (!prompt) return 400;

// API key check
const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
if (!apiKey) return 500 (user-friendly message, not key exposure);
```

NON-OBVIOUS:
- Double auth check (session + isEmailAuthorized) = defense in depth
- `type` from request body is captured but never used (dead code)
- If request.json() throws (malformed body), outer try-catch returns 500

### Gemini API Call (Lines ~56-86)
```typescript
const geminiResponse = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
  {
    method: 'POST',
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
  }
);
```

NON-OBVIOUS:
- **API key is in URL query parameter** — standard for Gemini REST API, but URL appears in server logs on failure
- **Model hard-coded**: `gemini-2.5-flash-lite` — no fallback, no config
- **No timeout** — if Gemini hangs, request hangs indefinitely
- **No retry** — single attempt; transient failure = user error
- **No streaming** — full response buffered before sending
- **Prompt passed as-is** — no sanitization, prompt injection possible
- **No token counting** — runaway costs possible

Error propagation:
- If Gemini returns 429 (rate limit), client gets 429 (good for backoff)
- If Gemini returns 400, client gets 400 (reveals API issue)
- `errorText` is logged but not returned to user (good)
- **Successful response returned raw** — no validation of Gemini response structure

### What to know before touching generate-questions:
1. API key MUST NOT appear in client-facing code (stays server-only)
2. Add timeout before deploying to production use
3. Add rate limiting per user to control costs
4. Prompt injection is real — consider system prompt injection prevention
5. The `type` parameter is unused; was likely intended for different question types

---

## DIVE 4: src/app/games/fbs-accounting/page.tsx (Complex Game Component, ~1000 lines)

**Why critical:** Most complex UI component. State machine with 20+ useState hooks. Timer, dual scoring, mastery tracking.

### State Machine
```
'setup' → 'playing' → 'finished'
              ↑                 ↓
         (new game)       'leaderboard'
```

### FBS Access Check Pattern (Lines ~82-106)
Three-state boolean pattern:
```typescript
const [hasFBSAccess, setHasFBSAccess] = useState<boolean | null>(null);
// null = checking, true = has access, false = no access
```

NON-OBVIOUS:
- null is initial state — shows "checking access" UI while API loads
- If /api/user/access fails, hasFBSAccess is set to false (deny = safe)
- Depends on two response fields: `data.hasFBS` and `data.accessTypes?.FBS` (checks both)
- Admin bypass: if isAdmin, FBS access granted regardless

### Timer Architecture (Lines ~154-168)
```typescript
useEffect(() => {
  if (gameState !== 'playing') {
    setCurrentQuestionElapsed(0);
    return;
  }
  const timer = setInterval(() => {
    setCurrentQuestionElapsed(Math.floor((Date.now() - questionStartTime) / 1000));
  }, 1000);
  return () => clearInterval(timer);
}, [gameState, questionStartTime]);
```

NON-OBVIOUS:
- Re-creates interval when questionStartTime changes (new question = new timer)
- setCurrentQuestionElapsed is display-only; actual time tracked in questionTimes[]
- Cleanup is correct (clears on unmount and dep changes)
- Timer causes component re-render every second during play

### Time Tracking Bug
```typescript
const answerQuestion = (answer: string) => {
  const timeTaken = Math.floor((Date.now() - questionStartTime) / 1000);
  // ... saves timeTaken to questionTimes[currentQuestionIndex]
};
```

NON-OBVIOUS:
- **If user changes answer, time is overwritten** with time-of-new-answer
- First answer time is NOT preserved
- This means the LAST click time is what gets scored
- Speed bonus calculation uses this time — changing answer "resets the clock"
- Design intent unclear: is this a bug or a feature?

### startQuiz — Question Selection (Lines ~182-207)
```typescript
const masteredQuestionIds = userProgress?.masteredQuestionIds || [];
const quizQuestions = getQuestionsByLectures(
  allLectures,
  selectedLectures,
  masteredQuestionIds  // from previously loaded AccountingProgress
);
setUserAnswers(new Array(quizQuestions.length).fill(null));  // always 16 nulls
setQuestionTimes(new Array(quizQuestions.length).fill(0));   // always 16 zeros
```

NON-OBVIOUS:
- userAnswers and questionTimes are initialized to same length
- They MUST remain in sync throughout the game (parallel arrays)
- If quizQuestions.length !== 16 (unlikely but possible), scoring assumptions break

### finishQuiz — Auto-Save Pattern (Lines ~246-346)
```typescript
setGameState('finished');       // UI updates immediately (optimistic)
setGameResults(results);        // Show scores without waiting for API

// Then save in background
fetch('/api/accounting/scores', {...})
  .then(async response => {
    if (data.mastery) setMasteryFeedback(data.mastery);
    // Reload progress
    const progressResponse = await fetch('/api/accounting/progress');
    setUserProgress(progressData.progress);
  })
  .catch(error => console.error('Error saving score:', error))
  .finally(() => setIsSavingScore(false));
```

NON-OBVIOUS:
- **Optimistic update**: user sees results immediately even before API responds
- If API fails silently (console.error only), user NEVER knows score wasn't saved
- After save: reloads progress (adds 500-1000ms network round trip)
- Mastery feedback from API is displayed as celebration UI (newly mastered Qs)
- The fetch is NOT awaited — if user navigates away, the fetch may be aborted

### Component Size Problem
- 1000+ lines is too large for a single component
- Mixing: access check logic, data loading, timer, game state, scoring, API calls, UI rendering
- Recommended breakdown: FBSSetupScreen, FBSPlayingScreen, FBSResultsScreen, FBSLeaderboardScreen

### What to know before touching fbs-accounting/page.tsx:
1. The three-value hasFBSAccess (null/true/false) pattern must be preserved
2. userAnswers and questionTimes MUST be parallel (same length, same indexing)
3. Time overwrite on re-answer is known behavior — decide if intended
4. finishQuiz is fire-and-forget API — add error toast if save fails
5. Progress reloaded after save — if /api/accounting/progress is slow, there's a noticeable delay

---

## DIVE 5: src/lib/accounting-utils.ts (Game Engine)

**Why critical:** All scoring logic, mastery tracking, and question selection. Wrong logic = invalid leaderboard.

### getAccountingQuestions — Cache Pattern (Lines ~14-32)
```typescript
let cachedData: AccountingQuestionsData | null = null;

export async function getAccountingQuestions(): Promise<LectureData[]> {
  if (cachedData) return cachedData.lectures;  // module-level cache

  const response = await fetch('/data/accounting-questions.json');
  if (!response.ok) throw new Error('Failed to load accounting questions');

  cachedData = await response.json();
  return cachedData.lectures;
}
```

NON-OBVIOUS:
- **Module-level cache** — shared across all calls within same server instance
- First call loads from disk, all subsequent calls return cached
- **No expiry** — if questions.json changes, server must restart to pick up changes
- If fetch fails, throws error (caller must handle)

### getQuestionsByLectures — Mastery-Aware Selection (Lines ~38-84)
```typescript
const QUESTION_LIMIT = 16;
const unmastered = allQuestions.filter(q => !masteredSet.has(q.id));
const mastered = allQuestions.filter(q => masteredSet.has(q.id));

if (unmastered.length >= QUESTION_LIMIT) {
  selected = shuffledUnmastered.slice(0, QUESTION_LIMIT);  // All unmastered
} else {
  selected = [...shuffledUnmastered, ...shuffledMastered.slice(0, QUESTION_LIMIT - shuffledUnmastered.length)];
}
return shuffleArray(selected);  // Final shuffle to mix unmastered+mastered
```

NON-OBVIOUS:
- **Prioritizes unmastered** — learning-focused, not just random
- Two-stage shuffle: shuffle within groups first, then shuffle combined (to avoid clustering)
- If ALL questions are mastered (completionist), returns mastered questions (no "empty" state)
- 16 is hard-coded — changing it requires updating scoring validation too
- Question IDs must be in masteredSet format exactly (no normalization here)

### calculateSpeedBonus — Tier System (Lines ~102-117)
```
timeTaken < 5s:  +0.5
timeTaken < 10s: +0.3
timeTaken < 15s: +0.15
timeTaken < 20s: +0.05
timeTaken >= 20s: 0
Wrong answer:    always 0 (bonus only for correct)
```

NON-OBVIOUS:
- Hard cutoffs (not linear) — 4.9s = 0.5, 5.0s = 0.3 (cliff edge)
- Maximum per-question speed bonus: 0.5 points
- Maximum total speed bonus (16 correct, all <5s): 8 points
- Wrong answers get ZERO bonus even if answered in 1s (incentivizes accuracy over speed)

### calculateSimpleScore (Lines ~133-173)
```
score = max(0, correct * 1.0 + wrong * -0.25)
```

NON-OBVIOUS:
- **Negative scores floor to 0** (Math.max(0, ...))
- Penalty math: 1 correct = 1 point, 4 wrong = -1 point (so 1 correct + 4 wrong = 0)
- Skipped = 0 points, 0 penalty (safe choice strategy)
- This discourages random guessing (expected value of guessing 5-option = 1/5 - 4*1/5*0.25 = -0.0)

### updateQuestionMastery — Most Complex (Lines ~340-435)

Called server-side from /api/accounting/scores after game ends.

```typescript
// Dynamic import (server-only)
const AccountingProgress = (await import('@/lib/models/AccountingProgress')).default;

// Upsert pattern
let progress = await AccountingProgress.findOne({ playerEmail });
if (!progress) {
  progress = new AccountingProgress({ playerEmail, masteredQuestions: new Set(), ... });
}

// Mastery is "once correct = always mastered" (no forgetting)
correctQuestionIds.forEach(id => progress.masteredQuestions.add(id));

// Lecture completion check
const masteredInLecture = Array.from(progress.masteredQuestions)
  .filter(id => id.startsWith(`lecture${lectureNum}_`))  // ID FORMAT ASSUMPTION
  .length;
const isNowCompleted = masteredInLecture === totalQuestionsInLecture;
```

NON-OBVIOUS:
- **Dynamic import** used to prevent client-side bundling of Mongoose model
- Mastery is permanent — once correct, always mastered (no spaced repetition)
- Lecture completion = 100% of questions mastered (binary state)
- **Critical assumption**: Question IDs follow format `lectureN_qM` — if format changes, mastery tracking breaks silently
- completionCount is high-water mark (increments only when newly completed)
- Progress document is created on first game play (upsert)
- Loops over all lectures that appeared in questionResults — not all selected lectures

### What to know before touching accounting-utils.ts:
1. Question ID format `lectureN_qM` is load-bearing — never change without migration
2. QUESTION_LIMIT = 16 is used in multiple places including API validation — change everywhere
3. calculateDynamicScore recalculates simple score internally (redundant — could optimize)
4. updateQuestionMastery is called non-blocking from API — errors logged but not surfaced
5. The JSON cache never expires — questions change = server restart required

---

## CROSS-FILE INTERACTION MAP

```
USER LOGIN:
  auth.ts.signIn → db-access-control.isEmailAuthorized
                 → db-access-control.getCachedUser
                 → JSON admins OR User.findOne()
  auth.ts.session → db-access-control.getUserByEmail (same path)

FBS GAME PLAY:
  fbs-accounting/page.tsx → /api/user/access (FBS check)
  fbs-accounting/page.tsx → accounting-utils.getAccountingQuestions (load questions)
  fbs-accounting/page.tsx → accounting-utils.getQuestionsByLectures (select 16)
  fbs-accounting/page.tsx → accounting-utils.calculateSimpleScore (scoring)
  fbs-accounting/page.tsx → accounting-utils.calculateDynamicScore (scoring)
  fbs-accounting/page.tsx → POST /api/accounting/scores
    └→ accounting-utils.updateQuestionMastery → AccountingProgress.save()

AI QUESTIONS:
  vocab-quiz/page.tsx → POST /api/generate-questions/route.ts
    └→ auth.ts.authOptions (session check)
    └→ db-access-control.isEmailAuthorized
    └→ Gemini API (external)
```

---

## ERROR HANDLING AUDIT

| File | Pattern | Gaps |
|------|---------|------|
| auth.ts | No try-catch in callbacks | DB failure = login outage |
| db-access-control.ts | catch + return false | Silent; errors hidden from user |
| generate-questions | Outer try-catch returns 500 | No retry, no timeout |
| fbs-accounting page | .catch(console.error) on save | User never sees save failure |
| accounting-utils | throw on load fail | Caller must handle (page does) |
| accounting-utils updateMastery | Calling code catches | Mastery loss is silent |

---

## SECURITY AUDIT (THESE 5 FILES)

| Issue | File | Severity |
|-------|------|---------|
| No try-catch in signIn | auth.ts | 4 — login outage on DB failure |
| JWT stale after login | auth.ts | 2 — role changes need re-login |
| Prompt injection | generate-questions | 3 — user controls Gemini prompt |
| API key in fetch URL | generate-questions | 2 — appears in logs on failure |
| No rate limit | generate-questions | 3 — cost/abuse risk |
| Email in both JSON+DB | db-access-control | 3 — JSON admin wins (privilege esc) |
| hasMockAccess uncached | db-access-control | 2 — N+1 DB queries |
| Time overwrite on re-answer | fbs-accounting page | 1 — scoring inconsistency |
| Optimistic save failure | fbs-accounting page | 2 — user unaware of lost data |
| Question ID format hardcoded | accounting-utils | 2 — silent mastery breakage |
