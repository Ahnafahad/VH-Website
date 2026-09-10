#!/usr/bin/env node
// scripts/reset-all-users-to-mini-onboarding.mjs — One-time correction:
// reverses the 2026-09-05 WordSmart-only lock. Every existing LexiCore user
// (has a vocab_user_progress row) has their syllabus selection wiped and is
// marked syllabus_locked so they must go through the reduced-onboarding
// modal (ReducedOnboardingModal → POST /api/vocab/onboarding/unlock) again —
// this time with a genuine, open choice among all syllabuses, not pinned to
// WordSmart. Applies regardless of whether they'd already picked a syllabus
// (deliberately or via the old lock script): as of this run, nobody is
// treated as having gone through real onboarding yet.
//
// Does NOT touch onboarding_complete — users still mid the full /vocab
// onboarding flow (never finished it) are unaffected and continue there.
//
// Idempotent — safe to re-run (just re-wipes selections + re-locks).
//
// Usage:
//   node scripts/reset-all-users-to-mini-onboarding.mjs --dry-run
//   node scripts/reset-all-users-to-mini-onboarding.mjs --apply
//
// Requires .env.local with TURSO_DATABASE_URL + TURSO_AUTH_TOKEN. Local Node→
// Turso TLS needs NODE_EXTRA_CA_CERTS → repo-root win-roots.pem.
// Exit codes: 0 ok, 1 usage, 2 db failure.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@libsql/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const c = { reset: '\x1b[0m', bold: '\x1b[1m', red: '\x1b[31m', green: '\x1b[32m', cyan: '\x1b[36m' };
const ok = (m) => console.log(`${c.green}✓${c.reset} ${m}`);
const err = (m) => console.error(`${c.red}✗${c.reset} ${m}`);
const info = (m) => console.log(`${c.cyan}ℹ${c.reset} ${m}`);
const bold = (m) => `${c.bold}${m}${c.reset}`;

function loadEnv() {
  const envPath = path.join(ROOT, '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const apply = process.argv.includes('--apply');
  if (!dryRun && !apply) {
    err('Pass either --dry-run or --apply');
    process.exit(1);
  }

  console.log('');
  console.log(bold(`  Reset every LexiCore user to the mini (reduced) onboarding${dryRun ? ' [DRY RUN]' : ''}`));
  console.log('');

  loadEnv();
  const { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN } = process.env;
  if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) {
    err('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in .env.local');
    process.exit(dryRun ? 0 : 2);
  }

  const client = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN });

  // Same super-admin carve-out as the original lock script.
  const EXCLUDED_EMAILS = ['ahnaf816@gmail.com'];
  const usersResult = await client.execute({
    sql: `
      SELECT u.id, u.email, p.syllabus_locked,
        (SELECT COUNT(*) FROM vocab_user_syllabuses s WHERE s.user_id = u.id) AS syllabus_count
      FROM users u
      JOIN vocab_user_progress p ON p.user_id = u.id
      WHERE u.email NOT IN (${EXCLUDED_EMAILS.map(() => '?').join(', ')})
    `,
    args: EXCLUDED_EMAILS,
  });

  info(`${usersResult.rows.length} LexiCore user(s) will be reset to the mini onboarding.`);
  const alreadyPicked = usersResult.rows.filter((r) => Number(r.syllabus_count) > 0);
  info(`${alreadyPicked.length} of them had already picked syllabus(es) — that choice will be wiped.`);

  if (dryRun) {
    for (const u of usersResult.rows) {
      const tag = Number(u.syllabus_count) > 0 ? `had ${u.syllabus_count} syllabus(es) picked` : 'no prior selection';
      info(`[dry-run] would reset ${u.email} (${tag})`);
    }
    console.log('');
    ok(bold('Dry run complete — no DB writes performed.'));
    process.exit(0);
  }

  let reset = 0;
  for (const u of usersResult.rows) {
    await client.execute({ sql: 'DELETE FROM vocab_user_syllabuses WHERE user_id = ?', args: [u.id] });
    await client.execute({
      sql: 'UPDATE vocab_user_progress SET syllabus_locked = 1, updated_at = unixepoch() WHERE user_id = ?',
      args: [u.id],
    });
    reset++;
  }

  console.log('');
  ok(bold(`Reset ${reset} user(s) — they'll see the mini onboarding on next Home visit.`));
  info('Cached Home/Study/Practice data may take up to 5 minutes to reflect this (unstable_cache revalidate window) — not revalidated live from this script.');
}

main().catch((e) => {
  err(e.message);
  process.exit(2);
});
