# AGENT NOTES — vh-website
# AGENT: AGENT-CONNECT (synthesis pass)
# PURPOSE: Anomalies, surprises, gaps, ambiguities, things that didn't fit other schemas.
# READ THIS before making changes to auth, access control, scoring, or admin systems.

---

## SECTION 1: SURPRISING ARCHITECTURAL DECISIONS

### [NOTE-A1] Dual-Layer Hybrid Access Control — Evolved, Not Designed
**Observation:** Admins live in access-control.json (build-time); students live in MongoDB (runtime).
**Why this is surprising:** Two sources of truth for one system is inherently fragile.
**Probable origin:** System started with JSON-only auth. Students were added dynamically later. Admins were never migrated to DB.
**Implication:**
- Adding a new admin requires: edit JSON → run generate:access-control → commit → build → deploy
- Adding a new student requires: POST /api/admin/users (or /api/admin/grant-access) — immediate
- Different latency for the same operation (admin onboarding is ~15 min, student is ~1s)

**For future agents:** When debugging auth failures, check BOTH layers. An admin in DB but not JSON may behave unexpectedly (JSON wins in getCachedUser priority order — RISK_002).

---

### [NOTE-A2] JWT Is Populated Once (First Login) — Role Changes Don't Propagate
**Observation:** auth.ts jwt callback uses `if (user?.email)` which is only truthy on first login.
**Implication:** If an admin is demoted to student in DB, their JWT still says 'admin' until they log out and back in.
**This is a NextAuth design pattern, not a bug** — but it means:
- Role changes take effect on NEXT login
- Access revocation (active:false) takes effect at next session renewal
- There is no immediate forced logout mechanism

**For future agents:** If a user claims "I changed role but my permissions haven't updated," tell them to log out and back in. If immediate revocation is needed, implement JWT revocation (RISK_023).

---

### [NOTE-A3] Accounting Score Accepted at Face Value — By Design or Oversight?
**Observation:** POST /api/accounting/scores accepts client-calculated simpleScore and dynamicScore without server recalculation.
**Why this is dangerous:** Leaderboards are not trustworthy for competitive scenarios. Attacker sends inflated score → accepted.
**Possible intent:** The system is "internal" (students know each other), so gaming the leaderboard has limited value. Trust is assumed within the cohort.
**Problem:** This assumption is never documented. Future agents might assume validation exists when it doesn't.

**For future agents:** If adding competitive features (prizes, public display), MUST add server-side recalculation from questionResults[]. The formula is: `simpleScore = max(0, correct*1.0 + wrong*-0.25)`.

---

### [NOTE-A4] Accounting Questions Cached for App Lifetime — Questions Change = Server Restart Required
**Observation:** `cachedData` in accounting-utils.ts is a module-level singleton with no expiry.
**Implication:** If /public/data/accounting-questions.json is updated (after re-running parse-accounting script), the cached version remains until server restart.
**In Vercel deployments:** Each deploy creates new serverless instances → cache cleared automatically.
**In local dev:** Must restart dev server to see question changes.
**Hidden risk:** During a canary/rolling deployment on Vercel, some instances have old questions, some have new. Questions can differ across requests within the same user session.

**For future agents:** If questions are reported as "wrong" or "old," check if parse-accounting was re-run and if a restart/redeploy occurred.

---

### [NOTE-A5] hasMockAccess() Bypasses the 60-Second Cache
**Observation:** All other access checks use getCachedUser() (cached). hasMockAccess() and getComputedMockAccess() query MongoDB directly every call.
**Why:** These functions need per-mock granularity (mockAccess has 5 sub-fields), and JSON admins don't have mockAccess fields — so the cache is incomplete for this use case.
**Implication:** If a page calls hasMockAccess() 5 times (one per mock type), that's 5 DB queries per page load.
**Current usage:** Appears called from results pages when determining mock visibility.

**For future agents:** If results page is slow, check if hasMockAccess is being called in a loop. Batch via getComputedMockAccess() instead (returns all 5 fields at once, still 1 DB query but not repeated).

---

## SECTION 2: THINGS THAT LOOK FINE BUT ARE ACTUALLY DANGEROUS

