#!/usr/bin/env node
// scripts/seed-ss-workbook.mjs — adds essay_series.is_workbook (self-migrate, additive) and creates
// the "SS Workbook" series: 30 IBA essay prompts (+ hints) from the Essay Workbook PDF, of which a
// student submits any one. Seeded published with a far-future deadline so results show once graded.
// Idempotent: skips the column if present, skips the insert if a workbook series already exists.
//
// Usage (from vh-website/):
//   NODE_EXTRA_CA_CERTS="../win-roots.pem" node scripts/seed-ss-workbook.mjs            # dry run
//   NODE_EXTRA_CA_CERTS="../win-roots.pem" node scripts/seed-ss-workbook.mjs --apply [--max=10] [--archived]

import fs from 'fs';
import { createClient } from '@libsql/client';

for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
}
const apply = process.argv.includes('--apply');
const max = Number(process.argv.find(a => a.startsWith('--max='))?.slice(6) ?? 10);
const status = process.argv.includes('--archived') ? 'archived' : 'active'; // archived = hidden from students
const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

const cols = (await db.execute('PRAGMA table_info(essay_series)')).rows.map(r => r.name);
const hasCol = cols.includes('is_workbook');
console.log(`is_workbook column: ${hasCol ? 'present' : 'MISSING (will add)'}`);
const existing = hasCol ? (await db.execute('SELECT id FROM essay_series WHERE is_workbook = 1')).rows : [];
console.log(`existing workbook series: ${existing.length ? existing.map(r => r.id).join(',') : 'none'}`);
const others = (await db.execute('SELECT id, title, product, batch, essays FROM essay_series ORDER BY id DESC LIMIT 4')).rows;
for (const o of others) console.log(`  series ${o.id} "${o.title}" ${o.product}/${o.batch} essays=${String(o.essays).slice(0, 80)}`);

const prompts = JSON.parse(fs.readFileSync('scripts/data/ss-workbook-prompts.json', 'utf8'));
const essays = prompts.map(p => ({ prompt: p.prompt, hint: p.hint, max }));
console.log(`will create: ${essays.length} essays, max ${max} each (total ${essays.length * max})`);
if (!apply) { console.log('dry run — pass --apply to write'); process.exit(0); }

if (!hasCol) await db.execute('ALTER TABLE essay_series ADD COLUMN is_workbook integer NOT NULL DEFAULT 0');
if (existing.length) { console.log('workbook already exists — nothing to insert'); process.exit(0); }
const now = Math.floor(Date.now() / 1000);
await db.execute({
  sql: `INSERT INTO essay_series (title, prompt, essay_count, sections, essays, total_marks, product, batch, deadline, status, published_at, is_workbook)
        VALUES ('SS Workbook', '', ?, '[]', ?, ?, 'iba', NULL, ?, ?, ?, 1)`,
  args: [essays.length, JSON.stringify(essays), essays.length * max, 4102444800, status, now],
});
console.log(`created SS Workbook series (${status})`);
