# Sync Role Numbers to Database

## Problem
When Aseya (and other FBS students) log in, they don't see their FBS mock results because:
- `students.json` has both 6-digit and 7-digit IDs ✅
- Database User.roleNumbers only has 6-digit IDs ❌
- `/api/user/access` returns incomplete roleNumbers from database

## Solution
Run this script to sync roleNumbers from students.json to the database:

```bash
MONGODB_URI="your-production-mongodb-uri" node scripts/sync-role-numbers.js
```

Replace `your-production-mongodb-uri` with the same MongoDB connection string you used for `sync-student-emails.js`.

## What It Does
1. Reads all student entries from `public/data/students.json`
2. Groups students by their unique ID
3. For each student, collects ALL their ID formats (e.g., `['934245', '9342451']`)
4. Updates the database User.roleNumbers to include both IDs

## Example Output
```
🔢 Syncing Role Numbers from students.json to Database...

Found 35 unique students with multiple ID formats

  ✏️  Updating roleNumbers for Aseya Siddiqua Saba
     Current: [934245]
     Adding: [9342451]
     New: [934245, 9342451]

✅ Updated roleNumbers for 11 students

✨ Done!
```

## After Running
Once the script completes:
1. Aseya (and other FBS students) will be able to see their FBS mock results when they log in
2. Admin view will also work correctly
3. Both 6-digit and 7-digit IDs will work for lookups

## Verification
After running the script, test by:
1. Having Aseya log in with `aseyasiddiqua30@gmail.com`
2. Navigate to Results → DU FBS Mocks
3. She should see her results:
   - DU FBS Mock 1: 63 marks, Rank 7
   - DU FBS Mock 2: 52.5 marks, Rank 11
