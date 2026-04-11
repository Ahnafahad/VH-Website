#!/usr/bin/env node
/**
 * Add vocab-access users to Turso.
 * Vocab is free-tier — just needs a row in the users table (no product rows).
 * Safe to re-run: uses INSERT OR IGNORE.
 */
const { createClient } = require('@libsql/client');
const fs   = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...rest] = trimmed.split('=');
        if (key && rest.length > 0)
          process.env[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
      }
    });
  }
}

const USERS = [
  { email: 'ahnaf816@gmail.com',        name: 'Ahnaf'         },
  { email: 'hasanxsarower@gmail.com',    name: 'Hasan Sarower' },
  { email: 'rahmitasnim234@gmail.com',   name: 'Rahmita Tasnim'},
];

async function run() {
  loadEnv();

  const turso = createClient({
    url:       process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const now = Math.floor(Date.now() / 1000);

  for (const u of USERS) {
    // Check if already exists
    const existing = await turso.execute({
      sql:  'SELECT id, email, role FROM users WHERE email = ?',
      args: [u.email.toLowerCase()],
    });

    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      console.log(`  ✓ Already exists: ${row[1]} [${row[2]}] (id=${row[0]})`);
      continue;
    }

    await turso.execute({
      sql: `INSERT OR IGNORE INTO users (email, name, role, status, created_at, updated_at)
            VALUES (?, ?, 'student', 'active', ?, ?)`,
      args: [u.email.toLowerCase(), u.name, now, now],
    });
    console.log(`  ✅ Added: ${u.email}`);
  }

  console.log('\nDone. These users can now sign in with Google and access LexiCore.');
  turso.close?.();
}

run().catch(e => { console.error(e); process.exit(1); });
