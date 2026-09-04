#!/usr/bin/env node
// scripts/seed-new-syllabus-words.mjs — Inserts the 203 genuinely-new SAT/GRE
// words (Codex-generated content, QA-checked, thematically placed onto the
// existing WordSmart unit/theme taxonomy — see
// .claude/scratch/vocab-syllabus/combined-final.json) into vocab_words +
// vocab_word_alt_definitions, then links every word (new or pre-existing) to
// its SAT/GRE syllabus/es via vocab_word_syllabuses.
//
// One of the 203 ("renaissance") turned out to already exist in the 805-word
// WordSmart corpus (id 1699) — for that word this script skips the
// vocab_words/vocab_word_alt_definitions insert and only adds the missing
// syllabus link, exactly as it would for any word matched by case-insensitive
// headword against the existing table. This makes the script safely re-runnable
// and required no special-casing.
//
// Idempotent: matches words by case-insensitive headword against vocab_words,
// and skips any (word_id, syllabus_id) pair already present in
// vocab_word_syllabuses.
// Alt-definitions are written with status='draft' (schema default) — flip via
// scripts/approve-vocab-alt-definitions.mjs once spot-checked.
//
// Usage:
//   node scripts/seed-new-syllabus-words.mjs --dry-run   # plan only, no DB writes
//   node scripts/seed-new-syllabus-words.mjs --apply     # write to Turso
//
// Requires .env.local with TURSO_DATABASE_URL + TURSO_AUTH_TOKEN. Local Node→
// Turso TLS needs NODE_EXTRA_CA_CERTS → repo-root win-roots.pem, e.g.:
//   $env:NODE_EXTRA_CA_CERTS="D:\VH Website\win-roots.pem"; node scripts/seed-new-syllabus-words.mjs --apply
// Exit codes: 0 ok, 1 usage/parse, 2 db failure.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { vocabWords, vocabWordAltDefinitions, vocabWordSyllabuses } from '../src/lib/db/schema.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SCRATCH = path.join(ROOT, '.claude/scratch/vocab-syllabus');

