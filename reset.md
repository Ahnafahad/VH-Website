# Batch Reset Guide

This guide covers how to end a completed batch and start fresh for the next one.

---

## What "Reset" Means

A batch reset involves:
1. **Archiving** old student data (optional but recommended)
2. **Deleting** all student accounts from the previous batch
3. **Clearing** all game scores and accounting progress
4. **Cleaning up** old registrations
5. **Adding** new students for the incoming batch

Admin accounts are **not touched** — they persist across batches.

---

## Step 0: Prerequisites

- You need a `super_admin` account (only super_admin can delete users)
- Have MongoDB Atlas or direct DB access for bulk operations
- Have the new student list ready (name, email, class, access type)
- Make sure the dev server is NOT the only way to run these — use MongoDB directly for bulk operations

---

## Step 1: Archive Old Data (Optional but Recommended)

Before deleting anything, export the data you want to keep.

### Export via MongoDB Atlas (UI method)

Go to your cluster → Collections → export each collection as JSON or CSV:

- `users` (filter: `role: "student"`) — student list with access info
- `mathscores` — mental math results
- `vocabscores` — vocab quiz results
- `accountingscores` — FBS accounting results
- `accountingprogresses` — mastery data

### Export via mongodump (CLI)

```bash
mongodump \
  --uri="YOUR_MONGODB_URI" \
  --out=./backup-batch-2025 \
  --db=YOUR_DB_NAME
```

Store the backup somewhere safe before proceeding.

---

## Step 2: Delete Old Students

### Option A: Via Admin Panel (one-by-one, slow)

1. Go to `/admin/users`
2. Filter by `batch: "2025"` or `class: "DU-FBS"`
3. Delete each student

Only practical for very small batches.

---

### Option B: Via MongoDB Shell / Atlas (bulk, recommended)

Connect to your database and run:

```js
// Delete all students from the old batch
db.users.deleteMany({
  role: "student",
  batch: "2025"   // change to your batch value
})
```

Or by class:
```js
db.users.deleteMany({
  role: "student",
  class: { $in: ["DU-FBS", "BUP-IBA"] }
})
```

Or delete ALL students (keep admins):
```js
db.users.deleteMany({ role: "student" })
```

**Safety check before deleting** — count first:
```js
db.users.countDocuments({ role: "student", batch: "2025" })
```

---

## Step 3: Clear Game Scores

All scores are tied to `playerEmail`. After removing students, their historical scores remain in the collections until cleared. Clear them if you want a clean leaderboard.

### Clear all scores (full reset)

```js
db.mathscores.deleteMany({})
db.vocabscores.deleteMany({})
db.accountingscores.deleteMany({})
db.accountingprogresses.deleteMany({})
```

### Clear scores for specific students only

```js
const oldEmails = ["student1@gmail.com", "student2@gmail.com"] // etc.

db.mathscores.deleteMany({ playerEmail: { $in: oldEmails } })
db.vocabscores.deleteMany({ playerEmail: { $in: oldEmails } })
db.accountingscores.deleteMany({ playerEmail: { $in: oldEmails } })
db.accountingprogresses.deleteMany({ playerEmail: { $in: oldEmails } })
```

### Clear scores for an entire batch (by email lookup)

```js
// Get all student emails from old batch
const oldStudentEmails = db.users.distinct("email", { role: "student", batch: "2025" })

// Then delete their scores
db.mathscores.deleteMany({ playerEmail: { $in: oldStudentEmails } })
db.vocabscores.deleteMany({ playerEmail: { $in: oldStudentEmails } })
db.accountingscores.deleteMany({ playerEmail: { $in: oldStudentEmails } })
db.accountingprogresses.deleteMany({ playerEmail: { $in: oldStudentEmails } })
```

Run this **before** Step 2 (deleting users) if you want to use the email list from the `users` collection.

---

## Step 4: Clean Up Registrations

Old registrations (from the public sign-up form) pile up. Clean them up:

```js
// Archive: mark old ones as cancelled (soft approach)
db.registrations.updateMany(
  { status: { $in: ["pending", "contacted"] } },
  { $set: { status: "cancelled", notes: "Batch 2025 ended" } }
)

// Or hard delete all non-pending registrations
db.registrations.deleteMany({ status: { $in: ["enrolled", "cancelled"] } })

// Or nuke everything
db.registrations.deleteMany({})
```

