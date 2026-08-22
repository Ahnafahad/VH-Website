#!/usr/bin/env node
// scripts/import-marathon.mjs — Math Marathon chapter importer/seeder
// Usage: node scripts/import-marathon.mjs <path-to-canonical-json> [--dry-run] [--force]
// Exit codes: 0 ok, 1 validation failure, 2 db failure
//
// Canonical JSON shape (produced by scripts/prep-marathon-from-tagged-json.mjs,
// or written by hand for a chapter that didn't come from that raw format):
// {
//   "slug": "number-system", "title": "Number System", "subject": "math", "product": "iba",
//   "days": [
//     { "day": 1, "questions": [
//       { "number": 1, "stem": "...", "options": [{"key":"A","text":"..."}],
//         "correctKey": "E", "solution": "markdown or null", "imageUrl": null,
//         "primaryTag": {"code":"1.1.2","label":"..."} | null,
//         "secondaryTag": {"code":"1.6.1","label":"..."} | null }
//     ] }
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

const KEBAB_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const KEY_RE = /^[A-Z]$/;

function validateTag(tag, prefix) {
  if (tag === null || tag === undefined) return;
  if (typeof tag.code !== 'string' || !tag.code) throw new Error(`${prefix}: tag missing code`);
  if (typeof tag.label !== 'string' || !tag.label) throw new Error(`${prefix}: tag "${tag.code}" missing label`);
}

function validate(data) {
  if (typeof data.slug !== 'string' || !KEBAB_RE.test(data.slug))
    throw new Error(`slug "${data.slug}" is not valid kebab-case`);
  if (!data.title) throw new Error('title is required');
  if (!Array.isArray(data.days) || data.days.length === 0) throw new Error('days array must be non-empty');

  const dayNumbers = new Set();
  let totalQuestions = 0;
  let questionsPerDay = null;
  const dayStats = [];

  for (const day of data.days) {
    const prefix = `Day ${day.day}`;
    if (typeof day.day !== 'number') throw new Error('every day needs a numeric "day"');
    if (dayNumbers.has(day.day)) throw new Error(`duplicate day number ${day.day}`);
    dayNumbers.add(day.day);
    if (!Array.isArray(day.questions) || day.questions.length === 0)
      throw new Error(`${prefix}: questions array must be non-empty`);
    if (questionsPerDay === null) questionsPerDay = day.questions.length;

    const numbers = new Set();
    let unkeyed = 0, missingSolution = 0;
    for (const q of day.questions) {
      const qp = `${prefix} Q${q.number}`;
      if (typeof q.number !== 'number') throw new Error(`${prefix}: question missing numeric "number"`);
      if (numbers.has(q.number)) throw new Error(`${prefix}: duplicate question number ${q.number}`);
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
      if (!q.correctKey) { unkeyed++; continue; }
      if (!keys.has(q.correctKey)) throw new Error(`${qp}: correctKey "${q.correctKey}" is not one of its own options`);
      if (!q.solution) missingSolution++;
      validateTag(q.primaryTag, qp);
      validateTag(q.secondaryTag, qp);
    }
    if (unkeyed > 0) throw new Error(`${prefix}: ${unkeyed} question(s) missing correctKey — a marathon day must ship fully keyed`);
    dayStats.push({ day: day.day, questions: day.questions.length, missingSolution });
    totalQuestions += day.questions.length;
  }

  return { dayStats, totalQuestions, totalDays: data.days.length, questionsPerDay };
}

function printSummary(data, stats) {
  console.log('');
  console.log(bold(`  ${data.title}`) + gray(` (${data.slug})`));
  console.log(gray(`  subject=${data.subject ?? 'math'} product=${data.product ?? 'iba'}`));
  console.log('');
  console.log(`  ${'Day'.padEnd(6)}${'Questions'.padEnd(12)}${'Missing solution'}`);
  for (const d of stats.dayStats) {
    console.log(`  ${String(d.day).padEnd(6)}${String(d.questions).padEnd(12)}${d.missingSolution > 0 ? gray(`${d.missingSolution} (shows "coming soon")`) : gray('0')}`);
  }
  console.log('');
  console.log(gray(`  ${stats.totalDays} days, ${stats.totalQuestions} questions total.`));
  console.log('');
}