### [NOTE-D1] Email Normalization Is Inconsistent Across APIs
**Dangerous because:** auth.ts normalizes emails to lowercase. But several API handlers do NOT normalize on input.
**Specific locations:**
- /api/registrations POST: email stored as-is (could be "Test@Example.com")
- /api/admin/grant-access POST: email validated but not normalized before write
- /api/admin/users POST: email not normalized before DB insert

**Result:** Two users can exist with "test@example.com" and "Test@Example.com" (MongoDB unique index is case-insensitive, but application-level lookups are case-sensitive unless normalized).

**For future agents:** Always normalize emails to lowercase before storing. Add `email: email.toLowerCase().trim()` to ALL API handlers that create or update users.

---

### [NOTE-D2] No Try-Catch in Auth Callbacks = 100% Login Failure on DB Error
**Dangerous because:** auth.ts has no error handling in signIn, jwt, or session callbacks.
**Code path:**
```
signIn callback → isEmailAuthorized() → getCachedUser() → User.findOne()
                                                          ↑ THROWS if MongoDB down
```
**Result:** signIn callback throws → NextAuth logs error → all sign-ins return generic error → 100% lockout.
**Counterpoint:** db-access-control.isEmailAuthorized DOES have a try-catch that returns false on error. BUT: the session and jwt callbacks call getUserByEmail which does NOT have this protection.

**For future agents:** Add try-catch to session and jwt callbacks. If getUserByEmail throws, return session unchanged (not null) — better to serve stale session than to crash.

---

### [NOTE-D3] Admin Score Submissions Are Silently Discarded
**Dangerous because:** When an admin submits a game score, the server returns `{success:true, isAdmin:true, scoreId:'admin-not-saved'}`. The client receives success but data is not saved.
**Where this matters:** If an admin is testing a game, they won't see their results in leaderboard — confusing.
**Hidden edge case:** An admin playing to help/benchmark the system gets no data. If they want to track their own practice, they can't.
**No error, no warning** — just silent discard.

**For future agents:** If an admin reports "my score isn't showing," check isAdmin flag. The behavior is intentional but undocumented.

---

### [NOTE-D4] /api/admin/grant-access Writes to Filesystem — Fails Silently in Vercel
**Dangerous because:** The handler attempts to write to access-control.json AND run `npm run generate:access-control`. Both fail in Vercel (read-only filesystem). The API still returns 200 OK.
**Admin sees:** "Access granted successfully" (201)
**Reality:** Student added to JSON in memory but NOT persisted; script doesn't run; student can't access system.
**This is RISK_012 in concrete form.** The issue is documented but the code still exists.

**For future agents:** The /api/admin/grant-access endpoint is effectively BROKEN in production (Vercel). Use /api/admin/users POST instead for reliable student creation.

---

### [NOTE-D5] Registration Email Recipients Are Personal Gmail Addresses (Hardcoded)
**Dangerous because:** Registration notifications go to personal Gmail accounts, not organizational addresses.
```
ahnaf816@gmail.com, hasanxsarower@gmail.com, ahnafahad16@gmail.com
```
**If any of these accounts are compromised:** Attacker receives all registration data (names, phones, education info) — potential GDPR/privacy concern.
**Changing them:** Requires code change + deploy. Cannot be done from admin panel.

**For future agents:** If notified that admin emails changed, edit src/lib/email.ts line ~6-10. Consider migrating to env var or DB-driven recipients.

---

### [NOTE-D6] /api/admin/sync-admins Has No Admin Authorization Check
**From API_CONTRACTS.md [C-ADMIN-05]:** The endpoint is documented as "Auth Required: session required (BUG: no admin role check — anyone authenticated can call this)."
**Meaning:** Any authorized student (not just admin) can POST to /api/admin/sync-admins and trigger a sync of access-control.json admins to the database.
**Impact:** Mostly harmless (syncs JSON → DB), but:
1. Non-admins shouldn't be able to trigger admin operations
2. If access-control.json is modified before sync, this could propagate incorrect admin data

**For future agents:** Add `isAdminEmail` check at the top of /api/admin/sync-admins handler. This is a missing gate.

---

## SECTION 3: AMBIGUITIES

