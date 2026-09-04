#!/usr/bin/env node
// scripts/lock-iba-2026-27-to-wordsmart.mjs — One-time correction: any
// existing LexiCore user (has a vocab_user_progress row) who never went
// through the new syllabus-selection onboarding (zero vocab_user_syllabuses
// rows) is pinned to the WordSmart syllabus only, and their
// vocab_user_progress.syllabus_locked flag is set so the Study/Practice
// checkbox filter can never add another syllabus back for them. Batch/product
// are irrelevant — new students always pick a syllabus during onboarding and
// so already have a vocab_user_syllabuses row, which naturally excludes them.
//
// Idempotent — safe to re-run (skips users already locked).
//
// Usage:
//   node scripts/lock-iba-2026-27-to-wordsmart.mjs --dry-run
//   node scripts/lock-iba-2026-27-to-wordsmart.mjs --apply
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

const WORDSMART_SLUG = 'wordsmart';

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
  console.log(bold(`  Lock un-onboarded existing users to WordSmart${dryRun ? ' [DRY RUN]' : ''}`));
  console.log('');

  loadEnv();
  const { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN } = process.env;
  if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) {
    err('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in .env.local');
    process.exit(dryRun ? 0 : 2);
  }

  const client = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN });

  const syllabusResult = await client.execute({
    sql: 'SELECT id FROM vocab_syllabuses WHERE slug = ?',
    args: [WORDSMART_SLUG],
  });
  const syllabusId = syllabusResult.rows[0]?.id ?? null;
  if (!syllabusId) {
    err(`No '${WORDSMART_SLUG}' syllabus found — run scripts/seed-vocab-syllabuses.mjs first`);
    process.exit(2);
  }
  info(`WordSmart syllabus id=${syllabusId}`);

  // Target = has a vocab_user_progress row (has used LexiCore) AND has never
  // made an explicit syllabus choice (zero vocab_user_syllabuses rows) — i.e.
  // never went through the new onboarding, regardless of batch/product.
  const EXCLUDED_EMAILS = ['ahnaf816@gmail.com'];
  const usersResult = await client.execute({
    sql: `
      SELECT u.id, u.email, p.syllabus_locked
      FROM users u
      JOIN vocab_user_progress p ON p.user_id = u.id
      WHERE NOT EXISTS (SELECT 1 FROM vocab_user_syllabuses s WHERE s.user_id = u.id)
        AND u.email NOT IN (${EXCLUDED_EMAILS.map(() => '?').join(', ')})
    `,
    args: EXCLUDED_EMAILS,
  });

  const toLock = usersResult.rows.filter((r) => !r.syllabus_locked);
  info(`${usersResult.rows.length} un-onboarded existing LexiCore user(s), ${toLock.length} not yet locked`);

  if (dryRun) {
    for (const u of toLock) info(`[dry-run] would lock ${u.email} to WordSmart-only`);
    console.log('');
    ok(bold('Dry run complete — no DB writes performed.'));
    process.exit(0);
  }

  let locked = 0;
  for (const u of toLock) {
    await client.execute({ sql: 'DELETE FROM vocab_user_syllabuses WHERE user_id = ?', args: [u.id] });
    await client.execute({
      sql: 'INSERT INTO vocab_user_syllabuses (user_id, syllabus_id) VALUES (?, ?)',
      args: [u.id, syllabusId],
    });
    await client.execute({
      sql: 'UPDATE vocab_user_progress SET syllabus_locked = 1, updated_at = unixepoch() WHERE user_id = ?',
      args: [u.id],
    });
    locked++;
  }

  console.log('');
  ok(bold(`Locked ${locked} user(s) to WordSmart-only.`));
  info('Their cached Home/Study/Practice data may take up to 5 minutes to reflect this (unstable_cache revalidate window) — not revalidated live from this script.');
}

main().catch((e) => {
  err(e.message);
  process.exit(2);
});
