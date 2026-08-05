#!/usr/bin/env node
// scripts/seed-others-instructor.mjs — Creates the "Others" instructor row
// (used when no listed instructor took a class — invigilator, substitute).
// A real user row so it can hold classes and appear in reports without
// special-casing queries. Idempotent: skips the insert if a row with this
// email already exists.
//
// role='student' (least privilege — instructor pickers filter on is_teaching
// only, not role) and status='inactive' (keeps it out of email blasts — the
// audience resolver excludes inactive users). email uses the reserved
// .invalid TLD, which can never receive mail.
//
// Usage:
//   node scripts/seed-others-instructor.mjs --dry-run   # plan only, no DB writes
//   node scripts/seed-others-instructor.mjs             # write to Turso
//
// Requires .env.local with TURSO_DATABASE_URL + TURSO_AUTH_TOKEN. Local Node→
// Turso TLS needs NODE_EXTRA_CA_CERTS → repo-root win-roots.pem, e.g.:
//   $env:NODE_EXTRA_CA_CERTS="D:\VH Website\win-roots.pem"; node scripts/seed-others-instructor.mjs
// Exit codes: 0 ok, 1 usage/parse, 2 db failure.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import { users } from '../src/lib/db/schema.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ─── ANSI helpers ────────────────────────────────────────────────────────────

const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', red: '\x1b[31m',
  green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m',
};
const ok   = (m) => console.log(`${c.green}✓${c.reset} ${m}`);
const warn = (m) => console.log(`${c.yellow}⚠${c.reset}  ${m}`);
const err  = (m) => console.error(`${c.red}✗${c.reset} ${m}`);
const info = (m) => console.log(`${c.cyan}ℹ${c.reset} ${m}`);
const bold = (m) => `${c.bold}${m}${c.reset}`;

// ─── .env.local parser (matches seed-batches.mjs) ─────────────────────────────

function loadEnv() {
  const envPath = path.join(ROOT, '.env.local');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

// ─── Config ────────────────────────────────────────────────────────────────────

const ROW = {
  email: 'others@internal.invalid',
  name: 'Others',
  role: 'student',
  status: 'inactive',
  isTeaching: true,
};

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('');
  console.log(bold(`  VH "Others" Instructor Seeder${dryRun ? ' [DRY RUN]' : ''}`));
  console.log('');

  loadEnv();

  const { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN } = process.env;
  if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) {
    err('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in .env.local');
    process.exit(dryRun ? 0 : 2);
  }

  const client = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN });
  const db = drizzle(client);

  const existing = await db.select({ id: users.id }).from(users)
    .where(eq(users.email, ROW.email)).get();

  if (dryRun) {
    if (existing) warn(`[dry-run] '${ROW.email}' already exists (id=${existing.id}) — would skip`);
    else ok(`[dry-run] would insert user '${ROW.name}' <${ROW.email}> role='${ROW.role}' status='${ROW.status}' is_teaching=1`);
    console.log('');
    ok(bold('Dry run complete — no DB writes performed.'));
    process.exit(0);
  }

  if (existing) {
    info(`'${ROW.email}' already exists (id=${existing.id}) — skipping`);
    console.log('');
    ok(bold('Seed complete — 0 row(s) inserted, 1 already present.'));
    process.exit(0);
  }

  const [created] = await db.insert(users).values(ROW).returning();
  ok(`inserted user id=${created.id}: '${ROW.name}' <${ROW.email}> role='${ROW.role}' status='${ROW.status}' is_teaching=1`);

  console.log('');
  ok(bold('Seed complete — 1 row inserted.'));
  process.exit(0);
}

main().catch((e) => {
  err(`Unexpected error: ${e.message}`);
  process.exit(2);
});