### [NOTE-AMB-1] What Does "Mastered" Mean Pedagogically?
**Current definition (from code):** A question is mastered if answered correctly at least once. Mastery is permanent (no decay).
**Assumption:** "Once you know it, you know it."
**Alternative interpretation:** Mastery requires N consecutive correct answers (spaced repetition model).
**Ambiguity matters because:** The adaptive difficulty system ("prioritize unmastered") is entirely based on this definition. Changing it changes game balance.

**For future agents:** Do NOT change the mastery logic without confirming the pedagogical intent. Ask product owner whether the "1 correct = mastered forever" model is intentional.

---

### [NOTE-AMB-2] Question ID Format Is Load-Bearing and Undocumented
**Current format:** `lecture1_q1`, `lecture2_q15`, etc. (inferred from `id.startsWith(`lecture${lectureNum}_`)`)
**Source:** parse-accounting-questions.js generates these IDs. The format is assumed, not enforced.
**Risk:** If parse-accounting.js changes output format to anything else (e.g., `q_001`), mastery tracking silently stops working. No error thrown. Students keep being asked "mastered" questions.

**For future agents:**
1. Never change parse-accounting-questions.js question ID format without updating accounting-utils.ts mastery logic
2. Add a test: after running parse-accounting, verify IDs match `^lecture\d+_q\d+$`
3. If IDs ever diverge: run a MongoDB migration to clear AccountingProgress.masteredQuestions

---

