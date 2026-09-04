#!/usr/bin/env node
// scripts/seed-vocab-syllabuses.mjs — Creates the 'WordSmart' syllabus row (if
// missing) and links every existing vocab_words row to it via
// vocab_word_syllabuses (if not already linked). Idempotent — safe to re-run.
//
// Usage:
//   node scripts/seed-vocab-syllabuses.mjs --dry-run
//   node scripts/seed-vocab-syllabuses.mjs --apply
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

const WORDSMART_NAME = 'WordSmart';
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
  console.log(bold(`  Vocab Syllabuses Seeder${dryRun ? ' [DRY RUN]' : ''}`));
  console.log('');

  loadEnv();
  const { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN } = process.env;
  if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) {
    err('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in .env.local');
    process.exit(dryRun ? 0 : 2);
  }

  const client = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN });

  const existingSyllabus = await client.execute({
    sql: 'SELECT id FROM vocab_syllabuses WHERE slug = ?',
    args: [WORDSMART_SLUG],
  });
  let syllabusId = existingSyllabus.rows[0]?.id ?? null;

  if (syllabusId) {
    info(`'${WORDSMART_NAME}' syllabus already exists (id=${syllabusId})`);
  } else {
    info(`'${WORDSMART_NAME}' syllabus does not exist yet — would create it`);
  }

  const wordsResult = await client.execute('SELECT id FROM vocab_words');
  const allWordIds = wordsResult.rows.map((r) => Number(r.id));
  info(`${allWordIds.length} word(s) in vocab_words`);

  let alreadyLinkedIds = new Set();
  if (syllabusId) {
    const linkedResult = await client.execute({
      sql: 'SELECT word_id FROM vocab_word_syllabuses WHERE syllabus_id = ?',
      args: [syllabusId],
    });
    alreadyLinkedIds = new Set(linkedResult.rows.map((r) => Number(r.word_id)));
  }
  const toLink = allWordIds.filter((id) => !alreadyLinkedIds.has(id));
  info(`${alreadyLinkedIds.size} word(s) already linked, ${toLink.length} to link`);

  if (dryRun) {
    info(`[dry-run] would ${syllabusId ? 'reuse existing' : 'create'} '${WORDSMART_NAME}' syllabus row`);
    info(`[dry-run] would insert ${toLink.length} vocab_word_syllabuses row(s)`);
    console.log('');
    ok(bold('Dry run complete — no DB writes performed.'));
    process.exit(0);
  }

  if (!syllabusId) {
    const insertResult = await client.execute({
      sql: 'INSERT INTO vocab_syllabuses (name, slug, "order") VALUES (?, ?, 0)',
      args: [WORDSMART_NAME, WORDSMART_SLUG],
    });
    syllabusId = Number(insertResult.lastInsertRowid);
    ok(`Created '${WORDSMART_NAME}' syllabus (id=${syllabusId})`);
  }

  let linked = 0;
  for (const wordId of toLink) {
    await client.execute({
      sql: 'INSERT INTO vocab_word_syllabuses (word_id, syllabus_id) VALUES (?, ?)',
      args: [wordId, syllabusId],
    });
    linked++;
  }

  console.log('');
  ok(bold(`Seed complete — ${linked} word(s) newly linked to '${WORDSMART_NAME}' (syllabus id=${syllabusId}).`));
  process.exit(0);
}

main().catch((e) => {
  err(`Unexpected error: ${e.message}`);
  process.exit(2);
});
