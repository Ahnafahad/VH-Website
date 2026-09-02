#!/usr/bin/env node
// scripts/approve-vocab-alt-definitions.mjs — Flips vocab_word_alt_definitions.status
// from 'draft' to 'approved' for all rows. Run once after the initial 805-word seed
// (see scripts/seed-vocab-alt-definitions.mjs) — the rows already went through
// mechanical QA + manual per-batch semantic review before insert, so this just
// records that review as the approval.
//
// Usage:
//   node scripts/approve-vocab-alt-definitions.mjs --dry-run
//   node scripts/approve-vocab-alt-definitions.mjs --apply
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
  console.log(bold(`  Vocab Alt-Definitions Approver${dryRun ? ' [DRY RUN]' : ''}`));
  console.log('');

  loadEnv();
  const { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN } = process.env;
  if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) {
    err('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in .env.local');
    process.exit(dryRun ? 0 : 2);
  }

  const client = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN });

  const draftResult = await client.execute("SELECT COUNT(*) as cnt FROM vocab_word_alt_definitions WHERE status = 'draft'");
  const draftCount = Number(draftResult.rows[0].cnt);
  info(`${draftCount} row(s) currently status='draft'`);

  if (dryRun) {
    info(`[dry-run] would update ${draftCount} row(s) to status='approved'`);
    console.log('');
    ok(bold('Dry run complete — no DB writes performed.'));
    process.exit(0);
  }

  await client.execute("UPDATE vocab_word_alt_definitions SET status = 'approved', updated_at = unixepoch() WHERE status = 'draft'");

  console.log('');
  ok(bold(`Approve complete — ${draftCount} row(s) updated to status='approved'.`));
  process.exit(0);
}

main().catch((e) => {
  err(`Unexpected error: ${e.message}`);
  process.exit(2);
});