const WORD_FILES = [
  'pilot-output.json',
  'batches/batch-1-remaining-output.json',
  'batches/batch-2-output.json',
  'batches/batch-3-output.json',
  'batches/batch-4-output.json',
  'batches/batch-5-output.json',
  'batches/batch-6-output.json',
  'batches/batch-7-output.json',
  'batches/batch-8-output.json',
  'batches/batch-9-output.json',
  'batches/batch-10-output.json',
  'batches/batch-11-output.json',
];
const SOURCES_MAP_PATH = path.join(SCRATCH, 'word-sources-map.json');
const THEME_CATALOG_PATH = path.join(SCRATCH, 'theme-catalog.json');
const SYLLABUS_ID = { SAT: 1, GRE: 2 };

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
  console.log(bold(`  New Syllabus Words Seeder${dryRun ? ' [DRY RUN]' : ''}`));
  console.log('');

  let words = [];
  for (const f of WORD_FILES) {
    const arr = JSON.parse(fs.readFileSync(path.join(SCRATCH, f), 'utf-8'));
    words = words.concat(arr);
  }
  const sourcesMap = JSON.parse(fs.readFileSync(SOURCES_MAP_PATH, 'utf-8'));
  const themeCatalog = JSON.parse(fs.readFileSync(THEME_CATALOG_PATH, 'utf-8'));
  const themeById = new Map(themeCatalog.themes.map((t) => [t.themeId, t]));
  info(`Loaded ${words.length} word record(s) from ${WORD_FILES.length} batch output file(s)`);

  const seen = new Set();
  for (const w of words) {
    if (seen.has(w.word)) { err(`Duplicate word headword in source data: ${w.word}`); process.exit(1); }
    seen.add(w.word);
    if (w.placement?.type !== 'existing') {
      err(`Word "${w.word}" has non-existing placement type: ${w.placement?.type}`);
      process.exit(1);
    }
    if (!themeById.has(w.placement.themeId)) {
      err(`Word "${w.word}" placement.themeId ${w.placement.themeId} not found in theme catalog`);
      process.exit(1);
    }
    if (!sourcesMap[w.word] || sourcesMap[w.word].length === 0) {
      err(`Word "${w.word}" has no sources in ${path.basename(SOURCES_MAP_PATH)}`);
      process.exit(1);
    }
  }
  ok('Source data validated: no duplicate headwords, all placements existing+valid, all sources present');

  loadEnv();
  const { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN } = process.env;
  if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) {
    err('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in .env.local');
    process.exit(dryRun ? 0 : 2);
  }

  const client = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN });
  const db = drizzle(client);

  const existingWordsResult = await client.execute('SELECT id, word FROM vocab_words');
  const existingIdByLowerWord = new Map(existingWordsResult.rows.map((r) => [String(r.word).toLowerCase(), Number(r.id)]));

  const linksResult = await client.execute('SELECT word_id, syllabus_id FROM vocab_word_syllabuses');
  const existingLinks = new Set(linksResult.rows.map((r) => `${r.word_id}:${r.syllabus_id}`));

  const toInsertWord = words.filter((w) => !existingIdByLowerWord.has(w.word.toLowerCase()));
  const toSkipWord = words.filter((w) => existingIdByLowerWord.has(w.word.toLowerCase()));
  info(`${toInsertWord.length} word(s) are genuinely new — would insert vocab_words + vocab_word_alt_definitions`);
  if (toSkipWord.length > 0) {
    info(`${toSkipWord.length} word(s) already exist in vocab_words — would only link syllabus(es): ${toSkipWord.map((w) => w.word).join(', ')}`);
  }

  // Plan syllabus links, using each word's known-or-about-to-be-created id.
  const plannedLinks = [];
  for (const w of words) {
    const existingId = existingIdByLowerWord.get(w.word.toLowerCase());
    for (const src of sourcesMap[w.word]) {
      const syllabusId = SYLLABUS_ID[src];
      if (existingId && existingLinks.has(`${existingId}:${syllabusId}`)) continue; // already linked
      plannedLinks.push({ word: w.word, existingId, syllabusId, source: src });
    }
  }
  const satLinks = plannedLinks.filter((l) => l.source === 'SAT').length;
  const greLinks = plannedLinks.filter((l) => l.source === 'GRE').length;
  info(`${plannedLinks.length} vocab_word_syllabuses row(s) planned (SAT: ${satLinks}, GRE: ${greLinks})`);

  if (dryRun) {
    console.log('');
    info(`[dry-run] would insert ${toInsertWord.length} vocab_words row(s)`);
    info(`[dry-run] would insert ${toInsertWord.length} vocab_word_alt_definitions row(s), status='draft'`);
    info(`[dry-run] would insert ${plannedLinks.length} vocab_word_syllabuses row(s)`);
    console.log('');
    ok(bold('Dry run complete — no DB writes performed.'));
    process.exit(0);
  }

  let wordsInserted = 0;
  let altDefsInserted = 0;
  const idByWord = new Map();
  for (const w of toSkipWord) idByWord.set(w.word, existingIdByLowerWord.get(w.word.toLowerCase()));

  for (const w of toInsertWord) {
    const theme = themeById.get(w.placement.themeId);
    const [wordRow] = await db.insert(vocabWords).values({
      themeId: w.placement.themeId,
      unitId: theme.unitId,
      word: w.word,
      definition: w.definition,
      synonyms: JSON.stringify(w.synonyms ?? []),
      antonyms: JSON.stringify(w.antonyms ?? []),
      exampleSentence: w.example_sentence,
      partOfSpeech: w.part_of_speech,
      difficultyBase: w.difficulty_base,
      connotation: w.connotation,
    }).returning({ id: vocabWords.id });
    idByWord.set(w.word, wordRow.id);
    wordsInserted++;

    await db.insert(vocabWordAltDefinitions).values({
      wordId: wordRow.id,
      altDefinition: w.alt_definition,
      generalConnotation: w.general_connotation,
    });
    altDefsInserted++;
  }

  let linksInserted = 0;
  for (const l of plannedLinks) {
    const wordId = idByWord.get(l.word);
    await db.insert(vocabWordSyllabuses).values({ wordId, syllabusId: l.syllabusId });
    linksInserted++;
  }

  console.log('');
  ok(bold(`Seed complete — ${wordsInserted} new word(s), ${altDefsInserted} alt-definition(s), ${linksInserted} syllabus link(s) inserted.`));
  process.exit(0);
}

main().catch((e) => {
  err(`Unexpected error: ${e.message}`);
  process.exit(2);
});
