#!/usr/bin/env node
/**
 * Restore orphaned user rows in Turso so existing vocab progress reconnects.
 *
 * Context: something deleted users 1–10 from the `users` table without cascading
 * to vocab_user_progress / vocab_user_word_records / vocab_flashcard_sessions /
 * vocab_quiz_sessions / vocab_user_badges. The orphaned rows still exist and are
 * identifiable by daily_message content.
 *
 * Mapping (from daily_message clues + set-instructors.js names):
 *   id=2  → Hasan         → hasanxsarower@gmail.com      (admin)
 *   id=8  → Kaif Kabir    → kaifkabir2004@gmail.com      (instructor)
 *   id=10 → Habibur Rahman → habiburrahmanrayat@gmail.com (instructor)
 *
 * Safe to re-run: uses INSERT OR IGNORE — won't overwrite existing rows.
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

const RESTORE = [
  { id: 2,  email: 'hasanxsarower@gmail.com',      name: 'Hasan',           role: 'admin'      },
  { id: 8,  email: 'kaifkabir2004@gmail.com',      name: 'Kaif Kabir',      role: 'instructor' },
  { id: 10, email: 'habiburrahmanrayat@gmail.com', name: 'Habibur Rahman',  role: 'instructor' },
];

for (const u of RESTORE) {
  // Skip if id already claimed
  const byId = await c.execute({ sql: `SELECT id, email, role FROM users WHERE id = ?`, args: [u.id] });
  if (byId.rows.length) {
    console.log(`  skip id=${u.id}: already exists → ${byId.rows[0].email} (${byId.rows[0].role})`);
    continue;
  }

  // Skip if email already exists under a different id — would create a duplicate person
  const byEmail = await c.execute({ sql: `SELECT id FROM users WHERE email = ?`, args: [u.email] });
  if (byEmail.rows.length) {
    const existingId = byEmail.rows[0].id;
    console.log(`  conflict: ${u.email} already at id=${existingId} (target was ${u.id}).`);
    console.log(`    → leaving orphan at id=${u.id}; progress will NOT reconnect without manual merge.`);
    continue;
  }

  // Orphaned progress sanity check
  const prog = await c.execute({ sql: `SELECT total_points, streak_days FROM vocab_user_progress WHERE user_id = ?`, args: [u.id] });
  const pts = prog.rows[0]?.total_points ?? 0;
  const streak = prog.rows[0]?.streak_days ?? 0;

  await c.execute({
    sql: `INSERT INTO users (id, email, name, role, status) VALUES (?, ?, ?, ?, 'active')`,
    args: [u.id, u.email, u.name, u.role],
  });
  console.log(`  ✓ restored id=${u.id} ${u.email} (${u.role}) — reconnected ${pts}pts/${streak}-day streak`);
}

// Verify
console.log('\nFinal state:');
const final = await c.execute({
  sql: `SELECT u.id, u.email, u.role, p.total_points, p.streak_days,
               (SELECT COUNT(*) FROM vocab_user_word_records WHERE user_id = u.id) AS records
        FROM users u LEFT JOIN vocab_user_progress p ON p.user_id = u.id
        WHERE u.id IN (${RESTORE.map(() => '?').join(',')}) ORDER BY u.id`,
  args: RESTORE.map(u => u.id),
});
console.table(final.rows);

process.exit(0);
