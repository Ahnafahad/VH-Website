# FAILURE MAP — vh-website
# AGENT: AGENT-RISK
# CROSS-REFS: ARCHITECTURE.md, API_CONTRACTS.md, CONNECTIONS.md

## FORMAT
[RISK_ID] → location | trigger | blast_radius | recovery | severity(1-5)
severity: 1=cosmetic, 2=feature degraded, 3=data loss possible, 4=security issue, 5=total outage

---

## SEVERITY 5 (TOTAL OUTAGE / CRITICAL SECURITY)

### [RISK_009] Weak Init Admin Secret
location: src/app/api/init-admin/route.ts
trigger: INIT_ADMIN_SECRET env var not set → default is 'your-secret-key-change-this' → attacker POSTs with default
blast_radius: unauthorized super_admin created → full system access, no audit trail
recovery:
  1. Never deploy without INIT_ADMIN_SECRET set to random value
  2. Make endpoint fail if env var missing
  3. Disable endpoint after first successful init (check if admins exist)
  4. Restrict to NODE_ENV=development only
severity: 5

---

## SEVERITY 4 (SECURITY / CRITICAL FAILURES)

### [RISK_001] MongoDB Connection Pool Exhaustion
location: src/lib/db.ts | src/lib/mongodb.ts
trigger: maxPoolSize:1 under concurrent serverless requests; connection timeout 5s
blast_radius: ALL authenticated endpoints fail; complete app lockdown
recovery:
  1. Increase maxPoolSize to 5-10 in production
  2. Add connection retry logic with exponential backoff
  3. Monitor via APM/CloudWatch
severity: 4

### [RISK_002] Dual Access Control System Divergence
location: src/lib/db-access-control.ts | src/lib/generated-access-control.ts
trigger: admin added via DB without JSON rebuild; JSON updated without DB sync; cross-region stale builds
blast_radius: admins lose privileges; students gain/lose access unpredictably; different server instances behave differently
recovery:
  1. Single source of truth: deprecate JSON, always use DB at runtime
  2. Add startup divergence check; alert if diff > threshold
  3. Make generation failure fail the build
severity: 4

### [RISK_003] Missing DB Error Handling in Auth Callbacks
location: src/lib/auth.ts (signIn + session callbacks)
trigger: MongoDB down during sign-in; getUserByEmail() throws
blast_radius: signIn returns false silently → ALL users locked out; no fallback
recovery:
  1. Wrap isEmailAuthorized/getUserByEmail in try-catch
  2. Fallback to static generated-access-control.ts on DB failure for admins
  3. Return 503 on DB unavailable, not silent false
severity: 4

### [RISK_005] FBS Access Check Bypass
location: src/app/api/accounting/scores/route.ts:16-27
trigger: non-FBS user crafts direct API call; dbUser lookup fails → access check skipped
blast_radius: unauthorized users submit accounting scores; contaminated leaderboard
recovery:
  1. Assert dbUser exists before accessing nested properties
  2. Reject immediately if no dbUser found and not admin
severity: 4

### [RISK_012] File System Writes in Production
location: src/app/api/admin/grant-access/route.ts | src/app/api/admin/students/route.ts
trigger: admin adds student → writes to access-control.json → Vercel read-only filesystem fails silently
blast_radius: admin sees success (200 OK) but file not updated; student can't access system after next deploy
recovery:
  1. Remove all file writes; use DB as single source of truth
  2. Deprecate access-control.json as runtime store; generate from DB at build time
severity: 4

### [RISK_014] No CSRF Protection
location: ALL POST/PATCH/DELETE routes
trigger: attacker tricks logged-in admin into visiting malicious page that makes cross-site requests
blast_radius: attacker creates/modifies users on behalf of admin; can grant themselves access
recovery:
  1. Add X-CSRF-Token validation via NextAuth middleware
  2. SameSite=Strict cookie policy
severity: 4

### [RISK_015] No Rate Limiting
location: ALL API routes
trigger: attacker scripts bulk POSTs to /api/registrations; brute-force auth; spam score submissions
blast_radius: DB flooded with spam; email quota exhausted; DoS via leaderboard aggregation
recovery:
  1. Rate limit: /api/registrations 5/min/IP, score endpoints 20/hour/user
  2. Return 429 Too Many Requests
  3. Exponential backoff in clients
severity: 4

