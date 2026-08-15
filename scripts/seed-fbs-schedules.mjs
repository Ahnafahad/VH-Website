#!/usr/bin/env node
// scripts/seed-fbs-schedules.mjs — Seeds the 3 weekly recurring FBS class_schedules
// rows (Accounting/Sun, Business Studies/Mon, Economics/Thu), mirroring the IBA
// weekly-class-schedule convention ("IBA Class" titleTemplate → here "FBS Class").
// Idempotent: skips a row if one already exists for the same (product, subject,
// dayOfWeek, timeOfDay).
//
// IMPORTANT — subject↔timeslot mapping is an ASSUMPTION, not given by any spec:
// Accounting → Sunday 12:00–14:00, Business Studies → Monday 16:00–18:00,
// Economics → Thursday 14:00–16:00 (alphabetical subject order mapped onto
// chronological weekday order — the most defensible default absent other
// guidance). CONFIRM/CORRECT before running with --apply.
//
// Applying this script does NOT enable Google Meet/Skribby auto-creation —
// that's the separate, still-disabled `meet_auto_create` global flag (shared
// with IBA). Rows inserted here only make "FBS Class" show up on the FBS
// dashboard once the nightly lms-generate-sessions cron materialises sessions
// from them; no real Calendar invites or Skribby bots are scheduled until
// meet_auto_create is turned on.
//
// Usage:
//   node scripts/seed-fbs-schedules.mjs --dry-run   # plan only, no DB writes
//   node scripts/seed-fbs-schedules.mjs             # write to Turso
//
// Requires .env.local with TURSO_DATABASE_URL + TURSO_AUTH_TOKEN. Local Node→
// Turso TLS needs NODE_EXTRA_CA_CERTS → repo-root win-roots.pem, e.g.:
//   $env:NODE_EXTRA_CA_CERTS="D:\VH Website\win-roots.pem"; node scripts/seed-fbs-schedules.mjs
// Exit codes: 0 ok, 1 usage/parse, 2 db failure.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { and, eq } from 'drizzle-orm';
import { classSchedules, users } from '../src/lib/db/schema.ts';

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

// ─── Config ──────────────────────────────────────────────────────────────────
// Batch: '2026-27' (mirrors IBA's batch naming — see seed-batches.mjs; the
// batch row itself must be seeded first). Owner: the super-admin account
// (CLAUDE.md), looked up by email so this doesn't hardcode a user id.

const OWNER_EMAIL = 'ahnaf816@gmail.com';

const SEED_ROWS = [
  { titleTemplate: 'FBS Class', subject: 'accounting',        product: 'fbs', batch: '2026-27', dayOfWeek: 0, timeOfDay: '12:00', durationMinutes: 120 }, // Sunday 12:00–14:00
  { titleTemplate: 'FBS Class', subject: 'business_studies',  product: 'fbs', batch: '2026-27', dayOfWeek: 1, timeOfDay: '16:00', durationMinutes: 120 }, // Monday 16:00–18:00
  { titleTemplate: 'FBS Class', subject: 'economics',         product: 'fbs', batch: '2026-27', dayOfWeek: 4, timeOfDay: '14:00', durationMinutes: 120 }, // Thursday 14:00–16:00
];

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('');
  console.log(bold(`  VH FBS Class Schedules Seeder${dryRun ? ' [DRY RUN]' : ''}`));
  console.log('');

  loadEnv();

  const { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN } = process.env;
  if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) {
    err('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in .env.local');
    process.exit(dryRun ? 0 : 2);
  }

  const client = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN });
  const db = drizzle(client);

  const owner = await db.select({ id: users.id }).from(users)
    .where(eq(users.email, OWNER_EMAIL)).get()
    .catch(() => null);

  if (!owner) {
    err(`Owner account '${OWNER_EMAIL}' not found — cannot set createdBy. Aborting.`);
    process.exit(dryRun ? 0 : 2);
  }
  info(`createdBy will be user id=${owner.id} (${OWNER_EMAIL})`);
  console.log('');

  if (dryRun) {
    for (const row of SEED_ROWS) {
      const existing = await db.select({ id: classSchedules.id }).from(classSchedules)
        .where(and(
          eq(classSchedules.product, row.product),
          eq(classSchedules.subject, row.subject),
          eq(classSchedules.dayOfWeek, row.dayOfWeek),
          eq(classSchedules.timeOfDay, row.timeOfDay),
        )).get()
        .catch(() => null); // table may not exist yet
      if (existing) warn(`    [dry-run] '${row.subject}' day=${row.dayOfWeek} ${row.timeOfDay} already exists (id=${existing.id}) — would skip`);
      else ok(`    [dry-run] would insert schedule '${row.titleTemplate}' / ${row.subject} / ${row.product} / batch=${row.batch} / day=${row.dayOfWeek} ${row.timeOfDay} (${row.durationMinutes}min)`);
    }
    console.log('');
    ok(bold('Dry run complete — no DB writes performed.'));
    warn('meet_auto_create stays untouched by this script — no real Calendar/Skribby side effects even after --apply.');
    process.exit(0);
  }

  let inserted = 0;
  for (const row of SEED_ROWS) {
    const existing = await db.select({ id: classSchedules.id }).from(classSchedules)
      .where(and(
        eq(classSchedules.product, row.product),
        eq(classSchedules.subject, row.subject),
        eq(classSchedules.dayOfWeek, row.dayOfWeek),
        eq(classSchedules.timeOfDay, row.timeOfDay),
      )).get();
    if (existing) {
      info(`'${row.subject}' day=${row.dayOfWeek} ${row.timeOfDay} already exists (id=${existing.id}) — skipping`);
      continue;
    }
    const [created] = await db.insert(classSchedules).values({
      titleTemplate:   row.titleTemplate,
      subject:         row.subject,
      product:         row.product,
      batch:           row.batch,
      dayOfWeek:       row.dayOfWeek,
      timeOfDay:       row.timeOfDay,
      durationMinutes: row.durationMinutes,
      active:          true,
      createdBy:       owner.id,
    }).returning();
    ok(`inserted schedule id=${created.id}: '${row.titleTemplate}' / ${row.subject} / day=${row.dayOfWeek} ${row.timeOfDay}`);
    inserted++;
  }

  console.log('');
  ok(bold(`Seed complete — ${inserted} schedule row(s) inserted, ${SEED_ROWS.length - inserted} already present.`));
  info('Next nightly run of the lms-generate-sessions cron (or a manual trigger) will materialise class_sessions from these.');
  process.exit(0);
}

main().catch((e) => {
  err(`Unexpected error: ${e.message}`);
  process.exit(2);
});
