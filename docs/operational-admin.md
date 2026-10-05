# Operational Admin

Open `/admin/operational` from the admin overview, desktop sidebar, or mobile menu.
Only `admin` and `super_admin` roles can access the page or its API; instructor
accounts are excluded. API permissions are checked against the current user record.

## Data

- Instructor Classes counts completed LMS sessions dated through the current time,
  grouped by Bangladesh calendar month. Every month from the earliest completed
  session through the current month is shown. Instructors who are no longer marked
  as teaching remain in the historical report; missing assignments appear as
  **Unassigned**. Scheduled, live, draft, cancelled, and future classes are excluded.
- Expenses and Other Income support adding and editing dated BDT entries. Amounts
  are stored as integer paisa to preserve decimal precision.
- Extra Classes are internal operational records with instructor, subject, start
  and end time, room number, status, and notes. They do not create student-facing
  sessions or contribute to the LMS instructor class counts.

## Storage setup

The new tables are defined in `src/lib/db/schema.ts`. Before using Expenses,
Other Income, or Extra Classes, apply `drizzle/0004_operational_admin.sql` using
the project's database migration process. The migration is registered in
`drizzle/meta/_journal.json` and creates only the two operational tables and their
indexes. It does not alter or backfill existing LMS class records.

The migration was prepared without querying or modifying the live database.
Instructor Classes uses existing LMS tables and does not require the new tables.