### [RISK_023] No JWT Revocation
location: NextAuth JWT tokens (no jti claim)
trigger: stolen JWT token can be reused until session expiry (potentially 30 days)
blast_radius: attacker impersonates user indefinitely; no way to invalidate compromised token
recovery:
  1. Add jti (JWT ID) claim, store in Redis revocation list
  2. Token revocation endpoint: /api/auth/logout adds jti to blocklist
  3. Validate jti on each request
severity: 4

### [RISK_028] Admin Permission Escalation
location: src/lib/auth.ts (stores token.permissions = userInfo.permissions without whitelist check)
trigger: DB compromised → arbitrary string added to permissions[] → JWT stores it → code trusts it
blast_radius: attacker gains permissions beyond those actually granted
recovery:
  1. Define VALID_PERMISSIONS = ['read','write','admin','manage_users','delete']
  2. Filter: permissions.filter(p => VALID_PERMISSIONS.includes(p))
  3. Reject auth if invalid permission found
severity: 4

---

## SEVERITY 3 (DATA LOSS / ACCESS CONTROL)

### [RISK_004] Race Condition in Score Submission (No Idempotency)
location: all /api/{game}/scores routes
trigger: network timeout before response → client retries → duplicate score documents created
blast_radius: leaderboard rankings incorrect; cumulative scores inflated; stats wrong
recovery:
  1. Add optional idempotencyKey to request body
  2. Unique index on (email, idempotencyKey)
  3. Server-side deduplication: hash(email + score + floor(timestamp/10s))
severity: 3

### [RISK_008] XSS via Registration Input
location: src/app/api/registrations/route.ts (email validates only `includes('@')`)
trigger: attacker sends email: "test@example.com\n<script>alert(1)</script>"
blast_radius: stored XSS executed when admin views registration panel; admin browser runs attacker code
recovery:
  1. Validate email with full RFC 5322 regex: ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$
  2. Sanitize all string inputs before storing
  3. Add Content-Security-Policy header
severity: 3

### [RISK_011] Accounting Score Cheating (No Server-Side Recalculation)
location: src/app/api/accounting/scores/route.ts
trigger: user crafts POST with inflated dynamicScore/simpleScore values
blast_radius: fraudulent leaderboard entries; unfair competitive advantage
recovery:
  1. Recalculate server-side: simpleScore = max(0, correct*1.0 + wrong*-0.25)
  2. Verify: dynamicScore >= simpleScore
  3. Validate speed bonuses against timeSpent per question
  4. Reject if calculated ≠ submitted (with tolerance for floating point)
severity: 3

### [RISK_013] Build-Time Generation Fails Silently
location: scripts called from admin API routes during runtime
trigger: exec('npm run generate:access-control') fails → .catch() logs and continues → API returns 201
blast_radius: student added but generated-access-control.ts stale → student can't access after redeploy
recovery:
  1. Remove runtime generation calls entirely (impossible in Vercel anyway)
  2. Move to CI/CD pipeline; fail build on generation error
  3. Commit generated file to version control
severity: 3

### [RISK_017] Stored XSS via Rich Input Fields
location: src/app/api/registrations/route.ts (referral.name, referral.batch fields)
trigger: attacker sends referral.name: "<img src=x onerror='alert(1)'>"
blast_radius: XSS when admin renders referral in admin panel
recovery:
  1. Sanitize: strip HTML tags, encode special chars before storage
  2. Use `xss` or `sanitize-html` library
  3. CSP header
severity: 3

### [RISK_019] Gemini API Failure with No Fallback
location: src/app/api/generate-questions/route.ts
trigger: Gemini rate limit, outage, or timeout
blast_radius: vocab quiz question generation fails; feature completely unavailable
recovery:
  1. 10-second timeout on Gemini call
  2. Cached fallback questions for common prompts
  3. Exponential backoff retry (max 3 attempts)
  4. Circuit breaker pattern
severity: 3

### [RISK_024] Student ID Collision (IBA vs FBS)
location: src/lib/models/User.ts | src/app/api/add-fbs-students/route.ts
trigger: IBA student has studentId '123456'; FBS student has roleNumbers containing '123456'; DB allows it (sparse unique only on studentId)
blast_radius: admin lookup by studentId returns wrong student; result visibility issue; potential privilege escalation
recovery:
  1. Deprecate studentId field; use roleNumbers[] exclusively
  2. Ensure roleNumbers values are globally unique across IBA/FBS ranges
  3. Validate on insert: new roleNumber must not appear in any other user's roleNumbers
severity: 3

