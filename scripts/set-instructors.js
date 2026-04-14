#!/usr/bin/env node
/**
 * Set 5 users to 'instructor' role in Turso.
 * Instructors have full access equivalent to admins.
 * Safe to re-run.
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

loadEnv();

const INSTRUCTORS = [
  { email: 'zayan10010@gmail.com',       name: 'Zayan Rahman'              },
  { email: 'smhossainaudri1@gmail.com',  name: 'Sidratul Muntaha Hossain'  },
  { email: 'kaifkabir2004@gmail.com',    name: 'Kaif Kabir'                },
  { email: 'sk.tarannum06@gmail.com',    name: 'Tarannum Rashid'           },
  { email: 'habiburrahmanrayat@gmail.com', name: 'Habibur Rahman'          },
];

async function main() {
  const client = createClient({
    url:       process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  console.log('\n👨‍🏫 Setting instructor roles...\n');

  for (const instructor of INSTRUCTORS) {
    const email = instructor.email.toLowerCase();

    // Check if user exists
    const existing = await client.execute({
      sql:  'SELECT id, name, role FROM users WHERE email = ?',
      args: [email],
    });

    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      if (row.role === 'instructor') {
        console.log(`  ✓ ${email} — already instructor`);
      } else {
        await client.execute({
          sql:  `UPDATE users SET role = 'instructor', updated_at = unixepoch() WHERE email = ?`,
          args: [email],
        });
        console.log(`  ✅ ${email} (${row.name}) — ${row.role} → instructor`);
      }
    } else {
      // User doesn't exist yet — insert them so they can sign in
      await client.execute({
        sql:  `INSERT INTO users (email, name, role, status) VALUES (?, ?, 'instructor', 'active')`,
        args: [email, instructor.name],
      });
      console.log(`  ➕ ${email} — created as instructor (will activate on first Google sign-in)`);
    }
  }

  // Summary
  console.log('\n📋 Final state:\n');
  const result = await client.execute({
    sql:  `SELECT email, name, role FROM users WHERE email IN (${INSTRUCTORS.map(() => '?').join(',')}) ORDER BY name`,
    args: INSTRUCTORS.map(i => i.email.toLowerCase()),
  });

  for (const row of result.rows) {
    console.log(`  ${row.role.padEnd(12)} ${row.email} — ${row.name}`);
  }

  console.log('\n✨ Done!\n');
  await client.close();
}

main().catch(err => { console.error(err); process.exit(1); });
