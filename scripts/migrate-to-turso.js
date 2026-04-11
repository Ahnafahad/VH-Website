#!/usr/bin/env node
/**
 * One-time migration: MongoDB admins → Turso users table
 */
const mongoose = require('mongoose');
const { createClient } = require('@libsql/client');
const fs = require('fs');
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

async function run() {
  loadEnv();

  // Connect MongoDB
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);
  const admins = await mongoose.connection.collection('users')
    .find({ role: { $in: ['admin', 'super_admin'] } })
    .toArray();
  await mongoose.connection.close();
  console.log(`Found ${admins.length} admins in MongoDB`);

  // Connect Turso
  const turso = createClient({
    url:       process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const now = Math.floor(Date.now() / 1000);

  for (const admin of admins) {
    try {
      await turso.execute({
        sql: `INSERT OR IGNORE INTO users (email, name, role, status, created_at, updated_at)
              VALUES (?, ?, ?, 'active', ?, ?)`,
        args: [
          admin.email.toLowerCase(),
          admin.name,
          admin.role,
          now,
          now,
        ],
      });
      console.log(`  Inserted: [${admin.role}] ${admin.name} <${admin.email}>`);
    } catch (e) {
      console.error(`  Failed: ${admin.email} — ${e.message}`);
    }
  }

  // Verify
  const result = await turso.execute('SELECT id, email, name, role FROM users ORDER BY id');
  console.log('\nTurso users table:');
  for (const row of result.rows) {
    console.log(`  [${row.role}] ${row.name} <${row.email}>`);
  }

  turso.close();
  console.log('\nMigration complete.');
}

run().catch(e => { console.error(e); process.exit(1); });
