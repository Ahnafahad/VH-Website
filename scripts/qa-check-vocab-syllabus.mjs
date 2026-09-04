// Mechanical QA pass for Codex-generated new-word records (SAT/GRE integration),
// before any human/DB step. Does NOT touch the DB.
//
// Usage:
//   node scripts/qa-check-vocab-syllabus.mjs <batch-output.json> [--catalog theme-catalog.json]
//
// batch-output.json shape: array of the full record objects described in
// .claude/scratch/vocab-syllabus/codex-system-prompt.md

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const batchPath = args[0];
if (!batchPath) {
  console.error('Usage: node qa-check-vocab-syllabus.mjs <batch-output.json> [--catalog <theme-catalog.json>]');
  process.exit(1);
}
const catalogFlagIdx = args.indexOf('--catalog');
const catalogPath = catalogFlagIdx >= 0
  ? args[catalogFlagIdx + 1]
  : resolve(__dirname, '..', '.claude/scratch/vocab-syllabus/theme-catalog.json');

if (!existsSync(catalogPath)) {
  console.error(`Theme catalog not found: ${catalogPath}`);
  process.exit(1);
}

const batch = JSON.parse(readFileSync(resolve(batchPath), 'utf-8'));
const catalog = JSON.parse(readFileSync(catalogPath, 'utf-8'));
const knownThemeIds = new Set(catalog.themes.map(t => t.themeId));
const knownUnitIds = new Set(catalog.units.map(u => u.unitId));

const VALID_CONNOTATIONS = new Set(['positive', 'negative', 'inapplicable']);
const VALID_GENERAL_CONNOTATIONS = new Set(['positive', 'negative', 'neutral']);
const VALID_POS = new Set(['noun', 'verb', 'adjective', 'adverb']);
const BANNED_PHRASES = [
  'characterized by', 'the quality of', 'the act of', 'a state in which',
  'having the property of', 'of or relating to',
];
const BANNED_LABELS = [
  /^meaning\s*:/i, /^definition\s*:/i, /^example\s*:/i, /^synonyms\s*:/i,
  /^usage\s*:/i, /^etymology\s*:/i, /^adjective\s*[.:]/i, /^verb\s*[.:]/i, /^noun\s*[.:]/i, /^adverb\s*[.:]/i,
];