### [RISK_025] Unvalidated questionResults Array
location: src/app/api/accounting/scores/route.ts
trigger: attacker sends questionResults:[null, {}, "invalid"]
blast_radius: passes array check; crashes updateQuestionMastery(); no error handling
recovery:
  1. Validate each item: {questionId:string, isCorrect:bool, lectureNumber:number, timeSpent:number}
  2. Reject if any item violates schema
  3. Length limit: max 20 question results per submission
severity: 3

### [RISK_030] Session Not Invalidated on User Deactivation
location: src/app/api/admin/users/route.ts (PATCH deactivation)
trigger: admin deactivates user in DB; existing JWT still valid until expiry
blast_radius: deactivated user keeps submitting scores, accessing materials for duration of session
recovery:
  1. Redis revocation list keyed by email
  2. On deactivation: add to revocation list
  3. Check revocation on each auth-required request
severity: 3

### [RISK_034] No TLS Certificate Pinning on External Calls
location: src/app/api/generate-questions/route.ts (fetch to Google Gemini)
trigger: MITM attack on Gemini API connection
blast_radius: API key exposed; malicious responses injected as questions
recovery: Node.js >=15 validates by default; add explicit rejectUnauthorized:true if using custom http
severity: 3

---

## SEVERITY 2 (FEATURE DEGRADED / DATA QUALITY)

### [RISK_006] Silent Email Notification Failure
location: src/app/api/registrations/route.ts:96-111
trigger: sendRegistrationNotification() throws; .catch() silently logs
blast_radius: admin never notified of new registrations; registrations pile up unreviewed
recovery:
  1. Store failed notifications in FailedNotifications collection
  2. Background retry queue (max 3 attempts)
  3. Admin dashboard to view + manually retry
severity: 2

### [RISK_007] Hardcoded Admin Email Recipients
location: src/lib/email.ts:6-10
trigger: admin email changes; must redeploy to update
blast_radius: notifications go to wrong/outdated addresses
recovery: Load recipients from User collection (role='admin', active=true) + cache 5min
severity: 2

### [RISK_010] Weak FBS Student ID Validation
location: src/lib/models/User.ts | src/app/api/add-fbs-students/route.ts
trigger: FBS ID format changes; malformed IDs bypass validation
blast_radius: invalid IDs stored; student can't match results; leaderboard lookup fails
recovery: Strict Mongoose validator: /^[0-9]{7}$/.test(v); API validation before insert
severity: 2

### [RISK_018] Student-Matcher False Negatives
location: src/utils/student-matcher.ts
trigger: student has both 6-digit IBA ID and 7-digit FBS ID; test result under FBS ID; matcher searches only 6-digit
blast_radius: student sees blank results; admin sees mismatch
recovery:
  1. Search across ALL roleNumbers (not just studentId field)
  2. When saving results, save under all student IDs
severity: 2

### [RISK_020] Resend API Dependency (No Fallback)
location: src/lib/email.ts
trigger: Resend API down or key revoked
blast_radius: admin notifications fail; same as RISK_006
recovery: Retry queue; fallback to secondary email provider
severity: 2

### [RISK_021] No Request Body Size Limit
location: all POST routes
trigger: attacker sends 100MB body
blast_radius: memory exhaustion; process crash; DoS
recovery:
  1. Next.js config: api.bodyParser.sizeLimit = '1mb'
  2. Per-route limits: registrations=10KB, scores=100KB
  3. Return 413 Payload Too Large
severity: 2

### [RISK_022] Stale Access Control Cache (60s TTL)
location: src/lib/db-access-control.ts (emailCache Map)
trigger: admin revokes student access in DB; cache still has student as active for up to 60s
blast_radius: revoked user can still submit scores for up to 1 minute
recovery:
  1. Call clearAccessControlCache() in admin PATCH handler after user deactivation
  2. Reduce TTL to 10s
severity: 2

### [RISK_026] Accounting Questions File Read Error
location: src/app/api/accounting/progress/route.ts
trigger: /public/data/accounting-questions.json missing or malformed
blast_radius: 500 with stack trace exposed to client; progress endpoint unavailable
recovery:
  1. Try-catch around file read
  2. Preload and cache at startup; fail loudly if missing
  3. Return 503 with message (not stack trace)
severity: 2

### [RISK_027] NaN/Infinity Values in Numeric Fields
location: score submission routes (all three games)
trigger: questionsAnswered: NaN (NaN passes typeof !== 'number' check)
blast_radius: NaN stored in DB; aggregation leaderboards return NaN values
recovery:
  1. Validate with Number.isFinite() (rejects NaN and Infinity)
  2. Add range checks: score >= 0, accuracy 0-100, questionsAnswered >= 1
