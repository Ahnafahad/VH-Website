/**
 * Backfill: gives the `mock` product ("Mock Access") to every active IBA student of batch 2026-27.
 * Idempotent; never touches an existing row (a revoked grant stays revoked). Dry-run by default.
 *   $env:NODE_EXTRA_CA_CERTS='D:\VH Website\win-roots.pem'; node scripts/grant-mock-access.mjs [--apply]
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

const eligible = (await db.execute(`
  SELECT u.id FROM users u
  JOIN user_access a ON a.user_id = u.id AND a.product = 'iba' AND a.active = 1
  WHERE u.batch = '2026-27' AND u.role = 'student' AND u.status = 'active'
    AND NOT EXISTS (SELECT 1 FROM user_access m WHERE m.user_id = u.id AND m.product = 'mock')
`)).rows;
console.log(`${eligible.length} eligible student(s) without Mock Access`);
if (apply) {
  for (const r of eligible) await db.execute({ sql: `INSERT OR IGNORE INTO user_access (user_id, product, active) VALUES (?, 'mock', 1)`, args: [r.id] });
  const total = (await db.execute(`SELECT count(*) n FROM user_access WHERE product = 'mock' AND active = 1`)).rows[0].n;
  console.log(`granted. Active Mock Access holders now: ${total}`);
} else console.log('dry-run only — re-run with --apply');
