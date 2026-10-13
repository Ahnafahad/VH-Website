/**
 * Applies the Super Admin schema additions (idempotent):
 *   users.sessions_invalidated_at, super_pending_actions, auth_events, broadcasts,
 *   test_versions, registration_payments.
 * Run from vh-website/:
 *   $env:NODE_EXTRA_CA_CERTS='D:\VH Website\win-roots.pem'; node scripts/apply-super-admin-schema.mjs
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
const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

const cols = (await db.execute('PRAGMA table_info(users)')).rows.map(r => r.name);
if (!cols.includes('sessions_invalidated_at')) await db.execute('ALTER TABLE users ADD COLUMN sessions_invalidated_at INTEGER');

const stmts = [
  `CREATE TABLE IF NOT EXISTS super_pending_actions (id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT NOT NULL, payload TEXT NOT NULL, summary TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', requested_by INTEGER REFERENCES users(id) ON DELETE SET NULL, execute_after INTEGER NOT NULL, resolved_at INTEGER, result TEXT, created_at INTEGER NOT NULL DEFAULT (unixepoch()))`,
  `CREATE INDEX IF NOT EXISTS idx_super_pending_status ON super_pending_actions (status, execute_after)`,
  `CREATE TABLE IF NOT EXISTS auth_events (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, email TEXT, type TEXT NOT NULL, ip TEXT, user_agent TEXT, created_at INTEGER NOT NULL DEFAULT (unixepoch()))`,
  `CREATE INDEX IF NOT EXISTS idx_auth_events_user ON auth_events (user_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_auth_events_created ON auth_events (created_at)`,
  `CREATE TABLE IF NOT EXISTS broadcasts (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, body TEXT NOT NULL, channels TEXT NOT NULL, segment TEXT NOT NULL, scheduled_at INTEGER, status TEXT NOT NULL DEFAULT 'draft', sent_count INTEGER NOT NULL DEFAULT 0, created_by INTEGER REFERENCES users(id) ON DELETE SET NULL, created_at INTEGER NOT NULL DEFAULT (unixepoch()), sent_at INTEGER)`,
  `CREATE INDEX IF NOT EXISTS idx_broadcasts_status ON broadcasts (status, scheduled_at)`,
  `CREATE TABLE IF NOT EXISTS test_versions (id INTEGER PRIMARY KEY AUTOINCREMENT, test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE, snapshot TEXT NOT NULL, reason TEXT NOT NULL, created_by INTEGER REFERENCES users(id) ON DELETE SET NULL, created_at INTEGER NOT NULL DEFAULT (unixepoch()))`,
  `CREATE INDEX IF NOT EXISTS idx_test_versions_test ON test_versions (test_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS registration_payments (id INTEGER PRIMARY KEY AUTOINCREMENT, registration_id INTEGER NOT NULL REFERENCES registrations(id) ON DELETE CASCADE, amount INTEGER NOT NULL, method TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'paid', note TEXT, follow_up_at INTEGER, recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL, created_at INTEGER NOT NULL DEFAULT (unixepoch()))`,
  `CREATE INDEX IF NOT EXISTS idx_reg_payments_reg ON registration_payments (registration_id)`,
];
for (const s of stmts) await db.execute(s);
console.log('super-admin schema applied');
