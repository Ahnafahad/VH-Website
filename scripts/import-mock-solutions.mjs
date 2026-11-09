/**
 * Load a mock's student solution sheet into mock_solutions (DB only: the repo is public, never commit the JSON).
 *   node scripts/import-mock-solutions.mjs <test-slug> <merged.json | data.js> [--dry-run] [--force]
 * Input: {mock, sections, stimuli, library, questions} (a prototype data.js is accepted; student/cohort are dropped).
 * If a tests row with that slug exists, every question's correctKey is checked against the DB key: section
 * L/M/A = test_sections.order 1/2/3, question N = the Nth question (test_questions.order) of that section.
 * Mismatches abort the write unless --force.
 */
import { createClient } from '@libsql/client';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const envPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', '.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim();
    const i = t.indexOf('=');
    if (t && !t.startsWith('#') && i > 0) process.env[t.slice(0, i).trim()] ??= t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
}
const [slug, file] = process.argv.slice(2).filter(a => !a.startsWith('--'));
const dry = process.argv.includes('--dry-run');
const force = process.argv.includes('--force');
if (!slug || !file) { console.error('usage: import-mock-solutions.mjs <test-slug> <file> [--dry-run] [--force]'); process.exit(1); }

const raw = readFileSync(file, 'utf-8').trim();
const d = JSON.parse(raw.replace(/^window\.SOLN_DATA\s*=\s*/, '').replace(/;\s*$/, ''));
const { mock, sections, stimuli, library, questions } = d;

const SECTION_COUNTS = { L: 30, M: 25, A: 15 };
const errors = [];
if (!mock || !sections || !stimuli || !library || !Array.isArray(questions)) errors.push('missing mock/sections/stimuli/library/questions');
for (const [sid, n] of Object.entries(SECTION_COUNTS)) {
  for (let i = 1; i <= n; i++) {
    const q = (questions ?? []).find(x => x.id === `${sid}${i}`);
    if (!q) { errors.push(`missing question ${sid}${i}`); continue; }
    if (!Array.isArray(q.options) || q.options.length < 2) errors.push(`${q.id}: no options`);
    else if (!q.options.some(o => o.key === q.correctKey)) errors.push(`${q.id}: correctKey ${q.correctKey} not among options`);
  }
}
if ((questions ?? []).length !== 70) errors.push(`expected 70 questions, got ${questions?.length}`);
if (errors.length) { console.error('Invalid input:\n  ' + errors.join('\n  ')); process.exit(1); }

const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
const test = (await db.execute({ sql: 'SELECT id FROM tests WHERE slug = ?', args: [slug] })).rows[0];
if (!test) console.log(`No tests row for "${slug}" yet: skipping the answer-key check.`);
else {
  const rows = (await db.execute({
    sql: `SELECT s."order" AS so, q."order" AS qo, q.correct_key AS k FROM test_questions q
          JOIN test_sections s ON s.id = q.section_id WHERE s.test_id = ?`, args: [test.id],
  })).rows;
  const key = new Map(rows.map(r => [`${'LMA'[r.so - 1]}${r.qo}`, r.k]));
  const bad = questions.filter(q => key.get(q.id) !== q.correctKey);
  console.log(`Key check against test ${test.id}: ${questions.length - bad.length}/${questions.length} match`);
  for (const q of bad) console.log(`  MISMATCH ${q.id}: sheet ${q.correctKey}, DB ${key.get(q.id) ?? '(none)'}`);
  if (bad.length && !force) { console.error('Refusing to write (use --force to override).'); process.exit(2); }
}

if (dry) { console.log('(dry-run) not written'); process.exit(0); }
await db.execute({
  sql: `INSERT INTO mock_solutions (test_slug, data, updated_at) VALUES (?, ?, unixepoch())
        ON CONFLICT(test_slug) DO UPDATE SET data = excluded.data, updated_at = unixepoch()`,
  args: [slug, JSON.stringify({ mock, sections, stimuli, library, questions })],
});
console.log(`Imported ${questions.length} questions for "${slug}".`);