severity: 2

### [RISK_029] No DB Operation Retry Logic
location: all score/registration save operations
trigger: transient MongoDB connection error on write
blast_radius: lost score submissions; user thinks it worked but data not saved
recovery:
  1. Retry wrapper with exponential backoff (50ms, 100ms, 200ms)
  2. Max 3 retries on ECONNREFUSED/timeout
  3. Return {retryable:true} in error response for client
severity: 2

### [RISK_031] Hard-Coded Scoring Thresholds
location: src/app/api/accounting/scores/route.ts (1.0 correct, -0.25 wrong)
trigger: scoring rules change; must update both client and server separately; mismatch causes rejected scores
recovery:
  1. Extract to constants: CORRECT_POINTS=1.0, WRONG_PENALTY=0.25
  2. Consider storing rules in DB document with versioning
  3. Client fetches rules at startup; server validates using same source
severity: 2

### [RISK_032] No Pagination on Admin Endpoints
location: src/app/api/registrations/route.ts (hardcoded limit:50 default)
trigger: admin requests all 10,000 registrations without limit param
blast_radius: memory exhaustion; slow response; client timeout
recovery:
  1. Enforce max limit of 500
  2. Return pagination metadata: {total, limit, offset, hasMore}
severity: 2

### [RISK_033] Debug Endpoint Too Permissive
location: src/app/api/admin/debug/route.ts
trigger: any authenticated user (not just admin) can call it
blast_radius: exposes internal system state (NODE_ENV, file paths, DB user info, access control structure)
recovery:
  1. Add super_admin role check
  2. Or add DEBUG_ENDPOINT_ENABLED env gate
  3. Rate limit: 1/minute per user
severity: 2

### [RISK_035] Potential Infinite Recursion in Student Matcher
location: src/utils/student-matcher.ts:79-97
trigger: circular reference in students.json data
blast_radius: stack overflow; server crash
recovery: Add visited set; max recursion depth guard
severity: 2

---

## SEVERITY 1 (COSMETIC / OPERATIONAL)

### [RISK_036] Weak Email Domain Validation
location: src/app/api/admin/grant-access/route.ts
trigger: admin adds student with email 'test@localhost' or 'test@test'
blast_radius: invalid email stored; notifications fail
recovery: Use proper email regex or email-validator library
severity: 1

### [RISK_037] Account Enumeration via Status Codes
location: src/app/api/auth/check-admin/route.ts
trigger: returns 404 if access-control.json missing vs 200 if exists → reveals system structure
recovery: Always return 200; don't expose file paths in errors
severity: 1

---

## RISK SUMMARY BY AREA

### Authentication / Authorization (CRITICAL)
RISK_002, RISK_003, RISK_005, RISK_009, RISK_012, RISK_014, RISK_023, RISK_028, RISK_030

### Data Integrity / Leaderboard Trust
RISK_004, RISK_011, RISK_024, RISK_025, RISK_027, RISK_031

### Availability / Performance
RISK_001, RISK_015, RISK_019, RISK_021, RISK_029, RISK_032

### Input Validation / XSS
RISK_008, RISK_017, RISK_027, RISK_036

### Operational / Config
RISK_006, RISK_007, RISK_013, RISK_020, RISK_022, RISK_026, RISK_033

---

## RECOMMENDED IMMEDIATE ACTIONS (ordered by impact)

**THIS WEEK:**
1. RISK_009: Set INIT_ADMIN_SECRET properly; add env check
2. RISK_014: Add CSRF token validation
3. RISK_015: Add rate limiting middleware (Upstash Redis or in-memory)
4. RISK_009: Disable /api/init-admin in production after bootstrap

**THIS MONTH:**
5. RISK_003: Add DB failure handling in auth callbacks with static fallback
6. RISK_008: Replace email validation with proper regex
7. RISK_012: Audit all file write calls; remove from production code paths
8. RISK_011: Add server-side score recalculation
9. RISK_004: Implement idempotency keys on score endpoints

**THIS QUARTER:**
10. RISK_002: Deprecate dual access control; single DB source
11. RISK_001: Optimize MongoDB connection pooling
12. RISK_028: Implement permission whitelist validation
13. RISK_023: Add JWT ID + revocation mechanism
14. Implement comprehensive audit logging (RISK_016 equivalent)
