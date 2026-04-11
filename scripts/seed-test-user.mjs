/**
 * Seed script — creates a demo user for local development.
 * Run: node scripts/seed-test-user.mjs
 * Credentials: test@vh.dev / dev123
 */

import { createClient } from '@libsql/client';

const client = createClient({
  url:       'libsql://vh-beyond-the-horizon-ahnafahad.aws-ap-south-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzUxNDUzODYsImlkIjoiMDE5ZDRjZGQtZmMwMS03Njc2LTkwODItNjUxYjlhMWUzMTVhIiwicmlkIjoiMjAxZGQ5ZDktYTEwYi00ZTA4LTg3ODgtMWMyMmRmZmMyODgxIn0.vw7b-JVuzAts5PP4rzgMwhKV-XRVLkXl_Lxfta5YUgtbUORsiHqFU6Tkb0Ll_D4L4tKeAM-lxF5e-OT_McZ_Aw',
});

try {
  // 1. Insert user (idempotent)
  await client.execute({
    sql: `INSERT OR IGNORE INTO users (email, name, role, status) VALUES (?, ?, ?, ?)`,
    args: ['test@vh.dev', 'Demo User', 'admin', 'active'],
  });

  // 2. Fetch the user ID
  const result = await client.execute({
    sql: `SELECT id FROM users WHERE email = ?`,
    args: ['test@vh.dev'],
  });
  const userId = result.rows[0].id;
  console.log(`User ID: ${userId}`);

  // 3. Create vocab progress — onboarding complete, 3-month deadline, phase 1 (full access)
  const deadlineUnix = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60; // +90 days
  await client.execute({
    sql: `INSERT OR IGNORE INTO vocab_user_progress
          (user_id, phase, total_points, weekly_points, streak_days, onboarding_complete, deadline, daily_target)
          VALUES (?, 1, 500, 120, 3, 1, ?, 15)`,
    args: [userId, deadlineUnix],
  });

  console.log('✓ Demo user ready — test@vh.dev / dev123');
} finally {
  client.close();
}
