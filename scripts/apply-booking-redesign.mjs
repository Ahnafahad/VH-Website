#!/usr/bin/env node
// scripts/apply-booking-redesign.mjs — additive schema change for the 1-on-1
// session request redesign + seeds which product(s) each instructor teaches.
//
// Applied as plain additive SQL (not drizzle-kit push) because of the journal
// desync described in the db-schema-change skill. Idempotent: every step
// checks first, so it is safe to re-run.
//
//   node scripts/apply-booking-redesign.mjs            # dry run (default): prints the plan
//   node scripts/apply-booking-redesign.mjs --apply    # writes to Turso
//
// Needs .env.local (TURSO_DATABASE_URL / TURSO_AUTH_TOKEN) and, locally,
//   NODE_EXTRA_CA_CERTS="D:\VH Website\win-roots.pem"

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@libsql/client';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APPLY = process.argv.includes('--apply');

for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

// Columns added to session_requests. SQLite ADD COLUMN needs constant defaults.
const COLUMNS = [
  ['preferred_times', "TEXT NOT NULL DEFAULT '[]'"],
  ['proposals', "TEXT NOT NULL DEFAULT '[]'"],
  ['instructor_id', 'INTEGER REFERENCES users(id) ON DELETE SET NULL'],
  ['mode', 'TEXT'],
  ['location', 'TEXT'],
  ['start_at', 'INTEGER'],
  ['end_at', 'INTEGER'],
  ['meet_link', 'TEXT'],
  ['google_event_id', 'TEXT'],
  ['updated_at', 'INTEGER'],
];

// Who teaches what (confirmed by the user 2026-10-30). Keyed by users.id.
const TAGS = {
  2: ['iba', 'fbs'],   // Hasan
  13: ['iba', 'fbs'],  // Ahnaf Ahad
  22: ['iba'],         // Zayan Rahman
  78: ['iba'],         // Sidratul Muntaha Hossain
  10: ['fbs'],         // Habibur Rahman
  8: ['fbs'],          // Kaif Kabir
  20: ['fbs'],         // Tarannum Rashid
  15: ['fbs'],         // Rahmi Tasnim
};

async function run(sql, args = []) {
  if (!APPLY) { console.log('  [dry-run]', sql.replace(/\s+/g, ' ').slice(0, 140), args.length ? JSON.stringify(args) : ''); return; }
  await db.execute({ sql, args });
}

console.log(APPLY ? 'APPLY mode' : 'DRY RUN (pass --apply to write)');

const info = await db.execute('PRAGMA table_info(session_requests)');
const have = new Set(info.rows.map((r) => String(r.name)));
for (const [name, ddl] of COLUMNS) {
  if (have.has(name)) { console.log(`= session_requests.${name} exists`); continue; }
  console.log(`+ session_requests.${name}`);
  await run(`ALTER TABLE session_requests ADD COLUMN ${name} ${ddl}`);
}

await run(`CREATE TABLE IF NOT EXISTS instructor_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product TEXT NOT NULL
)`);
await run('CREATE UNIQUE INDEX IF NOT EXISTS uq_instructor_products ON instructor_products (user_id, product)');
await run('CREATE INDEX IF NOT EXISTS idx_sreq_status_product ON session_requests (status, product)');

for (const [uid, products] of Object.entries(TAGS)) {
  const u = await db.execute({ sql: 'SELECT id, name FROM users WHERE id = ?', args: [Number(uid)] });
  if (u.rows.length === 0) { console.log(`! no user #${uid} — skipped`); continue; }
  const { id, name } = u.rows[0];
  for (const product of products) {
    console.log(`+ ${name} (#${id}) → ${product}`);
    await run('INSERT OR IGNORE INTO instructor_products (user_id, product) VALUES (?, ?)', [id, product]);
  }
}

console.log('done');
process.exit(0);
