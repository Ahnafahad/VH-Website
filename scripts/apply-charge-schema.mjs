/**
 * apply-charge-schema.mjs
 * Applies Word Charge schema additions:
 *   - ALTER TABLE vocab_words ADD COLUMN connotation TEXT
 *   - CREATE TABLE vocab_charge_rounds (...)
 * Idempotent: checks for existence before applying each statement.
 *
 * Run (Windows PowerShell, from vh-website/):
 *   $env:NODE_EXTRA_CA_CERTS='D:\VH Website\win-roots.pem'
 *   node scripts/apply-charge-schema.mjs
 */

import { createClient } from '@libsql/client';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local
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
  // 1. Add connotation column to vocab_words (idempotent)
  try {
    await client.execute('ALTER TABLE vocab_words ADD COLUMN connotation TEXT');
    console.log('✓ Added column vocab_words.connotation');
  } catch (e) {
    if (/duplicate column|already exists/i.test(e.message)) {
      console.log('• vocab_words.connotation already present — skipping');
    } else {
      throw e;
    }
  }

  // 2. Create vocab_charge_rounds table (idempotent via IF NOT EXISTS)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS vocab_charge_rounds (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status        TEXT    NOT NULL DEFAULT 'active',
      word_ids      TEXT    NOT NULL,
      answers       TEXT,
      correct_count INTEGER NOT NULL DEFAULT 0,
      wrong_count   INTEGER NOT NULL DEFAULT 0,
      helped_count  INTEGER NOT NULL DEFAULT 0,
      skipped_count INTEGER NOT NULL DEFAULT 0,
      best_streak   INTEGER NOT NULL DEFAULT 0,
      points_earned INTEGER NOT NULL DEFAULT 0,
      started_at    INTEGER NOT NULL DEFAULT (unixepoch()),
      finished_at   INTEGER
    )
  `);
  console.log('✓ Table vocab_charge_rounds ensured');

  // 3. Index (idempotent)
  try {
    await client.execute(
      'CREATE INDEX idx_charge_rounds_user ON vocab_charge_rounds (user_id, started_at)'
    );
    console.log('✓ Index idx_charge_rounds_user created');
  } catch (e) {
    if (/already exists/i.test(e.message)) {
      console.log('• idx_charge_rounds_user already present — skipping');
    } else {
      throw e;
    }
  }

  console.log('\nSchema migration complete.');
  process.exit(0);
}

run().catch(e => { console.error('Migration failed:', e.message); process.exit(1); });
