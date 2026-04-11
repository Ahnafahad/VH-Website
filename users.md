# User Management — VH Website

## Table of Contents
1. [Data Structures](#1-data-structures)
2. [How Users Are Created](#2-how-users-are-created)
3. [Access Control System](#3-access-control-system)
4. [Roles & Permissions](#4-roles--permissions)
5. [Authentication & Session Flow](#5-authentication--session-flow)
6. [Scores & Progress Tracking](#6-scores--progress-tracking)
7. [Admin API Endpoints](#7-admin-api-endpoints)
8. [Step-by-Step Workflows](#8-step-by-step-workflows)
9. [Critical Gotchas](#9-critical-gotchas)

---

## 1. Data Structures

### 1.1 User (`users` collection)

The core document for every authenticated person in the system.

| Field | Type | Notes |
|-------|------|-------|
| `email` | string | Required, unique, lowercase, indexed |
| `name` | string | Required, trimmed |
| `role` | enum | `super_admin` \| `admin` \| `student` (default: `student`) |
| `adminId` | string? | Sparse unique, for admins |
| `studentId` | string? | Sparse unique, 6–7 digit format |
| `roleNumbers` | string[] | Array of 6–7 digit IDs (default `[]`) |
| `class` | string? | e.g. `"DU-FBS"`, `"BUP-IBA"` |
| `batch` | string? | e.g. `"2025"`, `"2026"` |
| `accessTypes.IBA` | boolean | Grants `duIba` + `bupIba` mock access |
| `accessTypes.FBS` | boolean | Grants `duFbs` + `bupFbs` mock access |
| `mockAccess.duIba` | boolean | Individual DU IBA mock access |
| `mockAccess.bupIba` | boolean | Individual BUP IBA mock access |
| `mockAccess.duFbs` | boolean | Individual DU FBS mock access |
| `mockAccess.bupFbs` | boolean | Individual BUP FBS mock access |
| `mockAccess.fbsDetailed` | boolean | Premium FBS detailed (no group grant path) |
| `permissions` | string[] | `["read"]` default. Valid: `read`, `write`, `admin`, `manage_users` |
| `active` | boolean | `true` = can log in. `false` = blocked |
| `addedDate` | Date | When the user was added |
| `createdAt` | Date | Indexed `-1` (newest first) |
| `updatedAt` | Date | Auto-updated on every save |

**Computed Virtual** (`computedMockAccess`):
```
duIba  = mockAccess.duIba  || accessTypes.IBA
bupIba = mockAccess.bupIba || accessTypes.IBA
duFbs  = mockAccess.duFbs  || accessTypes.FBS
bupFbs = mockAccess.bupFbs || accessTypes.FBS
```
So `accessTypes.IBA = true` gives both IBA mocks automatically.

**MongoDB Indexes**:
- `{ email: 1, active: 1 }` (compound)
- `{ studentId: 1 }` (sparse)
- `{ adminId: 1 }` (sparse)
- `{ role: 1, active: 1 }` (compound)
- `{ createdAt: -1 }` (for newest-first listing)

---

### 1.2 Registration (`registrations` collection)

Public sign-up form submissions. **These are NOT users** — admin must manually promote them.

| Field | Type | Notes |
|-------|------|-------|
| `name`, `email`, `phone` | string | Required |
| `educationType` | enum | `hsc` \| `alevels` |
| `programMode` | enum | `mocks` \| `full` |
| `selectedMocks` | string[]? | `du-iba`, `bup-iba`, `du-fbs`, `bup-fbs`, `fbs-detailed` |
| `mockIntent` | enum? | `trial` \| `full` |
| `selectedFullCourses` | string[]? | `du-iba-full`, `bup-iba-fbs-full` |
| `status` | enum | `pending` \| `contacted` \| `enrolled` \| `cancelled` (default: `pending`) |
| `pricing` | object? | `subtotal`, `discount`, `finalPrice` |
| `referral` | object? | name, institution, batch |
| `notes` | string? | Admin notes |

---

### 1.3 Score & Progress Collections

| Collection | Purpose | Key Fields |
|-----------|---------|-----------|
| `mathscores` | Mental math game results | `playerEmail`, `score`, `difficulty`, `operations[]`, `playedAt`, `isAdmin` |
| `vocabscores` | Vocab quiz game results | `playerEmail`, `questionsAnswered`, `questionsCorrect`, `difficulty`, `playedAt`, `isAdmin` |
| `accountingscores` | FBS accounting game results | `playerEmail`, `simpleScore`, `dynamicScore`, `selectedLectures[]`, `timeTaken`, `playedAt`, `isAdmin` |
| `accountingprogresses` | Per-student mastery (unique per email) | `playerEmail` (unique), `masteredQuestions` (Set), `lectureProgress` (Map), `totalMastered` |

**`accountingprogresses` detail**:
- One document per FBS student (unique by `playerEmail`)
- `masteredQuestions` = Set of question IDs like `"lecture1_q1"`, `"lecture3_q15"`
- One correct answer = question mastered forever (no decay)
- `lectureProgress[N]` = `{ totalQuestions, masteredCount, completionCount, lastPlayed }`
- Total possible questions = 281

---

## 2. How Users Are Created

### Method A: Admin Panel — POST `/api/admin/users` ✅ (Recommended)

The primary way to add any user. Requires admin session.

**Request body:**
```json
{
  "email": "student@example.com",
  "name": "Rahim Uddin",
  "role": "student",
  "studentId": "1234567",
  "class": "DU-FBS",
  "batch": "2026",
  "accessTypes": { "IBA": false, "FBS": true },
  "mockAccess": {
    "duIba": false, "bupIba": false,
    "duFbs": false, "bupFbs": false, "fbsDetailed": false
  },
  "permissions": ["read"],
  "active": true
}
```

- Email is normalized to lowercase before insert
- Duplicate `email`, `studentId`, or `adminId` causes a 409 error
- `studentId` must match `/^[0-9]{6,7}$/` if provided
- After creation, `clearAccessControlCache()` is called (60s cache invalidated)

---

### Method B: Bulk FBS Student Import — POST `/api/add-fbs-students`

For adding many students at once.

```json
{
  "students": [
    { "studentId": "1234567", "name": "Student A", "email": "a@gmail.com" },
    { "studentId": "1234568", "name": "Student B", "email": "b@gmail.com" }
  ],
  "accessType": "DU FBS"
}
```

Creates users with `role: "student"`, `accessTypes.FBS: true`, `class: accessType`.

---

### Method C: Self-Registration → Manual Enrollment

1. Student submits form at `/register` → creates a `Registration` document
2. Admin reviews at `/admin/registrations`
3. Admin manually creates `User` via Method A
4. Registration `status` updated to `"enrolled"`

There is **no automatic promotion** from Registration to User.

---

### Method D: Init Admin Bootstrap — POST `/api/init-admin` (one-time only)

```json
{ "secret": "YOUR_INIT_ADMIN_SECRET" }
```

Creates the two hardcoded super_admin accounts. Fails if any users already exist in DB. Use only on a fresh database.

---

### Method E: BROKEN — POST `/api/admin/grant-access` ❌

**Do not use in production.** This endpoint tries to write to `access-control.json` on disk, which silently fails on Vercel (read-only filesystem). Returns 200 OK but does nothing. Use Method A instead.

---

## 3. Access Control System

### Dual-Layer Architecture

The system uses **two separate stores**:

| Layer | Store | Speed | Who it covers |
|-------|-------|-------|---------------|
| Layer 1 | `access-control.json` (build-time) | Fastest (in-memory) | Admins only |
| Layer 2 | MongoDB `users` collection | Slower (DB query) | All users |

**Lookup priority on every sign-in and session refresh:**
```
Cache hit (< 60s)? → Return cached result
↓
Check adminsFromJson[] (linear scan by email) → Found? Return it
↓
Query MongoDB User model by email and active:true → Found? Return it
↓
Return null → access denied
```

If the same email exists in both JSON (as admin) and DB (as student), **JSON wins** — the student gets admin access. Avoid this.

---

### 60-Second Cache

- In-memory `Map` in `db-access-control.ts`
- Expires 60 seconds after population
- **Invalidated immediately** when admin calls any update endpoint (`clearAccessControlCache()`)
- If cache expires and MongoDB is down → login fails (no fallback)

---

### Granting Access

**At creation time**: set `accessTypes` and/or `mockAccess` fields in POST body.

**After creation**: PATCH `/api/admin/users`:
```json
{
  "userId": "ObjectId...",
  "accessTypes": { "IBA": true },
  "mockAccess": { "fbsDetailed": true }
}
```

Access type logic:
- `accessTypes.IBA = true` → auto-grants `duIba` + `bupIba`
- `accessTypes.FBS = true` → auto-grants `duFbs` + `bupFbs`
- `mockAccess.fbsDetailed = true` → only granular, no group path

---

### Revoking Access

**Deactivate** (user stays in DB, can't log in):
```json
{ "userId": "...", "active": false }
```

**Delete** (permanent, `super_admin` only):
```
DELETE /api/admin/users?userId=...
```

Cannot delete `super_admin` accounts via this endpoint.

**Important**: Existing sessions remain valid for up to 24h after deactivation (no JWT revocation). The user will be blocked on their next sign-in attempt.

---

## 4. Roles & Permissions

### Role Hierarchy
```
super_admin  ──▶  Full access, can delete users, cannot be deleted by admins
     │
    admin  ──▶  User CRUD (except super_admins), view all results, manage registrations
     │
  student  ──▶  Play games, view own results only
```

### Permission Strings

`permissions: ["read", "write", "admin", "manage_users"]`

These are stored but **not formally enforced** in middleware — mostly informational. Role is what gates access in practice.

### Adding a New Admin

**Option 1 — JSON (build-time, fast-path):**
1. Edit `access-control.json`, add entry to `admins[]`:
   ```json
   {
     "id": "admin_007",
     "name": "New Admin",
     "email": "newadmin@gmail.com",
     "role": "admin",
     "permissions": ["read", "write", "admin"],
     "addedDate": "2026-04-02",
     "active": true
   }
   ```
2. Run `npm run generate:access-control` locally
3. Commit and deploy → admin is live at build

**Option 2 — DB only (no redeploy needed):**
```json
POST /api/admin/users
{
  "email": "newadmin@gmail.com",
  "name": "New Admin",
  "role": "admin",
  "permissions": ["read", "write", "admin"]
}
```
Works immediately, but admin is not in JSON fast-path (DB query on every cache miss).

---

## 5. Authentication & Session Flow

### Sign-In

```
Google OAuth  →  auth.ts signIn callback
                  └─ isEmailAuthorized(email)
                       └─ getCachedUser(email)  [cache → JSON → DB]
                  └─ false → /auth/error (blocked)
                  └─ true → continue

                ↓

JWT callback  (runs ONCE on first login)
  └─ getUserByEmail(email)
  └─ Stores: role, permissions, accessTypes, mockAccess in JWT token
  └─ Token embedded in HTTP-only cookie

                ↓

Session callback  (runs on EVERY request)
  └─ getUserByEmail(email)  [re-queries DB each time, 60s cached]
  └─ Enriches session.user with latest data from DB
```

### Session Shape

```typescript
session.user = {
  email: string,       // lowercase
  name: string,
  role: "student" | "admin" | "super_admin",  // from JWT (stale after first login)
  isAdmin: boolean,
  permissions: string[],
  studentId?: string,
  adminId?: string,
  class?: string,
  batch?: string,
  accessTypes: { IBA: boolean, FBS: boolean },
  mockAccess: { duIba, bupIba, duFbs, bupFbs, fbsDetailed: boolean }
}
```

### Role Change Warning

JWT is populated **once** at first login. If you change a user's role in the DB, they must **log out and log back in** for the JWT role to update. The `session.user` fields (not role) do refresh on every request because the session callback re-queries DB.

---

## 6. Scores & Progress Tracking

All score models store `playerEmail` (indexed, lowercase) and `isAdmin` (admin scores are excluded from leaderboards and **not actually saved** — admin game submissions return success but discard the score).

### Leaderboards

**Mental Math**:
- Individual: best score per email
- Accumulated: sum of all scores per email

**Vocab Quiz**:
- Top 10 by total questions answered (aggregate)

**Accounting**:
- Singular: max `dynamicScore` per email
- Cumulative: sum of `dynamicScore` per email

### Accounting Mastery

`accountingprogresses` is unique per student (one document per email). It tracks:
- Which questions a student has answered correctly (never decays)
- Adaptive difficulty selects from unmastered questions first

**Critical**: Question IDs must follow `lectureN_qM` format. If this format changes in the source data, mastery tracking breaks silently with no error.

---

## 7. Admin API Endpoints

### User Management

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/admin/users` | Admin | List users. Query params: `role`, `active`, `search`, `batch`, `class` |
| POST | `/api/admin/users` | Admin | Create user |
| PATCH | `/api/admin/users` | Admin | Update user fields |
| DELETE | `/api/admin/users?userId=...` | SuperAdmin | Delete user (not super_admins) |

### Access & Sync

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/admin/sync-admins` | Session | Sync access-control.json admins to MongoDB |
| POST | `/api/admin/sync-role-numbers` | Admin | Sync students.json roleNumbers to DB |
| GET/PATCH | `/api/admin/grant-access` | Admin | **BROKEN IN PROD** — do not use |

### Other

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/user/access` | Optional | Returns `{ hasIBA, hasFBS, isAdmin, roleNumbers }` for current session |
| POST | `/api/add-fbs-students` | Admin | Bulk create FBS students |
| POST | `/api/init-admin` | Secret | Bootstrap super_admins (one-time, empty DB only) |

---

## 8. Step-by-Step Workflows

### Onboard a New Student

1. Student fills `/register` → Registration created in DB
2. Admin reviews at `/admin/registrations`
3. Admin clicks Enroll → status set to `enrolled`
4. Admin goes to `/admin/users` → Create user:
   ```json
   {
     "email": "student@gmail.com",
     "name": "Karim Hossain",
     "role": "student",
     "class": "DU-FBS",
     "batch": "2026",
     "accessTypes": { "FBS": true },
     "active": true
   }
   ```
5. Student signs in via Google → access granted immediately

---

### Deactivate a Student

1. Admin opens `/admin/users`, find student
2. PATCH: `{ "userId": "...", "active": false }`
3. Student blocked on next login. Existing sessions last up to 24h.

---

### Give a Student Additional Mock Access

```json
PATCH /api/admin/users
{
  "userId": "...",
  "mockAccess": { "fbsDetailed": true }
}
```

---

## 9. Critical Gotchas

| # | Gotcha |
|---|--------|
| 1 | `/api/admin/grant-access` is **broken in production** (Vercel read-only FS). Use `/api/admin/users` POST. |
| 2 | JWT role is **stale after first login**. Role changes require user to re-login. |
| 3 | Deactivating a user does **not kill existing sessions** — 24h grace window. |
| 4 | Admin scores are **silently discarded** (not saved to DB). |
| 5 | No server-side score validation — **leaderboards trust client-submitted numbers**. |
| 6 | No rate limiting on any endpoint. |
| 7 | `auth.ts` callbacks have **no try-catch** — MongoDB outage = 100% login outage. |
| 8 | Accounting question IDs **must be `lectureN_qM` format** or mastery tracking silently breaks. |
| 9 | `INIT_ADMIN_SECRET` defaults to `'your-secret-key-change-this'` if env not set. |
| 10 | If email exists in both JSON (admin) and DB (student), **JSON takes priority** — student gets admin access. |

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/lib/auth.ts` | NextAuth config, signIn/jwt/session callbacks |
| `src/lib/db-access-control.ts` | Cache + hybrid lookup engine |
| `src/lib/models/User.ts` | User Mongoose schema |
| `src/lib/models/Registration.ts` | Registration form schema |
| `src/lib/models/AccountingProgress.ts` | Mastery tracking schema |
| `src/app/api/admin/users/route.ts` | User CRUD API |
| `access-control.json` | Static admin list (build-time) |
| `src/lib/generated-access-control.ts` | Auto-generated from access-control.json |
