/**
 * Seed script — creates a demo user for local development.
 * Run: node scripts/seed-test-user.mjs
 * Credentials: test@vh.dev / dev123
 */

import { createClient } from '@libsql/client';

if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  throw new Error('Missing TURSO_DATABASE_URL / TURSO_AUTH_TOKEN. Run with: node --env-file=.env.local <script>');
}

const client = createClient({
  url:       process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
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
