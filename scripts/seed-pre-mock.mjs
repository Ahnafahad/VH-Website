#!/usr/bin/env node
// scripts/seed-pre-mock.mjs — turns the imported `pre-mock` test into the live Pre-Mock:
//   • adds tests.elective_count (additive self-migrate — same effect as `drizzle-kit push` for one nullable column)
//   • marks the test as a mock where students pick 2 of the 3 optional subjects (English is compulsory)
//   • creates the written-part essay series (essay k = the k-th section) and links it
//   • schedules one offline window and publishes
// Run AFTER `node scripts/import-test.mjs <pre-mock.json>` (that creates the draft test with the answer key).
// Idempotent: re-running only fills what is missing.
//
// Usage (from the repo root):
//   NODE_EXTRA_CA_CERTS="../win-roots.pem" node scripts/seed-pre-mock.mjs <pre-mock-essays.json>          # dry run
//   NODE_EXTRA_CA_CERTS="../win-roots.pem" node scripts/seed-pre-mock.mjs <pre-mock-essays.json> --apply            # keeps it draft
//   ... --apply --publish   # only once the elective-aware code is deployed

import fs from 'fs';
import { createClient } from '@libsql/client';

for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
}
const apply = process.argv.includes('--apply');
const publish = process.argv.includes('--publish');
const essaysFile = process.argv.find(a => a.endsWith('.json'));
const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

// Dhaka is UTC+6. Sitting 12:00–14:30 on 2026-11-01; written pages are due when the window closes.
const OPENS = Date.UTC(2026, 10, 1, 6, 0) / 1000;
const CLOSES = Date.UTC(2026, 10, 1, 8, 30) / 1000;
const DEADLINE = CLOSES;

const test = (await db.execute("SELECT id, status, is_mock, essay_series_id FROM tests WHERE slug = 'pre-mock'")).rows[0];
if (!test) { console.error('no `pre-mock` test — run import-test.mjs first'); process.exit(1); }
const hasCol = (await db.execute('PRAGMA table_info(tests)')).rows.some(r => r.name === 'elective_count');
const windows = (await db.execute({ sql: 'SELECT id FROM test_windows WHERE test_id = ?', args: [test.id] })).rows;
const essays = JSON.parse(fs.readFileSync(essaysFile, 'utf8'));
const sections = (await db.execute({ sql: 'SELECT title, total_questions FROM test_sections WHERE test_id = ? ORDER BY "order"', args: [test.id] })).rows;
console.log(`test ${test.id} status=${test.status} mock=${test.is_mock} series=${test.essay_series_id ?? 'none'}`);
console.log(`elective_count column: ${hasCol ? 'present' : 'MISSING (will add)'} · windows: ${windows.length} · essays: ${essays.length} · sections: ${sections.map(s => s.title).join(', ')}`);
if (essays.length !== sections.length) { console.error('essay count must equal section count (essay k = section k)'); process.exit(1); }
if (!apply) { console.log('dry run — pass --apply to write'); process.exit(0); }

if (!hasCol) await db.execute('ALTER TABLE tests ADD COLUMN elective_count integer');

let seriesId = test.essay_series_id;
if (!seriesId) {
  const total = essays.reduce((n, e) => n + e.max, 0);
  const res = await db.execute({
    sql: `INSERT INTO essay_series (title, prompt, essay_date, essay_count, sections, essays, total_marks, product, batch, deadline, status, reminder_sent_at)
          VALUES ('Pre-Mock · Written', '', '2026-11-01', ?, '[]', ?, ?, 'fbs', NULL, ?, 'active', unixepoch())`,
    args: [essays.length, JSON.stringify(essays), total, DEADLINE],
  });
  seriesId = Number(res.lastInsertRowid);
  console.log(`created essay series ${seriesId} (${total} marks across ${essays.length} subjects)`);
}
await db.execute({
  sql: `UPDATE tests SET is_mock = 1, elective_count = 2, allowed_products = '["fbs","fbs_detailed"]',
          total_questions = 60, total_marks = 60, essay_series_id = ?, status = ?, updated_at = unixepoch()
        WHERE id = ?`,
  args: [seriesId, publish ? 'published' : 'draft', test.id],
});
if (windows.length === 0) {
  await db.execute({
    sql: "INSERT INTO test_windows (test_id, mode, opens_at, closes_at, duration_minutes, status) VALUES (?, 'offline', ?, ?, NULL, 'scheduled')",
    args: [test.id, OPENS, CLOSES],
  });
  console.log('created offline window 12:00–14:30 Dhaka, 2026-11-01');
}
console.log(`done — Pre-Mock is ${publish ? 'published' : 'draft'}`);