### [NOTE-AMB-3] Two Different Admin Types — Which Is Authoritative?
**Confusion:** The system has both:
- `role: 'admin'` (can manage users, view registrations)
- `role: 'super_admin'` (can delete users, can't be deleted by admins)

**Distinction in code:**
- super_admin: DELETE /api/admin/users is super_admin only; cannot delete super_admins
- admin: everything else (users CRUD, registrations CRUD, grant access)

**Missing documentation:** What specific operations require super_admin vs admin? The permission system (`permissions: ['read','write','admin','manage_users']`) exists but the permission strings are checked inconsistently across routes.

**For future agents:** When adding a new admin-only feature, check if it should be `admin` or `super_admin`. Look at existing PATCH/DELETE guards as reference.

---

### [NOTE-AMB-4] accessTypes vs mockAccess — When to Use Which?
**Two overlapping systems:**
- `accessTypes.IBA` / `accessTypes.FBS` — broad category grants
- `mockAccess.duIba`, `mockAccess.bupIba`, etc. — per-mock grants

**How they interact:**
```
duIba = mockAccess.duIba || accessTypes.IBA
bupIba = mockAccess.bupIba || accessTypes.IBA
```
So `accessTypes.IBA = true` implicitly grants both duIba and bupIba mocks.

**When to use each:**
- Use `accessTypes.IBA = true` to give a student ALL IBA mocks in one field
- Use individual `mockAccess.duIba = true` for selective access (only du-iba, not bup-iba)
- `fbsDetailed` has NO `accessTypes` equivalent — must be set individually

**Not documented anywhere.** Future agents may set both unnecessarily (redundant) or miss the implicit grant.

---

### [NOTE-AMB-5] What Happens When Student Has Multiple IDs (roleNumbers)?
**Problem:** A student can have both a 6-digit IBA ID and a 7-digit FBS ID in `roleNumbers[]`.
**student-matcher.ts matching priority:**
1. Direct studentId match (if studentId field set)
2. Email reverse-lookup
3. roleNumbers[] match (checks all IDs in the array)

**The issue:** Test results may be keyed by either the 6-digit or 7-digit ID depending on which program they took. If a DU FBS student took an IBA mock, the result might be under their 6-digit ID. The matcher searches roleNumbers[], so it should find it — but only if roleNumbers[] is correctly populated.

**Failure scenario:** roleNumbers[] is empty or contains only one ID → student sees blank results for tests taken under the other ID.

**For future agents:** If a student reports missing results, check their User doc's roleNumbers[]. All their student IDs should be in this array.

---

## SECTION 4: GAPS IN DOCUMENTATION (other plot files don't cover these)

### [NOTE-G1] No Clear Onboarding Guide for New Admins
**Missing:** Step-by-step: "How to add a new admin to the system."
**Inferred process:**
1. Edit access-control.json: add to `admins[]` array
2. `npm run generate:access-control` (local)
3. Commit + push
4. Wait for Vercel build + deploy
5. THEN: POST /api/admin/sync-admins to sync JSON → MongoDB

**Not documented.** Admin might try to use /api/admin/users POST only (which works for DB but not JSON fast-path).

---

### [NOTE-G2] No Disaster Recovery Procedure
**Missing:** What to do if MongoDB is down / data is corrupted.
**Unknown:** Whether MongoDB Atlas automated backups are enabled. What's the RTO/RPO.
**Data at risk:** All user accounts, all game scores, all registrations.
**Static files** (/public/data/*.json) are in git — those are safe.

---

### [NOTE-G3] No Explanation of Score Formula Rationale
**Missing:** Why `+1/-0.25` for simple score? Why the specific speed bonus tiers?
**These are arbitrary constants** chosen by the product owner. If they seem odd, they probably came from Bangladesh competitive exam scoring conventions (IBA admission tests use negative marking).

**For future agents:** Don't change scoring constants without product owner confirmation. The formula mirrors the actual exam format students are preparing for.

---

### [NOTE-G4] No Documentation of /public/data/*.json File Format
**Missing:** Who generates these files, when, and how.
**Inferred:** Google Sheets export or manual compilation by instructors. Possibly processed by Python scripts (generate_mock_data.py, generate_all_mock_tests.py found in root).
**Unknown:** The exact schema used. src/types/results.ts has TypeScript types, but no sample data or generation instructions.

**For future agents:** If results page shows no data or chart errors, check if the JSON files exist and match src/types/results.ts schema. The Python scripts in root may be how they're generated.

---

### [NOTE-G5] The `Results/` Directory in Root
**What it is:** A local directory (not in /public/) containing result data files. Not committed to git? (Unknown without checking .gitignore)
**Used by:** Possibly the Python scripts or the bat file (update-results.bat)
**update-results.bat exists** — this bat file may copy results from `Results/` to `/public/data/` for deployment.

**For future agents:** If results data needs updating:
1. Check update-results.bat for the update process
2. Don't directly edit files in /public/data/ — they may be overwritten
3. Understand the pipeline: source data → Python/bat processing → /public/data/ → results page

---

### [NOTE-G6] FBS Games Directory in Root
**What it is:** `FBS Games/` directory at project root. Contains game data or question sources.
**Relationship to app:** Likely source for parse-accounting-questions.js → accounting-questions.json.
**Not in /src/ or /public/** — this is a local data directory.

**For future agents:** If accounting questions need updating:
1. Edit source files in `FBS Games/`
2. Run `npm run parse-accounting`
3. Verify output in /public/data/accounting-questions.json
4. Restart server (cache doesn't expire)

---

## SECTION 5: THINGS NOT COVERED BY OTHER PLOT FILES

### [NOTE-X1] Vercel Deployment Context Changes Runtime Behavior
The following features behave differently in Vercel vs local:
1. **File writes:** Disabled in Vercel (read-only). /api/admin/grant-access file write fails silently.
2. **process.cwd():** In Vercel, resolves to /var/task (build directory). access-control.json must be in build artifact.
3. **Serverless cold starts:** maxPoolSize:1 is intentional. Changing to >1 may cause connection pool exhaustion across concurrent instances.
4. **Environment variables:** Set in Vercel dashboard, not in .env files for production.

**For future agents:** Always test file-system-dependent features locally AND in Vercel. The `fs.writeFile` calls that "work in dev" will silently fail in prod.

---

### [NOTE-X2] Python Scripts at Root Are Not Part of App
**Files:** generate_all_mock_tests.py, generate_mock_data.py
**Purpose:** Generate mock test data (results, question banks, sample data).
**Not imported by Next.js app.** Standalone scripts run manually.
**Dependency:** Python (version unknown), possibly pandas or similar.

**For future agents:** These scripts are for content creation/admin tooling. They don't affect the running app. If they fail, the app still works (just with stale data in /public/data/).

---

### [NOTE-X3] check-*.js and test-*.js Files at Root
**Files:** check-section2-marks.js, check-thresholds.js, run-processor.js, test-threshold-calc.js
**Purpose:** Local utility scripts for analyzing/processing exam results data.
**Not part of the build.** Not imported by Next.js.
**Probably run manually:** `node check-section2-marks.js`

**For future agents:** These are diagnostic tools, not application code. Ignore during code review of the app itself.

---

### [NOTE-X4] /api/health Returns Detailed Auth Status to Unauthenticated Users
**Observation:** GET /api/health (public endpoint) returns:
```json
{
  "checks": {
    "authentication": {
      "hasSession": false,
      "email": "(partially hidden)",
      "isAuthorized": false,
      "isAdmin": false
    }
  }
}
```
**Information disclosure:** Shows whether user is authorized/admin even to unauthenticated callers. The email is "partially hidden" (likely first 3 chars + @domain) but the auth status is exposed.
**Low severity** — but worth noting: attackers can probe whether a session is active via this endpoint.

---

### [NOTE-X5] Leaderboard Aggregations May Be Slow at Scale
**Current implementation:** MongoDB aggregation pipelines run on-demand (no caching).
**At current scale (~26 users):** Queries are fast (<100ms).
**At 500+ users:** Aggregations over thousands of score documents could degrade.
**No pagination** on leaderboards (hardcoded LIMIT 10/20).

**For future agents:** If leaderboard queries slow down:
1. Add indexes: {dynamicScore: -1, isAdmin: 1} for accounting
2. Consider caching leaderboard (update every 5 min, not per-request)
3. Add pagination if more than 100 users

---

### [NOTE-X6] The `FBS Detailed` Mock Access Is Unique — No Group Grant
**Observation:** All other mocks have a group grant path (via accessTypes.IBA or accessTypes.FBS). fbsDetailed does not.
**To grant fbsDetailed:** Must explicitly set mockAccess.fbsDetailed = true on individual user.
**No shortcut:** Can't just set accessTypes.FBS = true to get fbsDetailed.
**Why:** fbsDetailed is a premium offering (6500 BDT in registration pricing) vs regular FBS mocks.

**For future agents:** When granting FBS access, don't assume fbsDetailed is included. Check explicitly.

---

## SECTION 6: QUESTIONS REQUIRING HUMAN CLARIFICATION

1. **Is the weak init-admin default secret intentional?** Should it fail-hard if not changed?
2. **Is "mastery = 1 correct answer" the intended pedagogy?** Or should it be spaced repetition?
3. **Should admin game submissions be visible to admins somewhere?** Or is silent discard intentional?
4. **What is the intended behavior for non-FBS students on the accounting game page?** Just "no access" or redirect with explanation?
5. **Is the dual JSON+DB access control temporary?** Plan to migrate all admins to DB?
6. **Who generates /public/data/*.json files?** Is update-results.bat the canonical process?
7. **Are the scoring constants (+1/-0.25, speed tiers) based on IBA exam format?** Can they be changed?
8. **Is there a MongoDB Atlas backup policy?** What is the DR plan?

---

## SECTION 7: HIGHEST-PRIORITY ACTIONS FOR NEXT AGENT

If you are an agent about to make changes, read this section first.

**Before touching auth.ts:**
- Know that any error in callbacks = 100% login failure
- Always wrap getUserByEmail calls in try-catch
- Test both signIn path AND session callback path

**Before touching db-access-control.ts:**
- clearAccessControlCache() MUST be called after any user state change
- Priority order: cache > JSON > DB (JSON wins even over DB)
- hasMockAccess is uncached; don't add more calls to it in loops

**Before touching accounting-utils.ts:**
- Question ID format `lectureN_qM` is load-bearing; never change without migration
- QUESTION_LIMIT = 16 is assumed in multiple places; changing it requires updating API validation too
- Module-level cachedData never expires; question changes require server restart

**Before touching /api/accounting/scores:**
- Admin scores are intentionally discarded (not a bug)
- updateQuestionMastery() is async non-blocking; errors don't fail the endpoint
- No server-side score recalculation exists (RISK_011)

**Before touching /api/admin/users PATCH:**
- clearAccessControlCache() must be called after EVERY update
- Non-super-admins cannot modify super_admins (guard exists, keep it)
- email must be normalized to lowercase before update

**Before deploying:**
- Verify INIT_ADMIN_SECRET is not default value
- Verify access-control.json is in the build artifact
- Run npm run generate:access-control AND npm run parse-accounting before build
- Test FBS access check in staging with a real FBS user