---

## Step 5: Add New Students

### Option A: Bulk import via API — POST `/api/add-fbs-students`

```json
POST /api/add-fbs-students
{
  "students": [
    { "studentId": "1234567", "name": "Rahim Uddin", "email": "rahim@gmail.com" },
    { "studentId": "1234568", "name": "Karim Ali",   "email": "karim@gmail.com" }
  ],
  "accessType": "DU FBS"
}
```

Creates users with:
- `role: "student"`
- `accessTypes.FBS: true`
- `class: "DU FBS"`

Repeat for each access type (`"BUP FBS"`, etc.).

---

### Option B: One-by-one via Admin Panel

1. Go to `/admin/users` → Create User
2. Fill in email, name, role = student, class, batch, access types
3. Repeat for each student

---

### Option C: Bulk insert directly into MongoDB

Prepare a JSON array and insert:

```js
db.users.insertMany([
  {
    email: "rahim@gmail.com",
    name: "Rahim Uddin",
    role: "student",
    class: "DU-FBS",
    batch: "2026",
    accessTypes: { IBA: false, FBS: true },
    mockAccess: { duIba: false, bupIba: false, duFbs: false, bupFbs: false, fbsDetailed: false },
    permissions: ["read"],
    active: true,
    roleNumbers: [],
    addedDate: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  },
  // ... more students
])
```

---

## Step 6: Verify

After the reset, confirm everything looks right:

```js
// Count by role
db.users.countDocuments({ role: "student" })   // should be new batch count
db.users.countDocuments({ role: "admin" })     // should be same as before
db.users.countDocuments({ role: "super_admin" }) // should be same as before

// Check scores are cleared
db.mathscores.countDocuments({})
db.vocabscores.countDocuments({})
db.accountingscores.countDocuments({})
db.accountingprogresses.countDocuments({})

// Check a new student exists and is active
db.users.findOne({ email: "rahim@gmail.com" })
```

---

## Step 7: Test Login

1. Ask a new student to try signing in with Google
2. Confirm they land on the correct access-gated page
3. Confirm old students cannot sign in (they should hit `/auth/error`)

---

## What NOT to Reset

- **Admin accounts** (`role: "admin"` or `"super_admin"`) — keep these
- **`access-control.json`** — keep this unless you're changing admins
- **Env variables** — no changes needed
- **Codebase / deployed app** — no redeploy needed for a student reset

---

## Quick Reference: Full Clean Reset (Danger Zone)

Run these in order on your MongoDB database if you want a completely clean slate for students only:

```js
// 1. Save emails before deleting users (for score cleanup)
const emails = db.users.distinct("email", { role: "student" })

// 2. Delete scores
db.mathscores.deleteMany({ playerEmail: { $in: emails } })
db.vocabscores.deleteMany({ playerEmail: { $in: emails } })
db.accountingscores.deleteMany({ playerEmail: { $in: emails } })
db.accountingprogresses.deleteMany({ playerEmail: { $in: emails } })

// 3. Delete students
db.users.deleteMany({ role: "student" })

// 4. Clear registrations
db.registrations.deleteMany({})
```

Admins are untouched. Now import the new batch via `/api/add-fbs-students` or admin panel.

---

## Troubleshooting

**New student can't sign in after being added**
- Check `active: true` in their user document
- Check their email matches their Google account exactly (case-insensitive)
- The 60s access control cache may still hold old data — wait 60 seconds and retry
- Check `accessTypes` and `mockAccess` are set correctly

**Old student can still sign in after deletion**
- Their JWT session is still alive (valid up to 24h)
- Nothing to do — they won't be able to sign in again after session expiry
- If urgent: change their Google account email or ask them to sign out

**Scores still showing on leaderboard for deleted students**
- You forgot to clear scores before deleting users
- Delete by email directly: `db.mathscores.deleteMany({ playerEmail: "..." })`

**Bulk insert via API gives duplicate key error**
- A student with that email or studentId already exists
- Check with: `db.users.findOne({ email: "..." })`
- Delete the existing entry first or skip that student
