# API CONTRACTS — vh-website
# AGENT: AGENT-API
# CROSS-REFS: ARCHITECTURE.md, DATA_FLOW.md, FAILURE_MAP.md

## AUTH ROUTES

### [C-AUTH-01] NextAuth Handler
path: /api/auth/[...nextauth] | methods: GET, POST
in: NextAuth session management (OAuth callback data)
out: session + JWT token (HTTP-only cookie)
auth: Google OAuth (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
session.user shape after auth:
```typescript
{
  email: string          // normalized lowercase
  name: string
  role: 'super_admin' | 'admin' | 'student'
  isAdmin: boolean
  permissions: string[]
  studentId?: string     // 6-digit IBA or 7-digit FBS
  adminId?: string
  class?: string
  batch?: string
  accessTypes?: { IBA: boolean, FBS: boolean }
  mockAccess?: { duIba: boolean, bupIba: boolean, duFbs: boolean, bupFbs: boolean, fbsDetailed: boolean }
}
```

### [C-AUTH-02] Check Admin
path: /api/auth/check-admin | method: GET
in: session (no body)
out: { isAdmin: boolean }
errors: 401 (no session), 404 (access-control.json missing), 500
auth: active session required

---

## ADMIN ROUTES

### [C-ADMIN-01] Debug
path: /api/admin/debug | method: GET
in: none
out: { email, hasSession, jsonFile{exists,path,totalAdmins,adminFoundInJson}, database{userFound,userRole,isAdmin,studentId,roleNumbers,accessTypes,mockAccess}, cwd, nodeEnv }
auth: active session
WARNING: exposes internal system state; should be super_admin only

### [C-ADMIN-02] Grant Access POST (create student)
path: /api/admin/grant-access | method: POST
in: { name:string!, email:string!, studentId:string!(6 digits exactly), class:string!, batch:string!, permissions?:string[] }
out: { success:true, message, student:{studentId,name,email,role,permissions,addedDate,active,class,batch} }
status: 201
errors: 400(validation), 403(unauthorized), 409(duplicate)
auth: admin

### [C-ADMIN-03] Grant Access GET (list students)
path: /api/admin/grant-access | method: GET
in: none
out: { success:true, students:[...] }
auth: admin

### [C-ADMIN-04] Grant Access PATCH (update student)
path: /api/admin/grant-access | method: PATCH
in: { studentId:string!, ...updatableFields }
out: { success:true, message, student:{...} }
errors: 400(missing studentId), 403, 404
auth: admin

### [C-ADMIN-05] Sync Admins
path: /api/admin/sync-admins | method: POST
in: none (reads access-control.json)
out: { success:true, summary:{total,created,updated,skipped,errors}, results:[{email,action,role,error?}] }
errors: 401, 404(json missing), 500
auth: session required (BUG: no admin role check — anyone authenticated can call this)

### [C-ADMIN-06] Sync Role Numbers
path: /api/admin/sync-role-numbers | method: POST
in: none (reads students.json)
out: { success:true, summary:{totalEmails,updated,created,skipped,errors}, results:[{email,action,roleNumbers,message}] }
errors: 403, 404, 500
auth: admin required

### [C-ADMIN-07] Users GET
path: /api/admin/users | method: GET
query: ?role=super_admin|admin|student, ?active=true|false, ?search=string
out: { success:true, users:[{_id,email,name,role,adminId,studentId,roleNumbers,class,batch,accessTypes,mockAccess,permissions,active,addedDate,createdAt,updatedAt}], count:number }
auth: admin

### [C-ADMIN-08] Users POST (create)
path: /api/admin/users | method: POST
in: { email:string!, name:string!, role:string!, adminId?:string, studentId?:string(6digits), class?:string, batch?:string, accessTypes?:{IBA:bool,FBS:bool}, mockAccess?:{duIba,bupIba,duFbs,bupFbs,fbsDetailed:bool}, permissions?:string[], active?:bool }
out: { success:true, message, user:{...} }
status: 201
errors: 400(validation), 403, 409(dup email/studentId/adminId), 500
defaults: accessTypes all false, mockAccess all false, permissions:['read'], active:true
auth: admin

### [C-ADMIN-09] Users PATCH (update)
path: /api/admin/users | method: PATCH
in: { userId:ObjectId!, ...updates }
out: { success:true, message, user:{...} }
errors: 400(missing userId), 403(non-super trying to modify super), 404, 409(dup), 500
note: merges nested objects (accessTypes, mockAccess); non-super-admins cannot modify super_admins
auth: admin

### [C-ADMIN-10] Users DELETE
path: /api/admin/users?userId=<id> | method: DELETE
query: userId:ObjectId
out: { success:true, message }
errors: 400, 403(only super can delete; cannot delete super accounts), 404, 500
auth: super_admin only

---

## GAME: ACCOUNTING

### [C-ACCT-01] Submit Score
path: /api/accounting/scores | method: POST
in:
```json
{
  "simpleScore": number,         // required: max(0, correct*1 + wrong*-0.25)
  "dynamicScore": number,        // required: simpleScore + speedBonuses + lectureBonus
  "totalSpeedBonus": number,     // required, >= 0
  "lectureCoverageBonus": number,// required, = selectedLectures.length * 0.1
  "questionsAnswered": 16,       // required, must equal 16
  "correctAnswers": number,      // required, >= 0
  "wrongAnswers": number,        // required, >= 0
  "skippedAnswers": number,      // required; correct+wrong+skipped MUST = 16
  "accuracy": number,            // required, 0-100
  "selectedLectures": number[],  // required, non-empty, values 1-12
  "timeTaken": number,           // required, >= 0 (total seconds)
  "questionResults": [           // array of per-question results
    { "questionId":string, "selected":string, "correct":string, "isCorrect":bool, "timeSpent":number }
  ]
}
```
out: { success:true, message, isAdmin:bool, scoreId:ObjectId|'admin-not-saved', simpleScore, dynamicScore, mastery:{newlyMastered,lecturesCompleted,totalMastered,totalQuestions:281}|null }
errors: 403(FBS_ACCESS_REQUIRED), 400(validation), 500
auth: FBS access or admin
side_effects: saves AccountingScore (skips admin), calls updateQuestionMastery() (async, non-blocking)

### [C-ACCT-02] Leaderboard
path: /api/accounting/leaderboard | method: GET
out:
```json
{
  "singular": [ { "playerEmail","playerName","bestDynamicScore","bestSimpleScore","questionsAnswered","correctAnswers","accuracy","selectedLecturesCount","timeTaken","playedAt" } ],
  "cumulative": [ { "playerEmail","playerName","totalDynamicScore","totalSimpleScore","gamesPlayed","totalQuestions","totalCorrect","averageAccuracy","lecturesCoveredCount","lastPlayed" } ],
  "isEmpty": bool, "singularCount": number, "cumulativeCount": number, "message": string
}
```
limits: singular top 20, cumulative top 20
filter: isAdmin != true
auth: FBS access or admin

### [C-ACCT-03] Progress
path: /api/accounting/progress | method: GET
out:
```json
{
  "success": true,
  "progress": {
    "totalMastered": number, "totalQuestions": 281, "overallPercentage": number,
    "lectureProgress": [ { "lectureNumber","lectureName","totalQuestions","masteredCount","percentage","completionCount","isCompleted","lastPlayed" } ],
    "masteredQuestionIds": string[],
    "lastUpdated": "ISO date | null"
  }
}
```
auth: FBS access or admin
note: returns zeroed data if no progress document exists

---

## GAME: MENTAL MATH

### [C-MATH-01] Submit Score
path: /api/mental-math/scores | method: POST
in: { score:number!, questionsCorrect:number!, questionsAnswered:number!(>=1), accuracy:number!(0-100), difficulty:'easy'|'medium'|'hard'|'extreme'!, operations:string[]!(non-empty,enum:addition|subtraction|multiplication|division), timeLimit:number!(>=0.5) }
out: { success:true, message, isAdmin:bool, scoreId:ObjectId }
errors: 400(validation), 401(auth required), 403, 500
auth: authorized user (validateAuth)

### [C-MATH-02] Leaderboard
path: /api/mental-math/leaderboard | method: GET
out:
```json
{
  "individual": [ { "playerName","score","questionsCorrect","questionsAnswered","accuracy","difficulty","operations","playedAt","timeLimit","isSuspicious" } ],
  "accumulated": [ { "playerName","totalScore","gamesPlayed","averageScore","bestScore","overallAccuracy" } ],
  "isEmpty": bool, "message": string
}
```
limits: individual top 10 (top 3 per player), accumulated top 20
auth: authenticated user

---

## GAME: VOCAB QUIZ

### [C-VOCAB-01] Submit Score
path: /api/vocab-quiz/scores | method: POST
in: { questionsAnswered:number!(>=1), questionsCorrect:number!(>=0, must be <=questionsAnswered), totalSections:number!(>=1), selectedSections:number[]!(non-empty), difficulty:'easy'|'medium'|'hard'|'mixed'! }
out: { success:true, message, isAdmin:bool, scoreId:ObjectId }
errors: 400, 401, 403, 500
auth: authorized user

### [C-VOCAB-02] Leaderboard
path: /api/vocab-quiz/leaderboard | method: GET
out: { leaderboard:[ { playerName, totalQuestionsAnswered, totalQuestionsCorrect, gamesPlayed, averageAccuracy, lastPlayed, uniqueSectionsCount } ], isEmpty:bool, message:string }
limit: top 10 by totalQuestionsAnswered
filter: isAdmin != true
auth: authenticated user

---

## REGISTRATION

### [C-REG-01] Submit Registration (PUBLIC)
path: /api/registrations | method: POST
auth: NONE (public endpoint)
in:
```json
{
  "name": "string!",
  "email": "string! (must contain @)",
  "phone": "string!",
  "educationType": "hsc | alevels",
  "years": { "hscYear?": "string", "sscYear?": "string", "aLevelYear?": "string", "oLevelYear?": "string" },
  "programMode": "mocks | full",
  "selectedMocks": "string[] (required if mocks, enum: du-iba|bup-iba|du-fbs|bup-fbs|fbs-detailed)",
  "mockIntent": "trial | full (required if mocks)",
  "pricing": { "subtotal": number, "discount": number, "finalPrice": number },
  "selectedFullCourses": "string[] (required if full, enum: du-iba-full|bup-iba-fbs-full)",
  "referral": { "name?": "string", "institution?": "BUP FBS|BUP IBA|IBA DU|DU FBS|Beyond the Horizon Alumni|Current Student", "batch?": "string" }
}
```
out: { success:true, message, registrationId:ObjectId }
status: 201
side_effects: creates Registration doc + sends async email to 3 hardcoded admins

### [C-REG-02] List Registrations (Admin)
path: /api/registrations | method: GET
query: ?status=pending|contacted|enrolled|cancelled, ?programMode=mocks|full, ?limit=number(default 50)
out: { success:true, registrations:[...], counts:{pending,contacted,enrolled,cancelled}, total:number }
auth: admin

### [C-REG-03] Get Registration
path: /api/registrations/[id] | method: GET
out: { success:true, registration:{...} }
errors: 403, 404, 500
auth: admin

### [C-REG-04] Update Registration
path: /api/registrations/[id] | method: PATCH
in: { status?:'pending'|'contacted'|'enrolled'|'cancelled', notes?:string, name?:string, email?:string, phone?:string }
out: { success:true, message, registration:{...} }
errors: 400(invalid status), 403, 404, 500
auth: admin

---

## UTILITY ROUTES

### [C-UTIL-01] User Access
path: /api/user/access | method: GET
in: none (reads session)
out: { hasIBA:bool, hasFBS:bool, isAdmin:bool, roleNumbers?:string[] }
auth: optional session; returns all-false if no session

### [C-UTIL-02] Generate Questions (Gemini AI)
path: /api/generate-questions | method: POST
in: { prompt:string!, type?:string }
out: Gemini API response (structured question JSON)
errors: 400(missing prompt), 401, 403, 500
auth: authorized user (isEmailAuthorized)
external: Gemini 2.5 Flash Lite (GOOGLE_GEMINI_API_KEY server-side only)

### [C-UTIL-03] Health Check
path: /api/health | method: GET
auth: none (public)
out:
```json
{
  "timestamp": "ISO date",
  "status": "healthy | unhealthy",
  "checks": {
    "environment": { "status", "details": { "required":{MONGODB_URI:bool,NEXTAUTH_SECRET:bool,NEXTAUTH_URL:bool}, "missing":string[], "nodeEnv":string } },
    "database": { "status", "details": { "connected":bool, "readyState":number } },
    "authentication": { "status", "details": { "hasSession":bool, "email":(partially hidden), "isAuthorized":bool, "isAdmin":bool, "name":string } }
  }
}
```
http_status: 200 healthy, 500 unhealthy

### [C-UTIL-04] Init Admin (Bootstrap)
path: /api/init-admin | method: POST
in: { secret:string (must match INIT_ADMIN_SECRET env var) }
out: { success:true, message, admins:[{email,name,role}] }
errors: 403(wrong secret), 400(admins already exist), 500
auth: secret-based (no session)
DANGER: creates super_admin — default secret is 'your-secret-key-change-this' if env not set
idempotent: NO — fails if any admins exist

### [C-UTIL-05] Add FBS Students (Bulk)
path: /api/add-fbs-students | method: POST
in: { students:[{studentId:string!(7digits), name:string!, email:string!}], accessType:'DU FBS'|'BUP FBS' }
out: { success:true, message, results:{migrated,updated,created,errors:[{email,error}]} }
auth: admin

### [C-UTIL-06] Migrate Students
path: /api/migrate-students | method: POST
in: none (reads access-control.json)
out: { success:true, message, migratedCount:number, students:[{email,name,studentId}] }
auth: super_admin
idempotent: NO — fails if any students already exist in DB

---

## MONGOOSE SCHEMAS (abbreviated)

### User (users collection)
```
email: String unique lowercase indexed
name: String required
role: Enum['super_admin','admin','student'] default:'student'
adminId: String sparse unique
studentId: String sparse unique (6-7 digit regex validation)
roleNumbers: [String] default:[]
class: String, batch: String
accessTypes: { IBA: Boolean=false, FBS: Boolean=false }
mockAccess: { duIba,bupIba,duFbs,bupFbs,fbsDetailed: Boolean=false }
permissions: [String] default:['read']
active: Boolean=true indexed
addedDate: Date=now, createdAt: Date(idx:-1), updatedAt: Date
```

### Registration (registrations collection)
```
name,phone: String required
email: String required indexed
educationType: Enum['hsc','alevels'] required
programMode: Enum['mocks','full'] required
selectedMocks: [Enum[du-iba,bup-iba,du-fbs,bup-fbs,fbs-detailed]]
mockIntent: Enum['trial','full']
pricing: {subtotal,discount,finalPrice: Number}
selectedFullCourses: [Enum[du-iba-full,bup-iba-fbs-full]]
referral: {name,institution(enum),batch}
years: {hscYear,sscYear,aLevelYear,oLevelYear}
status: Enum['pending','contacted','enrolled','cancelled'] default:'pending' indexed
notes: String
createdAt(idx:-1), updatedAt: Date
```

### MathScore (mathscores collection)
```
playerEmail: String indexed
playerName: String='Anonymous'
score: Number required indexed:-1
questionsCorrect,questionsAnswered: Number required
accuracy: Number 0-100
difficulty: Enum['easy','medium','hard','extreme'] required
operations: [Enum[addition,subtraction,multiplication,division]] required
timeLimit: Number min:0.5
playedAt: Date=now indexed:-1
isAdmin: Boolean=false
```

### VocabScore (vocabscores collection)
```
playerEmail: String indexed
playerName: String='Anonymous'
questionsAnswered,questionsCorrect: Number required
totalSections: Number min:1
selectedSections: [Number] required
difficulty: String required
playedAt: Date=now indexed:-1
isAdmin: Boolean=false
```

### AccountingScore (accountingscores collection)
```
playerEmail: String required lowercase indexed
playerName: String='Anonymous'
simpleScore,dynamicScore: Number required (dynamicScore indexed:-1)
totalSpeedBonus,lectureCoverageBonus: Number=0
questionsAnswered: Number=16
correctAnswers,wrongAnswers,skippedAnswers: Number required
accuracy: Number 0-100
selectedLectures: [Number 1-12] required
timeTaken: Number min:0
playedAt: Date=now indexed:-1
isAdmin: Boolean=false
```

### AccountingProgress (accountingprogresses collection)
```
playerEmail: String required unique indexed
masteredQuestions: Set<String>   // serialized as Array
lectureProgress: Map<number, { totalQuestions,masteredCount,completionCount,lastPlayed }>
totalMastered: Number 0-281
totalQuestions: Number=281 (immutable)
lastUpdated(indexed:-1), createdAt, updatedAt: Date
```

---

## ENVIRONMENT VARIABLES

### Required
```
NEXTAUTH_SECRET=<openssl rand -base64 32>
NEXTAUTH_URL=https://vh-beyondthehorizons.vercel.app
GOOGLE_CLIENT_ID=<Google OAuth client ID>
GOOGLE_CLIENT_SECRET=<Google OAuth client secret>
MONGODB_URI=mongodb+srv://...
NODE_ENV=production|development
```

### Optional
```
GOOGLE_GEMINI_API_KEY=<aistudio.google.com key>    # needed for vocab quiz
RESEND_API_KEY=<resend.com key>                     # needed for registration emails
NEXT_PUBLIC_EMAILJS_SERVICE_ID=<...>               # client-side email fallback
NEXT_PUBLIC_EMAILJS_TEMPLATE_ID=<...>
NEXT_PUBLIC_EMAILJS_PUBLIC_KEY=<...>
INIT_ADMIN_SECRET=<custom string>                   # for /api/init-admin
```

---

## ACCESS CONTROL JSON SCHEMA (access-control.json)

```json
{
  "$schema": "...",
  "version": "string",
  "lastUpdated": "ISO date",
  "admins": [
    { "id":"admin_XXX", "name":"string", "email":"string(lowercase)", "role":"super_admin|admin", "permissions":["read","write","admin","manage_users"], "addedDate":"YYYY-MM-DD", "active":bool }
  ],
  "students": [
    { "studentId":"6digits", "name":"string", "email":"string(lowercase)", "role":"student", "permissions":["read"], "addedDate":"YYYY-MM-DD", "active":bool, "class":"string", "batch":"string" }
  ],
  "settings": { "requireEmailVerification":bool, "allowSelfRegistration":bool, "sessionTimeout":number, "maxFailedAttempts":number, "autoDeactivateAfterDays":number },
  "validation": { "emailRegex":"string", "studentIdFormat":"^[0-9]{6,7}$", "allowedEmailDomains":["string"], "requiredFields":["string"] }
}
```

---

## AUTH & AUTHORIZATION MATRIX

| Endpoint | Method | Public | Auth | Admin | SuperAdmin |
|----------|--------|--------|------|-------|------------|
| /api/auth/[...nextauth] | GET/POST | YES | - | - | - |
| /api/auth/check-admin | GET | - | YES | - | - |
| /api/admin/debug | GET | - | YES | - | - |
| /api/admin/grant-access | POST | - | YES | YES | - |
| /api/admin/sync-admins | POST | - | YES | - | - |
| /api/admin/sync-role-numbers | POST | - | YES | YES | - |
| /api/admin/users | GET/POST/PATCH | - | YES | YES | - |
| /api/admin/users | DELETE | - | YES | YES | YES |
| /api/accounting/* | POST/GET | - | YES | YES | - |
| /api/mental-math/* | POST/GET | - | YES | - | - |
| /api/vocab-quiz/* | POST/GET | - | YES | - | - |
| /api/registrations | POST | YES | - | - | - |
| /api/registrations | GET | - | YES | YES | - |
| /api/registrations/[id] | GET/PATCH | - | YES | YES | - |
| /api/user/access | GET | - | Optional | - | - |
| /api/generate-questions | POST | - | YES | - | - |
| /api/health | GET | YES | - | - | - |
| /api/init-admin | POST | Secret | - | - | - |
| /api/add-fbs-students | POST | - | YES | YES | - |
| /api/migrate-students | POST | - | YES | - | YES |

---

## ERROR CODES

| Code | HTTP | Meaning |
|------|------|---------|
| AUTH_REQUIRED | 401 | No active session |
| ACCESS_DENIED | 403 | Not authorized |
| FBS_ACCESS_REQUIRED | 403 | FBS accessType not set |
| VALIDATION_ERROR | 400 | Request validation failed |
| NOT_FOUND | 404 | Resource not found |
| CONFLICT | 409 | Duplicate email/ID |
| ENV_MISSING | 500 | Missing env vars |

---

## API UTILITY SIGNATURES

### api-utils.ts
```typescript
class ApiException extends Error {
  constructor(message: string, status: number = 500, code?: string)
}
function createErrorResponse(error: unknown): NextResponse
async function validateAuth(): Promise<{ email: string, name?: string }>
function validateEnvironment(): void
async function safeApiHandler<T>(handler: () => Promise<T>): Promise<NextResponse>
```

### email.ts
```typescript
async function sendRegistrationNotification(data: {
  name, email, phone, educationType, programMode,
  selectedMocks?, selectedFullCourses?, mockIntent?, pricing?, referral?
}): Promise<{ success:bool, successful:number, failed:number, total:number } | { success:false, error }>
```

---

## KEY TYPESCRIPT TYPES

### src/types/next-auth.d.ts
Extends Session.user, User, JWT with: role, isAdmin, permissions, studentId, adminId, class, batch, accessTypes, mockAccess

### src/types/results.ts
Test result types: SimpleTestResult, FullTestResult, TestClassStats — define structure of /public/data/*.json files

### src/app/games/fbs-accounting/types.ts
AccountingQuestion, LectureData, QuestionResult, GameState types for the accounting game
