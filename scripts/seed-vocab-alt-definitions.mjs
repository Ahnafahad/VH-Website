#!/usr/bin/env node
// scripts/seed-vocab-alt-definitions.mjs — Inserts the 805-word ultra-concise
// alt_definition + general_connotation corpus (generated via Codex, QA-checked,
// and manually reviewed for accuracy/differentiation — see
// .claude/scratch/vocab-alt-defs/) into vocab_word_alt_definitions.
//
// Additive only: does not touch vocab_words.definition or any existing table.
// Idempotent: skips any word_id that already has a row.
// Written with status='draft' (the schema default) — flip to 'approved' via a
// separate step once the user has spot-checked the results.
//
// Usage:
//   node scripts/seed-vocab-alt-definitions.mjs --dry-run   # plan only, no DB writes
//   node scripts/seed-vocab-alt-definitions.mjs --apply     # write to Turso
//
// Requires .env.local with TURSO_DATABASE_URL + TURSO_AUTH_TOKEN. Local Node→
// Turso TLS needs NODE_EXTRA_CA_CERTS → repo-root win-roots.pem, e.g.:
//   $env:NODE_EXTRA_CA_CERTS="D:\VH Website\win-roots.pem"; node scripts/seed-vocab-alt-definitions.mjs --apply
// Exit codes: 0 ok, 1 usage/parse, 2 db failure.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import { vocabWordAltDefinitions } from '../src/lib/db/schema.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_PATH = path.join(ROOT, '.claude/scratch/vocab-alt-defs/all-805-output.json');

const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', red: '\x1b[31m',
  green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m',
};
const ok   = (m) => console.log(`${c.green}✓${c.reset} ${m}`);
const warn = (m) => console.log(`${c.yellow}⚠${c.reset}  ${m}`);
const err  = (m) => console.error(`${c.red}✗${c.reset} ${m}`);
const info = (m) => console.log(`${c.cyan}ℹ${c.reset} ${m}`);
const bold = (m) => `${c.bold}${m}${c.reset}`;

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

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const apply = process.argv.includes('--apply');
  if (!dryRun && !apply) {
    err('Pass either --dry-run or --apply');
    process.exit(1);
  }

  console.log('');
  console.log(bold(`  Vocab Alt-Definitions Seeder${dryRun ? ' [DRY RUN]' : ''}`));
  console.log('');

  const rows = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
  info(`Loaded ${rows.length} rows from ${path.relative(ROOT, DATA_PATH)}`);

  const seen = new Set();
  for (const r of rows) {
    if (seen.has(r.word_id)) { err(`Duplicate word_id in source data: ${r.word_id}`); process.exit(1); }
    seen.add(r.word_id);
    if (!['positive', 'negative', 'neutral'].includes(r.general_connotation)) {
      err(`Invalid general_connotation for word_id ${r.word_id}: ${r.general_connotation}`);
      process.exit(1);
    }
  }
  ok('Source data validated: no duplicate word_ids, all connotations valid');

  loadEnv();
  const { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN } = process.env;
  if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) {
    err('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in .env.local');
    process.exit(dryRun ? 0 : 2);
  }

  const client = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN });
  const db = drizzle(client);

  const existingResult = await client.execute('SELECT word_id FROM vocab_word_alt_definitions');
  const existingIds = new Set(existingResult.rows.map(r => Number(r.word_id)));
  info(`${existingIds.size} row(s) already present in vocab_word_alt_definitions`);

  const toInsert = rows.filter(r => !existingIds.has(r.word_id));
  const toSkip = rows.length - toInsert.length;

  if (dryRun) {
    info(`[dry-run] would insert ${toInsert.length} row(s), skip ${toSkip} already-present`);
    info(`[dry-run] status would default to 'draft' for all inserted rows`);
    console.log('');
    ok(bold('Dry run complete — no DB writes performed.'));
    process.exit(0);
  }

  let inserted = 0;
  for (const r of toInsert) {
    await db.insert(vocabWordAltDefinitions).values({
      wordId: r.word_id,
      altDefinition: r.alt_definition,
      generalConnotation: r.general_connotation,
    });
    inserted++;
  }

  console.log('');
  ok(bold(`Seed complete — ${inserted} row(s) inserted, ${toSkip} already present.`));
  process.exit(0);
}

main().catch((e) => {
  err(`Unexpected error: ${e.message}`);
  process.exit(2);
});
