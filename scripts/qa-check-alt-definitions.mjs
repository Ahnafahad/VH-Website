// Mechanical QA pass for Codex-generated alt-definitions, before any human/DB step.
// Does NOT touch the DB. Pure text/structure checks against the ultra-concise style
// spec's hard rules + corpus-level distributional targets.
//
// Usage:
//   node scripts/qa-check-alt-definitions.mjs <batch-output.json> [--words words-snapshot.json]
//
// batch-output.json shape: [{ word_id, alt_definition, general_connotation }, ...]

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const batchPath = args[0];
if (!batchPath) {
  console.error('Usage: node qa-check-alt-definitions.mjs <batch-output.json> [--words <snapshot.json>]');
  process.exit(1);
}
const wordsFlagIdx = args.indexOf('--words');
const wordsPath = wordsFlagIdx >= 0
  ? args[wordsFlagIdx + 1]
  : resolve(__dirname, '..', '.claude/scratch/vocab-alt-defs/words-snapshot.json');

if (!existsSync(wordsPath)) {
  console.error(`Words snapshot not found: ${wordsPath}`);
  process.exit(1);
}

const batch = JSON.parse(readFileSync(resolve(batchPath), 'utf-8'));
const words  = JSON.parse(readFileSync(wordsPath, 'utf-8'));
const wordById = new Map(words.map(w => [w.id, w]));

const BANNED_PHRASES = [
  'characterized by', 'the quality of', 'the act of', 'a state in which',
  'having the property of', 'of or relating to',
];
const BANNED_LABELS = [
  /^meaning\s*:/i, /^definition\s*:/i, /^example\s*:/i, /^synonyms\s*:/i,
  /^usage\s*:/i, /^etymology\s*:/i, /^adjective\s*[.:]/i, /^verb\s*[.:]/i, /^noun\s*[.:]/i, /^adverb\s*[.:]/i,
];
const VALID_CONNOTATIONS = new Set(['positive', 'negative', 'neutral']);