function wordCount(text) { return text.trim().split(/\s+/).filter(Boolean).length; }
function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function containsHeadword(text, word) {
  return new RegExp(`\\b${escapeRe(word)}\\b`, 'i').test(text);
}
function containsBannedPunctuation(text) {
  return /[()/;"“”‘’]/.test(text);
}

function validPartOfSpeech(pos) {
  return String(pos).split(';').map(s => s.trim()).every(p => VALID_POS.has(p));
}

const results = [];
const seenWords = new Set();
const dupAltTextMap = new Map();

for (const entry of batch) {
  const errors = [];
  const warnings = [];
  const word = entry.word;

  if (!word) {
    errors.push('missing "word"');
    results.push({ word: null, pass: false, errors, warnings });
    continue;
  }
  const wordKey = word.toLowerCase();
  if (seenWords.has(wordKey)) errors.push('duplicate word in this batch output');
  seenWords.add(wordKey);

  // ── Full record fields ──────────────────────────────────────────────────
  if (!entry.definition?.trim()) errors.push('definition is empty');
  if (!Array.isArray(entry.synonyms)) errors.push('synonyms is not an array');
  else if (entry.synonyms.length === 0) warnings.push('synonyms array is empty');
  if (!Array.isArray(entry.antonyms)) errors.push('antonyms is not an array');
  if (!entry.example_sentence?.trim()) errors.push('example_sentence is empty');
  else if (!containsHeadword(entry.example_sentence, word)) warnings.push('example_sentence may not contain the headword (inflected forms not auto-detected)');
  if (!entry.part_of_speech || !validPartOfSpeech(entry.part_of_speech)) errors.push(`part_of_speech "${entry.part_of_speech}" not in noun|verb|adjective|adverb (semicolon-joined ok)`);
  if (entry.difficulty_base !== 3 && entry.difficulty_base !== 4) errors.push(`difficulty_base "${entry.difficulty_base}" must be 3 or 4 per spec (never 1, 2, or 5)`);
  if (!VALID_CONNOTATIONS.has(entry.connotation)) errors.push(`connotation "${entry.connotation}" not in positive|negative|inapplicable`);

  // ── Placement ────────────────────────────────────────────────────────────
  const p = entry.placement;
  if (!p || !p.type) {
    errors.push('placement missing or missing "type"');
  } else if (p.type === 'existing') {
    if (!knownThemeIds.has(p.themeId)) errors.push(`placement.themeId ${p.themeId} not a known existing theme`);
    if (typeof p.confidence !== 'number') warnings.push('placement.confidence missing');
    else if (p.confidence < 0.6) warnings.push(`low placement confidence ${p.confidence}`);
  } else if (p.type === 'new') {
    if (!p.proposedThemeName?.trim()) errors.push('new placement missing proposedThemeName');
    if (!p.centralConcept?.trim()) warnings.push('new placement missing centralConcept');
    if (p.proposedUnitId && !knownUnitIds.has(p.proposedUnitId)) errors.push(`placement.proposedUnitId ${p.proposedUnitId} not a known existing unit`);
    if (!p.proposedUnitId && !p.proposedNewUnitName?.trim()) errors.push('new placement has neither proposedUnitId nor proposedNewUnitName');
  } else if (p.type === 'unassigned') {
    if (!p.reason?.trim()) warnings.push('unassigned placement missing reason');
  } else {
    errors.push(`placement.type "${p.type}" not in existing|new|unassigned`);
  }

  // ── Alt-definition fields (reuse the ultra-concise style rules) ────────────
  const alt = (entry.alt_definition || '').trim();
  if (!alt) errors.push('alt_definition is empty');
  if (!VALID_GENERAL_CONNOTATIONS.has(entry.general_connotation)) errors.push(`general_connotation "${entry.general_connotation}" not in positive|negative|neutral`);

  let altWc = 0;
  if (alt) {
    altWc = wordCount(alt);
    if (altWc > 9) errors.push(`alt_definition too long (${altWc} words, max 9)`);
    if (containsHeadword(alt, word)) errors.push(`alt_definition contains the headword itself ("${word}")`);
    if (/^[A-Z]/.test(alt)) errors.push('alt_definition starts with an uppercase letter');
    if (/[.!?]$/.test(alt)) errors.push('alt_definition ends with sentence punctuation');
    if (containsBannedPunctuation(alt)) errors.push('alt_definition contains banned punctuation');
    if (/:/.test(alt)) errors.push('alt_definition contains a colon');
    for (const phrase of BANNED_PHRASES) {
      if (alt.toLowerCase().includes(phrase)) errors.push(`alt_definition banned phrase: "${phrase}"`);
    }
    for (const re of BANNED_LABELS) {
      if (re.test(alt)) errors.push(`alt_definition banned label pattern: ${re}`);
    }
    if (altWc >= 7 && altWc <= 9) warnings.push(`alt_definition length ${altWc} words — outside preferred 2-6 band`);

    const norm = alt.toLowerCase().replace(/\s+/g, ' ');
    if (!dupAltTextMap.has(norm)) dupAltTextMap.set(norm, []);
    dupAltTextMap.get(norm).push(word);
  }

  results.push({ word, pass: errors.length === 0, errors, warnings });
}

for (const [, words] of dupAltTextMap) {
  if (words.length > 1) {
    for (const w of words) {
      const r = results.find(x => x.word === w);
      if (r) { r.errors.push(`alt_definition near-duplicate text shared with: ${words.filter(x => x !== w).join(', ')}`); r.pass = false; }
    }
  }
}

const n = results.length;
const failed = results.filter(r => !r.pass);
const warned = results.filter(r => r.pass && r.warnings.length);
const newPlacements = batch.filter(e => e.placement?.type === 'new');
const unassigned = batch.filter(e => e.placement?.type === 'unassigned');

console.log(`\n=== QA report: ${basename(batchPath)} (${n} words) ===\n`);
console.log(`HARD FAILS:      ${failed.length}/${n}`);
console.log(`WARNINGS ONLY:   ${warned.length}/${n}`);
console.log(`NEW THEME PROPOSALS: ${newPlacements.length}`);
console.log(`UNASSIGNED:          ${unassigned.length}`);

if (failed.length) {
  console.log('\n--- FAILED ITEMS ---');
  for (const r of failed) console.log(`  [${r.word}] ${r.errors.join(' | ')}`);
}
if (warned.length) {
  console.log('\n--- WARNINGS (passed, review recommended) ---');
  for (const r of warned) console.log(`  [${r.word}] ${r.warnings.join(' | ')}`);
}
if (newPlacements.length) {
  console.log('\n--- NEW THEME PROPOSALS (needs manual review) ---');
  for (const e of newPlacements) console.log(`  [${e.word}] -> "${e.placement.proposedThemeName}" (${e.placement.centralConcept})`);
}
if (unassigned.length) {
  console.log('\n--- UNASSIGNED ---');
  for (const e of unassigned) console.log(`  [${e.word}]: ${e.placement.reason}`);
}

const reportPath = batchPath.replace(/\.json$/, '.qa-report.json');
writeFileSync(reportPath, JSON.stringify({ total: n, failedCount: failed.length, results }, null, 2));
console.log(`\nFull report written to ${reportPath}`);