async function seed(data, force) {
  const { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN } = process.env;
  if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN)
    throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in .env.local');

  const db = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN });
  const subject = data.subject ?? 'math';
  const product = data.product ?? 'iba';

  const existing = await db.execute({ sql: 'SELECT id FROM marathon_chapters WHERE slug = ?', args: [data.slug] });

  let chapterId;
  if (existing.rows.length > 0) {
    chapterId = Number(existing.rows[0][0]);
    const dayIds = await db.execute({ sql: 'SELECT id FROM marathon_days WHERE chapter_id = ?', args: [chapterId] });
    if (dayIds.rows.length > 0) {
      const placeholders = dayIds.rows.map(() => '?').join(',');
      const attempts = await db.execute({
        sql: `SELECT COUNT(*) FROM marathon_attempts WHERE day_id IN (${placeholders})`,
        args: dayIds.rows.map(r => r[0]),
      });
      const attemptCount = Number(attempts.rows[0][0]);
      if (attemptCount > 0 && !force) {
        throw new Error(
          `Chapter "${data.slug}" has ${attemptCount} student attempt(s) recorded against its current days. ` +
          'Pass --force to overwrite anyway (this DELETES those attempts and answers).'
        );
      }
    }
    info(`Deleting existing days for "${data.slug}" (id=${chapterId})…`);
    await db.execute({ sql: 'DELETE FROM marathon_days WHERE chapter_id = ?', args: [chapterId] });
    await db.execute({
      sql: `UPDATE marathon_chapters SET title=?, subject=?, product=?, total_days=?, questions_per_day=? WHERE id=?`,
      args: [data.title, subject, product, data.days.length, data.days[0].questions.length, chapterId],
    });
    info('Updated marathon_chapters row.');
  } else {
    const res = await db.execute({
      sql: `INSERT INTO marathon_chapters (slug, title, subject, product, total_days, questions_per_day, status)
            VALUES (?, ?, ?, ?, ?, ?, 'draft')`,
      args: [data.slug, data.title, subject, product, data.days.length, data.days[0].questions.length],
    });
    chapterId = Number(res.lastInsertRowid);
    info(`Inserted marathon_chapters row id=${chapterId}.`);
  }

  for (const day of data.days) {
    const dayRes = await db.execute({
      sql: `INSERT INTO marathon_days (chapter_id, day_number, total_questions) VALUES (?, ?, ?)`,
      args: [chapterId, day.day, day.questions.length],
    });
    const dayId = Number(dayRes.lastInsertRowid);
    for (const q of day.questions) {
      await db.execute({
        sql: `INSERT INTO marathon_questions
                (day_id, number, stem, options, correct_key, solution, image_url,
                 primary_tag_code, primary_tag_label, secondary_tag_code, secondary_tag_label)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          dayId, q.number, q.stem, JSON.stringify(q.options), q.correctKey, q.solution ?? null, q.imageUrl ?? null,
          q.primaryTag?.code ?? null, q.primaryTag?.label ?? null,
          q.secondaryTag?.code ?? null, q.secondaryTag?.label ?? null,
        ],
      });
    }
    ok(`  Day ${day.day}: ${day.questions.length} questions inserted.`);
  }

  return chapterId;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help')) {
    console.log('Usage: node scripts/import-marathon.mjs <path-to-json> [--dry-run] [--force]');
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
  console.log(bold(`  VH Marathon Importer${dryRun ? ' [DRY RUN]' : ''}`));
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
    const chapterId = await seed(data, force);
    ok(bold(`Import complete. Chapter status = draft (id=${chapterId}).`));
    info('Publish it (mark status=\'published\') and create a marathon_assignments row via /admin/marathon before students can see it.');
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