function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function containsHeadword(text, word) {
  return new RegExp(`\\b${escapeRe(word)}\\b`, 'i').test(text);
}
function startsWithUppercase(text) {
  return /^[A-Z]/.test(text);
}
function endsWithPunctuation(text) {
  return /[.!?]$/.test(text.trim());
}
function containsBannedPunctuation(text) {
  // Note: plain apostrophe (') is allowed for possessives/contractions (e.g. "story's").
  return /[()/;"“”‘’]/.test(text);
}
function containsColon(text) {
  return /:/.test(text);
}
function inCoreBand(wc) { return wc >= 2 && wc <= 4; }
function inWideBand(wc) { return wc >= 2 && wc <= 6; }
function inLongBand(wc) { return wc >= 7 && wc <= 9; }

const results = [];
const seenIds = new Set();
const dupTextMap = new Map(); // normalized text -> [word_ids]

for (const entry of batch) {
  const { word_id, alt_definition, general_connotation } = entry;
  const errors = [];
  const warnings = [];

  const w = wordById.get(word_id);
  if (!w) {
    errors.push(`word_id ${word_id} not found in words snapshot`);
    results.push({ word_id, word: null, pass: false, errors, warnings });
    continue;
  }
  if (seenIds.has(word_id)) errors.push('duplicate word_id in this batch output');
  seenIds.add(word_id);

  const text = (alt_definition || '').trim();
  if (!text) errors.push('alt_definition is empty');

  if (!VALID_CONNOTATIONS.has(general_connotation)) {
    errors.push(`general_connotation "${general_connotation}" not in positive|negative|neutral`);
  }

  let wc = 0;
  if (text) {
    wc = wordCount(text);
    if (wc < 1) errors.push('empty after trim');
    if (wc > 9) errors.push(`too long (${wc} words, max 9)`);

    if (containsHeadword(text, w.word)) errors.push(`contains the headword itself ("${w.word}")`);
    if (startsWithUppercase(text)) errors.push('starts with an uppercase letter (should be lowercase)');
    if (endsWithPunctuation(text)) errors.push('ends with sentence punctuation (. ! ?)');
    if (containsBannedPunctuation(text)) errors.push('contains banned punctuation (parens/slash/semicolon/quotes)');
    if (containsColon(text)) errors.push('contains a colon');

    for (const phrase of BANNED_PHRASES) {
      if (text.toLowerCase().includes(phrase)) errors.push(`banned dictionary-language phrase: "${phrase}"`);
    }
    for (const re of BANNED_LABELS) {
      if (re.test(text)) errors.push(`banned label pattern: ${re}`);
    }

    if (wc >= 7 && wc <= 9) warnings.push(`length ${wc} words — outside preferred 2-6 band, only ok if shorter phrase would mislead`);

    const norm = text.toLowerCase().replace(/\s+/g, ' ');
    if (!dupTextMap.has(norm)) dupTextMap.set(norm, []);
    dupTextMap.get(norm).push(word_id);
  }

  results.push({
    word_id, word: w.word, pass: errors.length === 0, errors, warnings,
    _wc: wc,
    _core: wc ? inCoreBand(wc) : false,
    _wide: wc ? inWideBand(wc) : false,
    _long: wc ? inLongBand(wc) : false,
    _single: wc === 1,
    _hasAnd: text ? / and /i.test(text) : false,
    _hasOr: text ? / or /i.test(text) : false,
  });
}

// batch-level duplicate text check
for (const [, ids] of dupTextMap) {
  if (ids.length > 1) {
    for (const id of ids) {
      const r = results.find(x => x.word_id === id);
      if (r) r.errors.push(`near-duplicate text shared with word_id(s) ${ids.filter(i => i !== id).join(', ')}`);
      r.pass = false;
    }
  }
}

// corpus-level distributional stats (informational — not per-item hard fails)
const n = results.length;
const coreBand   = results.filter(r => r._core).length;
const wideBand   = results.filter(r => r._wide).length;
const longBand   = results.filter(r => r._long).length;
const singleWord = results.filter(r => r._single).length;
const andCount   = results.filter(r => r._hasAnd).length;
const orCount    = results.filter(r => r._hasOr).length;
const avgWc      = n ? (results.reduce((s, r) => s + r._wc, 0) / n).toFixed(1) : 0;

const failed = results.filter(r => !r.pass);
const warned = results.filter(r => r.pass && r.warnings.length);

console.log(`\n=== QA report: ${basename(batchPath)} (${n} words) ===\n`);
console.log(`HARD FAILS:      ${failed.length}/${n}`);
console.log(`WARNINGS ONLY:   ${warned.length}/${n}`);
console.log('');
console.log('--- corpus-level distribution (target) ---');
console.log(`2-4 words (preferred):  ${pct(coreBand, n)}`);
console.log(`2-6 words (default):    ${pct(wideBand, n)}`);
console.log(`7-9 words (occasional): ${pct(longBand, n)}  (target: <5% of large corpus)`);
console.log(`1 word:                 ${pct(singleWord, n)}  (target: 5-10% of large corpus)`);
console.log(`contains " and ":       ${pct(andCount, n)}`);
console.log(`contains " or ":        ${pct(orCount, n)}`);
console.log(`average word count:     ${avgWc}`);

if (failed.length) {
  console.log('\n--- FAILED ITEMS ---');
  for (const r of failed) {
    console.log(`  [${r.word_id}] ${r.word}: ${r.errors.join(' | ')}`);
  }
}
if (warned.length) {
  console.log('\n--- WARNINGS (passed, review recommended) ---');
  for (const r of warned) {
    console.log(`  [${r.word_id}] ${r.word}: ${r.warnings.join(' | ')}`);
  }
}

function pct(x, total) { return total ? `${x}/${total} (${Math.round(100 * x / total)}%)` : '0/0'; }

const reportPath = batchPath.replace(/\.json$/, '.qa-report.json');
writeFileSync(reportPath, JSON.stringify({
  total: n,
  failedCount: failed.length,
  distribution: { coreBand, wideBand, longBand, singleWord, andCount, orCount, avgWc },
  results,
}, null, 2));
console.log(`\nFull report written to ${reportPath}`);
console.log(`Failed word_ids: [${failed.map(r => r.word_id).join(', ')}]`);
