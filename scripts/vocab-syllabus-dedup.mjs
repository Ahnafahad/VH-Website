#!/usr/bin/env node
// scripts/vocab-syllabus-dedup.mjs — READ-ONLY analysis. Parses the SAT/GRE
// Hit Parade markdown source and cross-references every entry against the
// live vocab_words table (case-insensitive exact match). Writes a report to
// .claude/scratch/vocab-syllabus/dedup-report.json — no DB writes.
//
// Usage:
//   node scripts/vocab-syllabus-dedup.mjs
//
// Requires .env.local with TURSO_DATABASE_URL + TURSO_AUTH_TOKEN. Local Node→
// Turso TLS needs NODE_EXTRA_CA_CERTS → repo-root win-roots.pem.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@libsql/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SOURCE_MD = 'D:\\Downloads\\SAT%20hit%20parade(1).md';
const OUT_DIR = path.join(ROOT, '.claude', 'scratch', 'vocab-syllabus');

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

/** Parses "N. **word** — gloss" lines within a section, up to the next "# " heading. */
function parseSection(text, sectionHeading) {
  const startIdx = text.indexOf(sectionHeading);
  if (startIdx === -1) throw new Error(`Section not found: ${sectionHeading}`);
  const rest = text.slice(startIdx + sectionHeading.length);
  const nextSectionIdx = rest.search(/\n# (?!#)/);
  const body = nextSectionIdx === -1 ? rest : rest.slice(0, nextSectionIdx);

  const entries = [];
  const lineRe = /^\d+\.\s+\*\*(.+?)\*\*\s+—\s+(.+)$/gm;
  let m;
  while ((m = lineRe.exec(body)) !== null) {
    entries.push({ word: m[1].trim(), gloss: m[2].trim() });
  }
  return entries;
}

async function main() {
  console.log('');
  console.log(bold('  Vocab Syllabus Dedup Analysis [READ-ONLY]'));
  console.log('');

  loadEnv();
  const { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN } = process.env;
  if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) {
    err('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in .env.local');
    process.exit(2);
  }

  const md = fs.readFileSync(SOURCE_MD, 'utf8');
  const satEntries = parseSection(md, '# Section 1 — SAT Hit Parade');
  const greEntries = parseSection(md, '# Section 2 — GRE Hit Parade');
  info(`Parsed SAT: ${satEntries.length} entries, GRE: ${greEntries.length} entries`);

  const client = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN });
  const { rows } = await client.execute('SELECT id, word FROM vocab_words');
  const byLower = new Map(); // lowercase word -> {id, word}
  for (const r of rows) byLower.set(String(r.word).toLowerCase(), { id: Number(r.id), word: String(r.word) });
  info(`Loaded ${rows.length} existing vocab_words for matching`);

  // Merge SAT + GRE into one map keyed by lowercase word, tracking sources + glosses.
  const merged = new Map(); // lowercase -> { word, sources:Set, glosses:{SAT,GRE} }
  for (const [source, list] of [['SAT', satEntries], ['GRE', greEntries]]) {
    for (const { word, gloss } of list) {
      const key = word.toLowerCase();
      if (!merged.has(key)) merged.set(key, { word, sources: new Set(), glosses: {} });
      const entry = merged.get(key);
      entry.sources.add(source);
      entry.glosses[source] = gloss;
    }
  }
  info(`Merged unique incoming words (SAT ∪ GRE): ${merged.size}`);

  const existingMatches = [];
  const newWords = [];
  for (const [key, entry] of merged) {
    const dbMatch = byLower.get(key);
    const record = {
      word: entry.word,
      sources: [...entry.sources].sort(),
      glosses: entry.glosses,
    };
    if (dbMatch) {
      existingMatches.push({ ...record, dbId: dbMatch.id, dbWord: dbMatch.word });
    } else {
      newWords.push(record);
    }
  }
  existingMatches.sort((a, b) => a.word.localeCompare(b.word));
  newWords.sort((a, b) => a.word.localeCompare(b.word));

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, 'dedup-report.json');
  fs.writeFileSync(outPath, JSON.stringify({
    stats: {
      satCount: satEntries.length,
      greCount: greEntries.length,
      uniqueIncoming: merged.size,
      existingMatches: existingMatches.length,
      newWords: newWords.length,
    },
    existingMatches,
    newWords,
  }, null, 2));

  console.log('');
  ok(bold(`Existing matches (already in WordSmart, just need source tags): ${existingMatches.length}`));
  ok(bold(`Genuinely new words (need Codex placement + full record): ${newWords.length}`));
  info(`Report written to ${outPath}`);
  process.exit(0);
}

main().catch((e) => {
  err(`Unexpected error: ${e.message}`);
  process.exit(2);
});
