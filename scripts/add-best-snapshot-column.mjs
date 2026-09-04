/**
 * add-best-snapshot-column.mjs
 * Adds the missing test_attempts.best_snapshot column (nullable text) that
 * schema.ts (aeec0b6) declared but was never pushed to prod Turso — broke
 * every dashboard load with "no such column: best_snapshot".
 * Idempotent: safe to re-run.
 *
 * Run (Windows PowerShell, from vh-website/):
 *   $env:NODE_EXTRA_CA_CERTS='D:\VH Website\win-roots.pem'
 *   node scripts/add-best-snapshot-column.mjs
 */

import { createClient } from '@libsql/client';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const envPath = resolve(__dirname, '..', '.env.local');
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
        process.env[key] = val;
      }
    }
  }
}

const { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN } = process.env;
if (!TURSO_DATABASE_URL) { console.error('TURSO_DATABASE_URL not set'); process.exit(1); }

const client = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN });

async function run() {
  try {
    await client.execute('ALTER TABLE test_attempts ADD COLUMN best_snapshot TEXT');
    console.log('✓ Added column test_attempts.best_snapshot');
  } catch (e) {
    if (/duplicate column|already exists/i.test(e.message)) {
      console.log('• test_attempts.best_snapshot already present — skipping');
    } else {
      throw e;
    }
  }
  process.exit(0);
}

run().catch(e => { console.error('Migration failed:', e.message); process.exit(1); });
