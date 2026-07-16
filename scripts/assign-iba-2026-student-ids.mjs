/**
 * Backfill: assign a random unique 6-digit student ID to every IBA 2026-27
 * student who doesn't already have one.
 *
 * Uniqueness rule (matches src/lib/students/assign-student-id.ts):
 *   - genuine 6-digit number (100000..999999, no leading zero)
 *   - last 5 digits unique across ALL students, so dropping the leading digit
 *     still leaves every ID distinct.
 *
 * Idempotent: students that already have a student_id are skipped, and their
 * last-5 values seed the "used" set so re-runs never collide.
 *
 * Run:  NODE_EXTRA_CA_CERTS="D:/VH Website/win-roots.pem" node scripts/assign-iba-2026-student-ids.mjs
 */
import { createClient } from '@libsql/client';

const client = createClient({
  url: 'libsql://vh-beyond-the-horizon-ahnafahad.aws-ap-south-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzUxNDUzODYsImlkIjoiMDE5ZDRjZGQtZmMwMS03Njc2LTkwODItNjUxYjlhMWUzMTVhIiwicmlkIjoiMjAxZGQ5ZDktYTEwYi00ZTA4LTg3ODgtMWMyMmRmZmMyODgxIn0.vw7b-JVuzAts5PP4rzgMwhKV-XRVLkXl_Lxfta5YUgtbUORsiHqFU6Tkb0Ll_D4L4tKeAM-lxF5e-OT_McZ_Aw',
});

const DRY_RUN = process.argv.includes('--dry-run');

const last5 = (sid) => (/^\d{5,6}$/.test(sid) ? Number(sid) % 100000 : null);

function generateStudentId(usedLast5) {
  for (let i = 0; i < 10000; i++) {
    const n = 100000 + Math.floor(Math.random() * 900000); // 100000..999999
    if (!usedLast5.has(n % 100000)) return String(n);
  }
  throw new Error('Unable to generate a unique student ID');
}

// Seed used last-5 set from every existing student_id in the table.
const usedLast5 = new Set();
const all = await client.execute(`SELECT student_id FROM users WHERE student_id IS NOT NULL`);
for (const r of all.rows) {
  const l5 = last5(r.student_id);
  if (l5 !== null) usedLast5.add(l5);
}

// Cohort: batch '2026-27' with active iba access, no student_id yet.
const cohort = await client.execute(`
  SELECT u.id, u.name, u.email
  FROM users u
  JOIN user_access a ON a.user_id = u.id AND a.product = 'iba' AND a.active = 1
  WHERE u.batch = '2026-27' AND u.student_id IS NULL
  ORDER BY u.name
`);

console.log(`IBA 2026-27 students needing an ID: ${cohort.rows.length}`);
console.log(`Existing IDs already in use (seeded): ${usedLast5.size}`);
console.log(DRY_RUN ? '\n[DRY RUN — no writes]\n' : '');

const assigned = [];
for (const s of cohort.rows) {
  const sid = generateStudentId(usedLast5);
  usedLast5.add(Number(sid) % 100000);
  if (!DRY_RUN) {
    await client.execute({
      sql: `UPDATE users SET student_id = ?, updated_at = unixepoch() WHERE id = ? AND student_id IS NULL`,
      args: [sid, s.id],
    });
  }
  assigned.push({ id: s.id, sid, name: s.name, email: s.email });
  console.log(`  ${sid}   ${s.name}  <${s.email}>`);
}

// Verify: every IBA 2026-27 student now has an ID, all IDs unique, and all
// last-5 forms unique across the whole users table.
const verify = await client.execute(`
  SELECT u.id, u.name, u.student_id
  FROM users u
  JOIN user_access a ON a.user_id = u.id AND a.product = 'iba' AND a.active = 1
  WHERE u.batch = '2026-27'
  ORDER BY u.name
`);
const allIds = await client.execute(`SELECT student_id FROM users WHERE student_id IS NOT NULL`);

const missing = verify.rows.filter((r) => !r.student_id);
const fullVals = allIds.rows.map((r) => r.student_id);
const last5Vals = fullVals.map(last5).filter((v) => v !== null);
const fullDupes = fullVals.length - new Set(fullVals).size;
const last5Dupes = last5Vals.length - new Set(last5Vals).size;

console.log(`\n=== VERIFY ===`);
console.log(`  IBA 2026-27 students: ${verify.rows.length}, missing an ID: ${missing.length}`);
console.log(`  Total IDs in table: ${fullVals.length}, full-value duplicates: ${fullDupes}`);
console.log(`  Last-5 duplicates (reduced-form uniqueness): ${last5Dupes}`);
console.log(missing.length === 0 && fullDupes === 0 && last5Dupes === 0
  ? (DRY_RUN ? '  DRY RUN OK (nothing written)' : '  ✅ ALL GOOD')
  : '  ⚠️  CHECK FAILED');
