/**
 * Mock exams schema additions (idempotent, additive only — no table rewrites):
 *   tests.{is_mock, mock_batch, exam_code, essay_series_id, solution_pdf_key}
 *   test_attempts.result_source
 * Dry-run by default; pass --apply to write. Run from vh-website/:
 *   $env:NODE_EXTRA_CA_CERTS='D:\VH Website\win-roots.pem'; node scripts/apply-mock-schema.mjs [--apply]
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

const ADDITIONS = [
  ['tests', 'is_mock', 'INTEGER NOT NULL DEFAULT 0'],
  ['tests', 'mock_batch', 'TEXT'],
  ['tests', 'exam_code', 'TEXT'],
  ['tests', 'essay_series_id', 'INTEGER'],
  ['tests', 'solution_pdf_key', 'TEXT'],
  ['test_attempts', 'result_source', "TEXT NOT NULL DEFAULT 'self'"],
];

for (const [table, col, ddl] of ADDITIONS) {
  const have = (await db.execute(`PRAGMA table_info(${table})`)).rows.map(r => r.name);
  if (have.includes(col)) { console.log(`= ${table}.${col} already present`); continue; }
  const sql = `ALTER TABLE ${table} ADD COLUMN ${col} ${ddl}`;
  if (apply) { await db.execute(sql); console.log(`+ ${sql}`); }
  else console.log(`(dry-run) ${sql}`);
}
console.log(apply ? 'mock schema applied' : 'dry-run only — re-run with --apply');
