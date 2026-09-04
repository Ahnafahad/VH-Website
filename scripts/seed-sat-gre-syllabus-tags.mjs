#!/usr/bin/env node
// scripts/seed-sat-gre-syllabus-tags.mjs — Creates 'SAT' and 'GRE' vocab_syllabuses
// rows (if missing) and links the 218 words that already exist in vocab_words
// (per .claude/scratch/vocab-syllabus/dedup-report.json's existingMatches) to
// whichever of SAT/GRE they belong to. Idempotent — safe to re-run.
// Does NOT touch the 203 genuinely-new words — those are handled by the
// Codex-assisted placement pipeline separately.
//
// Usage:
//   node scripts/seed-sat-gre-syllabus-tags.mjs --dry-run
//   node scripts/seed-sat-gre-syllabus-tags.mjs --apply
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
const REPORT_PATH = path.join(ROOT, '.claude', 'scratch', 'vocab-syllabus', 'dedup-report.json');

const SYLLABUSES = [
  { name: 'SAT', slug: 'sat' },
  { name: 'GRE', slug: 'gre' },
];

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
  console.log(bold(`  SAT/GRE Syllabus Tagger${dryRun ? ' [DRY RUN]' : ''}`));
  console.log('');

  loadEnv();
  const { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN } = process.env;
  if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) {
    err('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in .env.local');
    process.exit(dryRun ? 0 : 2);
  }

  if (!fs.existsSync(REPORT_PATH)) {
    err(`Dedup report not found at ${REPORT_PATH} — run scripts/vocab-syllabus-dedup.mjs first`);
    process.exit(dryRun ? 0 : 2);
  }
  const { existingMatches } = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
  info(`Loaded ${existingMatches.length} existing-match words from dedup report`);

  const client = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN });

  const syllabusIds = {};
  for (const { name, slug } of SYLLABUSES) {
    const existing = await client.execute({ sql: 'SELECT id FROM vocab_syllabuses WHERE slug = ?', args: [slug] });
    const id = existing.rows[0]?.id ?? null;
    syllabusIds[name] = id;
    info(`'${name}' syllabus ${id ? `already exists (id=${id})` : 'does not exist yet — would create it'}`);
  }

  // Build the set of (wordId, syllabusName) pairs to link.
  const wantedLinks = []; // { wordId, syllabusName, word }
  for (const m of existingMatches) {
    for (const source of m.sources) {
      wantedLinks.push({ wordId: m.dbId, syllabusName: source, word: m.dbWord });
    }
  }
  info(`${wantedLinks.length} word↔syllabus link(s) wanted (word may appear in both SAT and GRE)`);

  if (dryRun) {
    for (const { name, slug } of SYLLABUSES) {
      if (!syllabusIds[name]) info(`[dry-run] would create syllabus '${name}' (slug='${slug}')`);
    }
    info(`[dry-run] would insert up to ${wantedLinks.length} vocab_word_syllabuses row(s) (existing links skipped)`);
    console.log('');
    ok(bold('Dry run complete — no DB writes performed.'));
    process.exit(0);
  }

  for (const { name, slug } of SYLLABUSES) {
    if (!syllabusIds[name]) {
      const insertResult = await client.execute({
        sql: 'INSERT INTO vocab_syllabuses (name, slug, "order") VALUES (?, ?, ?)',
        args: [name, slug, name === 'SAT' ? 1 : 2],
      });
      syllabusIds[name] = Number(insertResult.lastInsertRowid);
      ok(`Created '${name}' syllabus (id=${syllabusIds[name]})`);
    }
  }

  let linked = 0;
  let skipped = 0;
  for (const { wordId, syllabusName, word } of wantedLinks) {
    const syllabusId = syllabusIds[syllabusName];
    const already = await client.execute({
      sql: 'SELECT id FROM vocab_word_syllabuses WHERE word_id = ? AND syllabus_id = ?',
      args: [wordId, syllabusId],
    });
    if (already.rows.length > 0) {
      skipped++;
      continue;
    }
    await client.execute({
      sql: 'INSERT INTO vocab_word_syllabuses (word_id, syllabus_id) VALUES (?, ?)',
      args: [wordId, syllabusId],
    });
    linked++;
  }

  console.log('');
  ok(bold(`Tagging complete — ${linked} new link(s) inserted, ${skipped} already existed.`));
  process.exit(0);
}

main().catch((e) => {
  err(`Unexpected error: ${e.message}`);
  process.exit(2);
});
