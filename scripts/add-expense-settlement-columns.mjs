// Adds payer + treasury-settlement columns to operational_entries and normalises the one legacy
// misspelt category. Dry-run by default; pass --apply to write.
import { createClient } from '@libsql/client';
import { readFileSync } from 'node:fs';

for (const f of ['.env.local', '.env']) {
  try {
    for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
    }
  } catch {}
}
const apply = process.argv.includes('--apply');
const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

const cols = (await db.execute('PRAGMA table_info(operational_entries)')).rows.map(r => r.name);
const steps = [];
if (!cols.includes('paid_by')) steps.push('ALTER TABLE operational_entries ADD COLUMN paid_by integer REFERENCES users(id)');
if (!cols.includes('reimbursed_at')) steps.push('ALTER TABLE operational_entries ADD COLUMN reimbursed_at text');
steps.push("UPDATE operational_entries SET category='Stationery' WHERE kind='expense' AND category='Stationary Purchase'");

for (const sql of steps) {
  console.log(apply ? 'RUN ' : 'WOULD RUN', sql);
  if (apply) await db.execute(sql);
}
if (!apply) console.log('\nDry run. Re-run with --apply to write.');
