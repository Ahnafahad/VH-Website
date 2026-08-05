#!/usr/bin/env node
// scripts/seed-batches.mjs — Creates the `batches` table (self-migrate, since
// drizzle-kit push/generate is not run here) and seeds the one real batch,
// '2026-27', for every product actually in use in prod (currently: 'iba'
// only — see env-roles-batches.md recon). Idempotent: skips the table create
// if it already exists, skips the row insert if that (name, product) pair
// already exists.
//
// Usage:
//   node scripts/seed-batches.mjs --dry-run   # plan only, no DB writes
//   node scripts/seed-batches.mjs             # write to Turso
//
// Requires .env.local with TURSO_DATABASE_URL + TURSO_AUTH_TOKEN. Local Node→
// Turso TLS needs NODE_EXTRA_CA_CERTS → repo-root win-roots.pem, e.g.:
//   $env:NODE_EXTRA_CA_CERTS="D:\VH Website\win-roots.pem"; node scripts/seed-batches.mjs
// Exit codes: 0 ok, 1 usage/parse, 2 db failure.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { and, eq } from 'drizzle-orm';
import { batches } from '../src/lib/db/schema.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ─── ANSI helpers ────────────────────────────────────────────────────────────

const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', red: '\x1b[31m',
  green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', gray: '\x1b[90m',
};
const ok   = (m) => console.log(`${c.green}✓${c.reset} ${m}`);
const warn = (m) => console.log(`${c.yellow}⚠${c.reset}  ${m}`);
const err  = (m) => console.error(`${c.red}✗${c.reset} ${m}`);
const info = (m) => console.log(`${c.cyan}ℹ${c.reset} ${m}`);
const bold = (m) => `${c.bold}${m}${c.reset}`;

// ─── .env.local parser (matches seed-fbs-diagnostic.mjs) ─────────────────────

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

// ─── Config ──────────────────────────────────────────────────────────────────
// Products actually in use in prod today (env-roles-batches.md: userAccess.product
// has only 'iba' rows — no 'fbs'/'fbs_detailed' yet).

const SEED_ROWS = [
  { name: '2026-27', product: 'iba', status: 'active' },
];

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('');
  console.log(bold(`  VH Batches Seeder${dryRun ? ' [DRY RUN]' : ''}`));
  console.log('');

  loadEnv();

  const { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN } = process.env;
  if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) {
    err('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in .env.local');
    process.exit(dryRun ? 0 : 2);
  }

  const client = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN });
  const db = drizzle(client);

  if (dryRun) {
    info('[dry-run] would CREATE TABLE IF NOT EXISTS batches (+ unique index on name, product)');
    for (const row of SEED_ROWS) {
      const existing = await db.select({ id: batches.id }).from(batches)
        .where(and(eq(batches.name, row.name), eq(batches.product, row.product))).get()
        .catch(() => null); // table may not exist yet
      if (existing) warn(`    [dry-run] '${row.name}' / '${row.product}' already exists (id=${existing.id}) — would skip`);
      else ok(`    [dry-run] would insert batch '${row.name}' / '${row.product}' / status='${row.status}'`);
    }
    console.log('');
    ok(bold('Dry run complete — no DB writes performed.'));
    process.exit(0);
  }

  // ── Self-migrate: create the table if it doesn't exist yet (idempotent) ────
  await client.execute(`
    CREATE TABLE IF NOT EXISTS batches (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL,
      product    TEXT    NOT NULL,
      status     TEXT    NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);
  ok('table batches ensured');

  try {
    await client.execute(
      'CREATE UNIQUE INDEX batches_name_product_unique ON batches (name, product)'
    );
    ok('unique index batches_name_product_unique created');
  } catch (e) {
    if (/already exists/i.test(e.message)) info('index batches_name_product_unique already present');
    else throw e;
  }

  // ── Idempotent row insert ──────────────────────────────────────────────────
  let inserted = 0;
  for (const row of SEED_ROWS) {
    const existing = await db.select({ id: batches.id }).from(batches)
      .where(and(eq(batches.name, row.name), eq(batches.product, row.product))).get();
    if (existing) {
      info(`'${row.name}' / '${row.product}' already exists (id=${existing.id}) — skipping`);
      continue;
    }
    const [created] = await db.insert(batches).values(row).returning();
    ok(`inserted batch id=${created.id}: '${row.name}' / '${row.product}' / status='${row.status}'`);
    inserted++;
  }

  console.log('');
  ok(bold(`Seed complete — ${inserted} batch row(s) inserted, ${SEED_ROWS.length - inserted} already present.`));
  process.exit(0);
}

main().catch((e) => {
  err(`Unexpected error: ${e.message}`);
  process.exit(2);
});
