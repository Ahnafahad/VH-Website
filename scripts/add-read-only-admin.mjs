// Adds users.read_only (if missing) and creates or updates a read-only admin.
// Usage: node scripts/add-read-only-admin.mjs <email> "<name>" [--apply]   (dry-run unless --apply)
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
const [email, name] = process.argv.slice(2).filter(a => !a.startsWith('--'));
const apply = process.argv.includes('--apply');
if (!email || !name) { console.error('usage: <email> "<name>" [--apply]'); process.exit(1); }

const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
const run = async (sql, args = []) => { console.log(apply ? 'RUN ' : 'WOULD RUN', sql, args); if (apply) await db.execute({ sql, args }); };

const cols = (await db.execute('PRAGMA table_info(users)')).rows.map(r => r.name);
if (!cols.includes('read_only')) await run('ALTER TABLE users ADD COLUMN read_only integer NOT NULL DEFAULT 0');
const lower = email.toLowerCase();
const existing = (await db.execute({ sql: 'SELECT id, role FROM users WHERE lower(email) = ?', args: [lower] })).rows[0];
if (existing) {
  if (existing.role === 'super_admin') throw new Error('Refusing to make a super_admin read-only');
  await run("UPDATE users SET role = 'admin', status = 'active', read_only = 1 WHERE id = ?", [existing.id]);
} else {
  await run("INSERT INTO users (email, name, role, status, read_only) VALUES (?, ?, 'admin', 'active', 1)", [lower, name]);
}
if (!apply) console.log('\nDry run. Re-run with --apply to write.');
