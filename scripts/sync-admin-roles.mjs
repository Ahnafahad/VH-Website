#!/usr/bin/env node
/**
 * Sync admin roles from access-control.json → Turso users table.
 *
 * Auth auto-provisions new gmail users as role='student'. This flattens admins
 * back to student if they first sign in after a reset. Run this after any
 * users-table wipe or whenever access-control.json changes.
 *
 * - Upserts each admin row with the correct role (super_admin or admin).
 * - Creates missing rows so they can sign in cleanly.
 * - Safe to re-run.
 */

import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(l => l.split(/=(.+)/).slice(0, 2))
);
const c = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });

const cfg = JSON.parse(readFileSync('access-control.json', 'utf8'));

for (const a of cfg.admins) {
  const email = a.email.toLowerCase();
  const existing = await c.execute({
    sql:  `SELECT id, role FROM users WHERE email = ?`,
    args: [email],
  });

  if (existing.rows.length === 0) {
    await c.execute({
      sql:  `INSERT INTO users (email, name, role, status) VALUES (?, ?, ?, 'active')`,
      args: [email, a.name, a.role],
    });
    console.log(`  + created ${email} as ${a.role}`);
    continue;
  }

  const row = existing.rows[0];
  if (row.role === a.role) {
    console.log(`  = ${email} already ${a.role}`);
    continue;
  }

  await c.execute({
    sql:  `UPDATE users SET role = ?, updated_at = unixepoch() WHERE email = ?`,
    args: [a.role, email],
  });
  console.log(`  ✓ ${email} ${row.role} → ${a.role}`);
}

console.log('\nFinal admin state:');
const q = await c.execute({
  sql:  `SELECT id, email, name, role FROM users WHERE email IN (${cfg.admins.map(() => '?').join(',')}) ORDER BY role DESC, email`,
  args: cfg.admins.map(a => a.email.toLowerCase()),
});
console.table(q.rows);

process.exit(0);
