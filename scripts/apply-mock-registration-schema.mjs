/**
 * Creates the mock_registrations table (idempotent, additive). Dry-run by default; pass --apply.
 *   $env:NODE_EXTRA_CA_CERTS='D:\VH Website\win-roots.pem'; node scripts/apply-mock-registration-schema.mjs [--apply]
 */
import { createClient } from '@libsql/client';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const envPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', '.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim();
    const i = t.indexOf('=');
    if (t && !t.startsWith('#') && i > 0) process.env[t.slice(0, i).trim()] ??= t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
}
const apply = process.argv.includes('--apply');
const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS mock_registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    phone TEXT NOT NULL,
    trx_id TEXT,
    screenshot_key TEXT,
    status TEXT NOT NULL DEFAULT 'registered',
    note TEXT,
    vocab_granted INTEGER NOT NULL DEFAULT 0,
    access_until INTEGER,
    submitted_at INTEGER,
    decided_at INTEGER,
    decided_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  )`,
  `CREATE INDEX IF NOT EXISTS idx_mock_reg_status ON mock_registrations(status)`,
];
for (const sql of STATEMENTS) {
  if (apply) { await db.execute(sql); console.log('+', sql.split('\n')[0]); }
  else console.log('(dry-run)', sql.split('\n')[0]);
}
console.log(apply ? 'mock registration schema applied' : 'dry-run only — re-run with --apply');
