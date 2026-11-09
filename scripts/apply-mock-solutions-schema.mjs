/**
 * Adds the mock_solutions table (idempotent, additive). Dry-run by default; pass --apply to write.
 *   $env:NODE_EXTRA_CA_CERTS='D:\VH Website\win-roots.pem'; node scripts/apply-mock-solutions-schema.mjs [--apply]
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

const sql = `CREATE TABLE IF NOT EXISTS mock_solutions (
  test_slug TEXT PRIMARY KEY NOT NULL,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
)`;
if (apply) { await db.execute(sql); console.log('mock_solutions ensured'); }
else console.log('(dry-run)\n' + sql + '\nre-run with --apply');
