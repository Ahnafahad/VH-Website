#!/usr/bin/env node
// scripts/import-sprint.mjs — Sprint set importer/seeder
// Usage: node scripts/import-sprint.mjs <path-to-canonical-json> [--dry-run] [--force]
// Exit codes: 0 ok, 1 validation failure, 2 db failure
//
// Canonical JSON shape (one set per file):
// {
//   "title": "Accounting Round 1", "subject": "accounting",
//   "questions": [
//     { "number": 1, "stem": "...", "options": [{"key":"A","text":"..."}],
//       "correctKey": "A", "explanation": "markdown or null" }
//   ]
// }

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@libsql/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const c = { reset: '\x1b[0m', bold: '\x1b[1m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', gray: '\x1b[90m' };
const ok    = (msg) => console.log(`${c.green}✓${c.reset} ${msg}`);
const err   = (msg) => console.error(`${c.red}✗${c.reset} ${msg}`);
const info  = (msg) => console.log(`${c.cyan}ℹ${c.reset} ${msg}`);
const bold  = (msg) => `${c.bold}${msg}${c.reset}`;
const gray  = (msg) => `${c.gray}${msg}${c.reset}`;

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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (!process.env[key]) process.env[key] = val;
  }
}

const KEY_RE = /^[A-Z]$/;
const VALID_SUBJECTS = new Set(['accounting', 'economics', 'business_studies']);

function validate(data) {
  if (!data.title || !data.title.trim()) throw new Error('title is required');
  if (!VALID_SUBJECTS.has(data.subject)) throw new Error(`subject "${data.subject}" must be one of accounting, economics, business_studies`);
  if (!Array.isArray(data.questions) || data.questions.length === 0) throw new Error('questions array must be non-empty');

  const numbers = new Set();
  let missingExplanation = 0;
  for (const q of data.questions) {
    const qp = `Q${q.number}`;
    if (typeof q.number !== 'number') throw new Error('every question needs a numeric "number"');
    if (numbers.has(q.number)) throw new Error(`duplicate question number ${q.number}`);
    numbers.add(q.number);
    if (!q.stem || !q.stem.trim()) throw new Error(`${qp}: stem is empty`);
    if (!Array.isArray(q.options) || q.options.length < 2) throw new Error(`${qp}: needs ≥2 options`);
    const keys = new Set();
    for (const o of q.options) {
      if (!KEY_RE.test(o.key)) throw new Error(`${qp}: option key "${o.key}" must be a single A-Z letter`);
      if (keys.has(o.key)) throw new Error(`${qp}: duplicate option key "${o.key}"`);
      keys.add(o.key);
      if (!o.text) throw new Error(`${qp}: option "${o.key}" has empty text`);
    }
    if (!q.correctKey) throw new Error(`${qp}: missing correctKey — a sprint set must ship fully keyed`);
    if (!keys.has(q.correctKey)) throw new Error(`${qp}: correctKey "${q.correctKey}" is not one of its own options`);
    if (!q.explanation) missingExplanation++;
  }

  return { totalQuestions: data.questions.length, missingExplanation };
}

function printSummary(data, stats) {
  console.log('');
  console.log(bold(`  ${data.title}`) + gray(` (${data.subject})`));
  console.log(gray(`  ${stats.totalQuestions} questions, ${stats.missingExplanation} without an explanation.`));
  console.log('');
}

async function seed(data, force) {
  const { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN } = process.env;
  if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN)
    throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in .env.local');

  const db = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN });

  const existing = await db.execute({
    sql: 'SELECT id FROM sprint_sets WHERE subject = ? AND title = ?',
    args: [data.subject, data.title],
  });

  let setId;
  if (existing.rows.length > 0) {
    setId = Number(existing.rows[0][0]);
    const attempts = await db.execute({ sql: 'SELECT COUNT(*) FROM sprint_attempts WHERE set_id = ?', args: [setId] });
    const attemptCount = Number(attempts.rows[0][0]);
    if (attemptCount > 0 && !force) {
      throw new Error(
        `Set "${data.title}" (${data.subject}) has ${attemptCount} student attempt(s) recorded. ` +
        'Pass --force to overwrite anyway (this DELETES those attempts and answers).'
      );
    }
    info(`Deleting existing questions for "${data.title}" (id=${setId})…`);
    await db.execute({ sql: 'DELETE FROM sprint_questions WHERE set_id = ?', args: [setId] });
  } else {
    const res = await db.execute({
      sql: `INSERT INTO sprint_sets (subject, title, status) VALUES (?, ?, 'draft')`,
      args: [data.subject, data.title],
    });
    setId = Number(res.lastInsertRowid);
    info(`Inserted sprint_sets row id=${setId}.`);
  }

  for (const q of data.questions) {
    await db.execute({
      sql: `INSERT INTO sprint_questions (set_id, number, stem, options, correct_key, explanation)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [setId, q.number, q.stem, JSON.stringify(q.options), q.correctKey, q.explanation ?? null],
    });
  }
  ok(`${data.questions.length} questions inserted.`);

  return setId;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help')) {
    console.log('Usage: node scripts/import-sprint.mjs <path-to-json> [--dry-run] [--force]');
    process.exit(0);
  }
  const jsonArg = args.find(a => !a.startsWith('--'));
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');
  if (!jsonArg) { err('No JSON file path provided.'); process.exit(1); }

  const jsonPath = path.resolve(process.cwd(), jsonArg);
  if (!fs.existsSync(jsonPath)) { err(`File not found: ${jsonPath}`); process.exit(1); }

  loadEnv();

  console.log('');
  console.log(bold(`  VH Sprint Importer${dryRun ? ' [DRY RUN]' : ''}`));
  console.log(gray(`  File: ${jsonPath}`));

  let data;
  try {
    data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch (e) {
    err(`JSON parse error: ${e.message}`);
    process.exit(1);
  }
  ok('JSON parsed.');

  info('Validating…');
  let stats;
  try {
    stats = validate(data);
  } catch (e) {
    err(`Validation failed: ${e.message}`);
    process.exit(1);
  }
  ok('Structure valid.');

  printSummary(data, stats);

  if (dryRun) {
    ok(bold('Dry run complete — no DB writes performed.'));
    console.log('');
    process.exit(0);
  }

  info('Connecting to Turso…');
  try {
    const setId = await seed(data, force);
    ok(bold(`Import complete. Set status = draft (id=${setId}).`));
    info('Activate it from /admin/sprint before students can see it.');
  } catch (e) {
    err(e.message.includes('attempt') ? e.message : `DB error: ${e.message}`);
    process.exit(2);
  }
  console.log('');
}

main().catch(e => {
  err(`Unexpected error: ${e.message}`);
  process.exit(2);
});
