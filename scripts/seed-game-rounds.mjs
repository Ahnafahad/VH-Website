/**
 * seed-game-rounds.mjs
 * Seeds Word Hunt daily rounds from scripts/data/vocab-game-rounds/rounds-{a,b,c}.json
 * into vocab_game_rounds. Upserts by round_date.
 *
 * Run (Windows PowerShell, from vh-website/):
 *   $env:NODE_EXTRA_CA_CERTS="D:\VH Website\win-roots.pem"; node scripts/seed-game-rounds.mjs
 *
 * Pass --dry-run to validate + resolve words without writing.
 */

import { createClient } from '@libsql/client';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRY_RUN = process.argv.includes('--dry-run');

const client = createClient({
  url:       'libsql://vh-beyond-the-horizon-ahnafahad.aws-ap-south-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzUxNDUzODYsImlkIjoiMDE5ZDRjZGQtZmMwMS03Njc2LTkwODItNjUxYjlhMWUzMTVhIiwicmlkIjoiMjAxZGQ5ZDktYTEwYi00ZTA4LTg3ODgtMWMyMmRmZmMyODgxIn0.vw7b-JVuzAts5PP4rzgMwhKV-XRVLkXl_Lxfta5YUgtbUORsiHqFU6Tkb0Ll_D4L4tKeAM-lxF5e-OT_McZ_Aw',
});

const FIRST_DATE = '2026-07-19';
const LAST_DATE  = '2027-01-01';

const REQUIRED_STRING_FIELDS = [
  'date', 'word', 'intendedMeaning', 'definition', 'wordType', 'tone', 'topic',
  'clue1Distinction', 'clue3Note', 'clue4ContextSentence',
  'clue5FirstLetter', 'clue5Extra', 'modelSentence', 'failExplanation',
];

function fail(msg) { console.error(`✗ ${msg}`); process.exitCode = 1; }

// ── Load + merge ──────────────────────────────────────────────────────────────

const rounds = [];
for (const part of ['a', 'b', 'c']) {
  const p = resolve(__dirname, 'data', 'vocab-game-rounds', `rounds-${part}.json`);
  if (!existsSync(p)) { fail(`missing file: ${p}`); continue; }
  const arr = JSON.parse(readFileSync(p, 'utf8'));
  if (!Array.isArray(arr)) { fail(`${p} is not a JSON array`); continue; }
  rounds.push(...arr);
}
if (process.exitCode) process.exit();

// ── Validate ──────────────────────────────────────────────────────────────────

const seenDates = new Set();
const seenWords = new Set();
for (const r of rounds) {
  const tag = r?.date ?? '(no date)';
  for (const f of REQUIRED_STRING_FIELDS) {
    if (typeof r[f] !== 'string' || !r[f].trim()) fail(`${tag}: missing/empty field "${f}"`);
  }
  if (!Array.isArray(r.acceptedAnswers) || r.acceptedAnswers.length < 1) fail(`${tag}: bad acceptedAnswers`);
  if (!Array.isArray(r.clue2Characteristics) || r.clue2Characteristics.length < 3) fail(`${tag}: clue2Characteristics needs >=3`);
  if (!Array.isArray(r.clue6Choices) || r.clue6Choices.length !== 3) fail(`${tag}: clue6Choices must have exactly 3`);
  else if (!r.clue6Choices.map(c => c.toLowerCase()).includes(r.word.toLowerCase())) fail(`${tag}: answer not in clue6Choices`);
  if (!Array.isArray(r.relatedGuesses) || r.relatedGuesses.length < 3) fail(`${tag}: relatedGuesses needs >=3`);
  if (!['positive', 'negative', 'neutral'].includes(r.tone)) fail(`${tag}: bad tone "${r.tone}"`);
  if (r.clue5FirstLetter.toLowerCase() !== r.word[0].toLowerCase()) fail(`${tag}: clue5FirstLetter mismatch`);
  if (seenDates.has(r.date)) fail(`duplicate date ${r.date}`);
  seenDates.add(r.date);
  const w = r.word.toLowerCase();
  if (seenWords.has(w)) fail(`duplicate word "${r.word}" (${tag})`);
  seenWords.add(w);
}

// Date continuity: every day FIRST_DATE..LAST_DATE present, nothing outside.
const expected = [];
for (let d = new Date(`${FIRST_DATE}T00:00:00Z`); ; d.setUTCDate(d.getUTCDate() + 1)) {
  const iso = d.toISOString().slice(0, 10);
  expected.push(iso);
  if (iso === LAST_DATE) break;
}
for (const iso of expected) if (!seenDates.has(iso)) fail(`missing date ${iso}`);
for (const iso of seenDates) if (!expected.includes(iso)) fail(`unexpected date ${iso}`);

if (process.exitCode) { console.error(`\nValidation failed — nothing written.`); process.exit(); }
console.log(`✓ ${rounds.length} rounds validated (${FIRST_DATE} → ${LAST_DATE})`);

// ── Resolve word ids ──────────────────────────────────────────────────────────

const res = await client.execute('SELECT id, word FROM vocab_words');
const wordIds = new Map(res.rows.map(row => [String(row.word).trim().toLowerCase(), Number(row.id)]));

const unresolved = [];
for (const r of rounds) {
  const id = wordIds.get(r.word.trim().toLowerCase());
  if (!id) unresolved.push(`${r.date}: "${r.word}"`);
  else r._wordId = id;
}
if (unresolved.length) {
  fail(`words not found in vocab_words (${unresolved.length}):\n  ` + unresolved.join('\n  '));
  console.error(`\nNothing written.`);
  process.exit();
}
console.log(`✓ all ${rounds.length} words resolved against vocab_words (${wordIds.size} words in bank)`);

if (DRY_RUN) { console.log('Dry run — no writes.'); process.exit(0); }

// ── Upsert ────────────────────────────────────────────────────────────────────

let written = 0;
for (const r of rounds) {
  const { _wordId, ...content } = r;
  await client.execute({
    sql: `INSERT INTO vocab_game_rounds (round_date, word_id, content)
          VALUES (?, ?, ?)
          ON CONFLICT(round_date) DO UPDATE SET
            word_id = excluded.word_id,
            content = excluded.content,
            updated_at = unixepoch()`,
    args: [r.date, _wordId, JSON.stringify(content)],
  });
  written++;
  if (written % 25 === 0) console.log(`  …${written}/${rounds.length}`);
}

const check = await client.execute('SELECT COUNT(*) AS n, MIN(round_date) AS a, MAX(round_date) AS b FROM vocab_game_rounds');
console.log(`✓ upserted ${written} rounds; table now has ${check.rows[0].n} (${check.rows[0].a} → ${check.rows[0].b})`);
client.close();
