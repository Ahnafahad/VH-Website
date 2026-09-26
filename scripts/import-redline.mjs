#!/usr/bin/env node
// scripts/import-redline.mjs — Redline (Sentence Correction Mastery) importer
// Usage: node scripts/import-redline.mjs <path-to-question-bank.md> [--apply] [--relevel]
//   default            dry run: parse, validate, print the level plan, write nothing
//   --apply            create tables if missing, upsert all questions (by source number)
//   --relevel          also rewrite level/position for existing questions even when students
//                      already have attempts (otherwise assignments are frozen once attempts exist)
// Exit codes: 0 ok, 1 validation failure, 2 db failure
//
// The bank itself is NOT stored in this repo (the repo is public and the bank holds the full
// answer key) — pass its path each time. Content lives only in the database.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@libsql/client';
import { parseBank } from './redline/parse-bank.mjs';
import { buildAll } from './redline/build-content.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const c = { reset: '\x1b[0m', bold: '\x1b[1m', red: '\x1b[31m', green: '\x1b[32m', cyan: '\x1b[36m', gray: '\x1b[90m' };
const ok = (m) => console.log(`${c.green}✓${c.reset} ${m}`);
const err = (m) => console.error(`${c.red}✗${c.reset} ${m}`);
const info = (m) => console.log(`${c.cyan}ℹ${c.reset} ${m}`);

function loadEnv() {
  const envPath = path.join(ROOT, '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (!process.env[key]) process.env[key] = val;
  }
}

const DDL = fs.readFileSync(path.join(__dirname, 'redline/schema.sql'), 'utf8');

function printPlan(rows, nLevels) {
  const held = rows.filter(r => r.status === 'held');
  console.log('');
  console.log(`  ${rows.length} questions parsed · ${rows.length - held.length} live in ${nLevels} levels · ${held.length} held out`);
  if (held.length) console.log(`  held: ${held.map(r => `Q${r.number} (${r.holdReason})`).join(', ')}`);
  const by = new Map();
  for (const r of rows) if (r.level) (by.get(r.level) ?? by.set(r.level, []).get(r.level)).push(r);
  for (const [l, items] of [...by].filter(([l]) => [1, 2, 10, 21, 32, 42].includes(l))) {
    const d = items.map(i => i.difficultyScore);
    console.log(`  L${String(l).padStart(2)}: ${items.length} Qs · difficulty ${Math.min(...d).toFixed(2)}–${Math.max(...d).toFixed(2)} · ${new Set(items.map(i => i.skillId)).size} skills`);
  }
  console.log('');
}

async function apply(rows, relevel) {
  const { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN } = process.env;
  if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in .env.local');
  const db = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN });

  await db.executeMultiple(DDL);
  ok('Tables ready.');

  const attempts = Number((await db.execute('SELECT COUNT(*) FROM redline_attempts')).rows[0][0]);
  const freezeLevels = attempts > 0 && !relevel;
  if (freezeLevels) info(`${attempts} attempt(s) exist — level/position assignments are frozen (pass --relevel to override).`);

  const levelSet = freezeLevels ? '' : 'level = excluded.level, position = excluded.position, ';
  const stmt = (r) => ({
    sql: `INSERT INTO redline_questions
            (number, source_id, level, position, status, hold_reason, skill_id, secondary_skills,
             difficulty_label, difficulty_score, correct_key, content, staff)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
          ON CONFLICT(number) DO UPDATE SET
            source_id = excluded.source_id, ${levelSet}status = excluded.status, hold_reason = excluded.hold_reason,
            skill_id = excluded.skill_id, secondary_skills = excluded.secondary_skills,
            difficulty_label = excluded.difficulty_label, difficulty_score = excluded.difficulty_score,
            correct_key = excluded.correct_key, content = excluded.content, staff = excluded.staff`,
    args: [r.number, r.sourceId, r.level, r.position, r.status, r.holdReason, r.skillId,
      JSON.stringify(r.secondarySkills), r.difficultyLabel, r.difficultyScore, r.correctKey,
      JSON.stringify(r.content), JSON.stringify(r.staff)],
  });
  const BATCH = 25;
  for (let i = 0; i < rows.length; i += BATCH) {
    await db.batch(rows.slice(i, i + BATCH).map(stmt), 'write');
    process.stdout.write(`\r  upserted ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
  }
  console.log('');

  const check = await db.execute('SELECT COUNT(*), COUNT(level), COUNT(DISTINCT level) FROM redline_questions');
  ok(`DB now holds ${check.rows[0][0]} questions, ${check.rows[0][1]} placed across ${check.rows[0][2]} levels.`);
}

async function main() {
  const args = process.argv.slice(2);
  const file = args.find(a => !a.startsWith('--'));
  if (!file || args.includes('--help')) {
    console.log('Usage: node scripts/import-redline.mjs <question-bank.md> [--apply] [--relevel]');
    process.exit(file ? 0 : 1);
  }
  const doApply = args.includes('--apply');
  loadEnv();
  console.log(`\n  Redline importer${doApply ? '' : ' [DRY RUN]'}`);

  let rows, nLevels;
  try {
    ({ rows, nLevels } = buildAll(parseBank(path.resolve(process.cwd(), file))));
  } catch (e) {
    err(`Validation failed: ${e.message}`);
    process.exit(1);
  }
  ok('Bank parsed and validated.');
  printPlan(rows, nLevels);

  if (!doApply) { ok('Dry run complete — nothing written. Re-run with --apply.'); return; }
  try {
    await apply(rows, args.includes('--relevel'));
  } catch (e) {
    err(`DB error: ${e.message}`);
    process.exit(2);
  }
}

main().catch(e => { err(`Unexpected error: ${e.message}`); process.exit(2); });
