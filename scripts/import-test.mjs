#!/usr/bin/env node
// scripts/import-test.mjs — LaTeX→Test import / seeder
// Usage: node scripts/import-test.mjs <path-to-json> [--dry-run] [--force]
// Exit codes: 0 ok, 1 validation failure, 2 db failure

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@libsql/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ─── ANSI helpers ────────────────────────────────────────────────────────────

const c = {
  reset: '\x1b[0m',
  bold:  '\x1b[1m',
  red:   '\x1b[31m',
  green: '\x1b[32m',
  yellow:'\x1b[33m',
  cyan:  '\x1b[36m',
  gray:  '\x1b[90m',
};

const ok    = (msg) => console.log(`${c.green}✓${c.reset} ${msg}`);
const warn  = (msg) => console.log(`${c.yellow}⚠${c.reset}  ${msg}`);
const err   = (msg) => console.error(`${c.red}✗${c.reset} ${msg}`);
const info  = (msg) => console.log(`${c.cyan}ℹ${c.reset} ${msg}`);
const bold  = (msg) => `${c.bold}${msg}${c.reset}`;
const gray  = (msg) => `${c.gray}${msg}${c.reset}`;

// ─── .env.local parser ───────────────────────────────────────────────────────

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
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

// ─── Validation helpers ──────────────────────────────────────────────────────

const VALID_BUCKETS = new Set(['iba', 'du_fbs']);
const VALID_KINDS   = new Set(['instruction', 'passage', 'scenario', 'shared_options', 'word_bank']);
const KEBAB_RE      = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// LaTeX commands that suggest un-converted content (outside math)
const LATEX_CMD_RE  = /\\(?!frac|sqrt|times|cdots|leq|geq|sum|int|infty|alpha|beta|pm|div|neq|approx|left|right|text|hspace|vspace|begin|end|item)[a-zA-Z]+/;
// Common mojibake patterns from Windows-1252 mis-decoded as Latin-1
const MOJIBAKE_RE   = /[â€™â€œâ€âÂ-]/;

function validateSlug(slug) {
  if (typeof slug !== 'string' || !KEBAB_RE.test(slug))
    throw new Error(`slug "${slug}" is not valid kebab-case (lowercase letters, digits, hyphens only)`);
}

function validateSection(sec, secIdx) {
  const prefix = `Section[${secIdx}] "${sec.title}"`;
  if (typeof sec.order !== 'number') throw new Error(`${prefix}: order must be a number`);
  if (!sec.title) throw new Error(`${prefix}: title is required`);
  if (!Array.isArray(sec.questions) || sec.questions.length === 0)
    throw new Error(`${prefix}: questions array must be non-empty`);
  if (!Array.isArray(sec.groups)) throw new Error(`${prefix}: groups must be an array`);
  if (typeof sec.marksPerCorrect !== 'number') throw new Error(`${prefix}: marksPerCorrect must be a number`);
  if (typeof sec.penaltyPerWrong !== 'number') throw new Error(`${prefix}: penaltyPerWrong must be a number`);
  // thresholdPercent: null or number
  if (sec.thresholdPercent !== null && typeof sec.thresholdPercent !== 'number')
    throw new Error(`${prefix}: thresholdPercent must be null or a number`);
}

function validateGroups(groups, secTitle) {
  const prefix = `Section "${secTitle}"`;
  const refs = new Set();
  for (const g of groups) {
    if (!g.ref) throw new Error(`${prefix}: group missing ref`);
    if (refs.has(g.ref)) throw new Error(`${prefix}: duplicate group ref "${g.ref}"`);
    refs.add(g.ref);
    if (!VALID_KINDS.has(g.kind))
      throw new Error(`${prefix}: group "${g.ref}" has invalid kind "${g.kind}" (allowed: ${[...VALID_KINDS].join(', ')})`);
    if (!g.content) throw new Error(`${prefix}: group "${g.ref}" has empty content`);
    if (g.kind === 'shared_options' || g.kind === 'word_bank') {
      if (!Array.isArray(g.sharedOptions) || g.sharedOptions.length < 2)
        throw new Error(`${prefix}: ${g.kind} group "${g.ref}" must have sharedOptions array with ≥2 items`);
      const soKeys = new Set();
      for (const so of g.sharedOptions) {
        if (!so.key || !so.text) throw new Error(`${prefix}: sharedOption missing key or text in "${g.ref}"`);
        if (soKeys.has(so.key)) throw new Error(`${prefix}: duplicate sharedOption key "${so.key}" in "${g.ref}"`);
        soKeys.add(so.key);
      }
    }
  }
  return refs;
}

function validateQuestions(questions, groupRefs, sharedOptionsByGroupRef, secTitle) {
  const prefix = `Section "${secTitle}"`;
  const numbers = new Set();
  let unkeyed = 0;

  for (const q of questions) {
    if (typeof q.number !== 'number') throw new Error(`${prefix}: question missing numeric "number"`);
    if (numbers.has(q.number)) throw new Error(`${prefix}: duplicate question number ${q.number}`);
    numbers.add(q.number);

    if (!q.stem || !q.stem.trim()) throw new Error(`${prefix} Q${q.number}: stem is empty`);

    if (q.group !== null && q.group !== undefined) {
      if (!groupRefs.has(q.group))
        throw new Error(`${prefix} Q${q.number}: group ref "${q.group}" does not exist in this section's groups`);
    }

    if (!Array.isArray(q.options) || q.options.length < 2)
      throw new Error(`${prefix} Q${q.number}: must have ≥2 options`);

    const optKeys = new Set();
    for (const opt of q.options) {
      if (!opt.key || typeof opt.key !== 'string' || opt.key.length !== 1)
        throw new Error(`${prefix} Q${q.number}: option key must be a single letter, got "${opt.key}"`);
      if (optKeys.has(opt.key)) throw new Error(`${prefix} Q${q.number}: duplicate option key "${opt.key}"`);
      optKeys.add(opt.key);
      if (!opt.text) throw new Error(`${prefix} Q${q.number}: option "${opt.key}" has empty text`);
    }

    if (q.correctKey !== null && q.correctKey !== undefined) {
      // correctKey must be in the question's own options OR in the sharedOptions of its group
      const validKeys = new Set([...optKeys]);
      if (q.group && sharedOptionsByGroupRef[q.group]) {
        for (const so of sharedOptionsByGroupRef[q.group]) validKeys.add(so.key);
      }
      if (!validKeys.has(q.correctKey))
        throw new Error(`${prefix} Q${q.number}: correctKey "${q.correctKey}" is not a valid option key`);
    } else {
      unkeyed++;
    }
  }

  return unkeyed;
}

// ─── Warnings (non-fatal) ────────────────────────────────────────────────────

function auditWarnings(data) {
  const warnings = [];

  // Check imageUrls
  for (const sec of data.sections) {
    for (const q of sec.questions) {
      if (q.imageUrl) {
        const imgPath = path.join(ROOT, 'public', q.imageUrl);
        if (!fs.existsSync(imgPath)) {
          warnings.push(`imageUrl "${q.imageUrl}" (Q${q.number} in "${sec.title}") does not exist under public/`);
        }
      }
    }
  }

  // Check for suspicious LaTeX in text fields (outside math delimiters)
  function stripMath(str) {
    // Remove $...$ and $$...$$ regions so we don't flag LaTeX inside math
    return str.replace(/\$\$[\s\S]*?\$\$/g, '').replace(/\$[^$]*?\$/g, '');
  }

  function checkField(text, label) {
    if (!text) return;
    const stripped = stripMath(text);
    const match = stripped.match(LATEX_CMD_RE);
    if (match) warnings.push(`Possible leftover LaTeX "${match[0]}" in ${label}`);
    const moji = stripped.match(MOJIBAKE_RE);
    if (moji) warnings.push(`Possible mojibake character "${moji[0]}" in ${label}`);
  }

  for (const sec of data.sections) {
    for (const g of sec.groups) {
      checkField(g.content, `group "${g.ref}" content`);
      if (g.title) checkField(g.title, `group "${g.ref}" title`);
    }
    for (const q of sec.questions) {
      checkField(q.stem, `${sec.title} Q${q.number} stem`);
      for (const opt of q.options) checkField(opt.text, `${sec.title} Q${q.number} option ${opt.key}`);
    }
  }

  return warnings;
}

// ─── Print section summary table ─────────────────────────────────────────────

function printSummary(data, sectionStats) {
  console.log('');
  console.log(bold('  Section Summary'));
  console.log(gray('  ─'.repeat(60)));
  const h = `  ${'Section'.padEnd(30)} ${'Groups'.padStart(6)} ${'Q'.padStart(5)} ${'Keyed'.padStart(6)} ${'Unkeyed'.padStart(8)}`;
  console.log(gray(h));
  console.log(gray('  ' + '─'.repeat(58)));
  for (const s of sectionStats) {
    const row = `  ${s.title.padEnd(30)} ${String(s.groups).padStart(6)} ${String(s.questions).padStart(5)} ${String(s.keyed).padStart(6)} ${String(s.unkeyed).padStart(8)}`;
    console.log(row);
  }
  console.log(gray('  ' + '─'.repeat(58)));
  const totQ = sectionStats.reduce((a, s) => a + s.questions, 0);
  const totK = sectionStats.reduce((a, s) => a + s.keyed, 0);
  const totU = sectionStats.reduce((a, s) => a + s.unkeyed, 0);
  console.log(`  ${'TOTAL'.padEnd(30)} ${String(sectionStats.reduce((a,s)=>a+s.groups,0)).padStart(6)} ${String(totQ).padStart(5)} ${String(totK).padStart(6)} ${String(totU).padStart(8)}`);
  console.log('');
}

// ─── Validate ────────────────────────────────────────────────────────────────

function validate(data) {
  // Top-level fields
  validateSlug(data.slug);
  if (!data.title) throw new Error('title is required');
  if (!VALID_BUCKETS.has(data.bucket))
    throw new Error(`bucket "${data.bucket}" must be one of: ${[...VALID_BUCKETS].join(', ')}`);
  if (!Array.isArray(data.sections) || data.sections.length === 0)
    throw new Error('sections must be a non-empty array');

  // Section orders must be unique
  const sectionOrders = new Set();
  for (const sec of data.sections) {
    if (sectionOrders.has(sec.order)) throw new Error(`Duplicate section order ${sec.order}`);
    sectionOrders.add(sec.order);
  }

  const sectionStats = [];
  let totalUnkeyed = 0;

  for (let si = 0; si < data.sections.length; si++) {
    const sec = data.sections[si];
    validateSection(sec, si + 1);
    const groupRefs = validateGroups(sec.groups, sec.title);

    // Build sharedOptions map for correctKey validation
    const sharedOptionsByGroupRef = {};
    for (const g of sec.groups) {
      if ((g.kind === 'shared_options' || g.kind === 'word_bank') && g.sharedOptions) {
        sharedOptionsByGroupRef[g.ref] = g.sharedOptions;
      }
    }

    const unkeyed = validateQuestions(sec.questions, groupRefs, sharedOptionsByGroupRef, sec.title);
    totalUnkeyed += unkeyed;

    // Verify every group is referenced by ≥1 question
    for (const g of sec.groups) {
      const used = sec.questions.some(q => q.group === g.ref);
      if (!used) warn(`Group "${g.ref}" in section "${sec.title}" is not referenced by any question`);
    }

    sectionStats.push({
      title:     sec.title,
      groups:    sec.groups.length,
      questions: sec.questions.length,
      keyed:     sec.questions.length - unkeyed,
      unkeyed,
    });
  }

  return { sectionStats, totalUnkeyed };
}

// ─── DB Seed ─────────────────────────────────────────────────────────────────

async function seed(data, force) {
  const { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN } = process.env;
  if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN)
    throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in .env.local');

  const db = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN });

  // Check if slug exists
  const existing = await db.execute({
    sql: 'SELECT id FROM tests WHERE slug = ?',
    args: [data.slug],
  });

  if (existing.rows.length > 0) {
    const testId = Number(existing.rows[0][0]);
    // Check for attempts
    const attempts = await db.execute({
      sql: 'SELECT COUNT(*) as cnt FROM test_attempts WHERE test_id = ?',
      args: [testId],
    });
    const attemptCount = Number(attempts.rows[0][0]);
    if (attemptCount > 0 && !force) {
      throw new Error(
        `Test "${data.slug}" has ${attemptCount} attempt(s). ` +
        'Pass --force to overwrite (this deletes sections/questions but NOT the attempts row).'
      );
    }

    info(`Deleting existing sections for "${data.slug}" (id=${testId})…`);
    await db.execute({ sql: 'DELETE FROM test_sections WHERE test_id = ?', args: [testId] });
    // Update tests row
    await db.execute({
      sql: `UPDATE tests SET title=?, bucket=?, description=?, status='draft', updated_at=unixepoch()
            WHERE id=?`,
      args: [data.title, data.bucket, data.description ?? null, testId],
    });
    info('Updated tests row.');
    await seedSections(db, testId, data);
    // Update totals
    await updateTotals(db, testId, data);
    ok(`Re-seeded test "${data.slug}" (id=${testId}).`);
    return;
  }

  // Insert new test
  const testRes = await db.execute({
    sql: `INSERT INTO tests (slug, title, bucket, description, status, total_questions, total_marks)
          VALUES (?, ?, ?, ?, 'draft', 0, 0)`,
    args: [data.slug, data.title, data.bucket, data.description ?? null],
  });
  const testId = Number(testRes.lastInsertRowid);
  info(`Inserted tests row id=${testId}.`);

  await seedSections(db, testId, data);
  await updateTotals(db, testId, data);
  ok(`Seeded new test "${data.slug}" (id=${testId}).`);
}

async function seedSections(db, testId, data) {
  for (const sec of data.sections) {
    const secRes = await db.execute({
      sql: `INSERT INTO test_sections
              (test_id, "order", title, total_questions, total_marks,
               marks_per_correct, penalty_per_wrong, threshold_percent)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        testId, sec.order, sec.title,
        sec.questions.length,
        sec.questions.length * sec.marksPerCorrect,
        sec.marksPerCorrect, sec.penaltyPerWrong,
        sec.thresholdPercent ?? null,
      ],
    });
    const sectionId = Number(secRes.lastInsertRowid);

    // Insert groups
    const groupIdByRef = {};
    for (let gi = 0; gi < sec.groups.length; gi++) {
      const g = sec.groups[gi];
      const gRes = await db.execute({
        sql: `INSERT INTO test_question_groups
                (section_id, "order", kind, title, content, shared_options)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [
          sectionId, gi + 1, g.kind, g.title ?? null, g.content,
          g.sharedOptions ? JSON.stringify(g.sharedOptions) : null,
        ],
      });
      groupIdByRef[g.ref] = Number(gRes.lastInsertRowid);
    }

    // Insert questions
    for (let qi = 0; qi < sec.questions.length; qi++) {
      const q = sec.questions[qi];
      const groupId = (q.group && groupIdByRef[q.group]) ? groupIdByRef[q.group] : null;
      await db.execute({
        sql: `INSERT INTO test_questions
                (section_id, group_id, "order", number, type, stem, options,
                 correct_key, image_url, explanation)
              VALUES (?, ?, ?, ?, 'mcq', ?, ?, ?, ?, ?)`,
        args: [
          sectionId, groupId, qi + 1, q.number,
          q.stem, JSON.stringify(q.options),
          q.correctKey ?? null, q.imageUrl ?? null, q.explanation ?? null,
        ],
      });
    }
    ok(`  Section "${sec.title}": ${sec.groups.length} groups, ${sec.questions.length} questions inserted.`);
  }
}

async function updateTotals(db, testId, data) {
  let totalQuestions = 0;
  let totalMarks = 0;
  for (const sec of data.sections) {
    totalQuestions += sec.questions.length;
    totalMarks += sec.questions.length * sec.marksPerCorrect;
  }
  await db.execute({
    sql: 'UPDATE tests SET total_questions=?, total_marks=?, updated_at=unixepoch() WHERE id=?',
    args: [totalQuestions, totalMarks, testId],
  });
  info(`totals: ${totalQuestions} questions, ${totalMarks} marks`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help')) {
    console.log('Usage: node scripts/import-test.mjs <path-to-json> [--dry-run] [--force]');
    process.exit(0);
  }

  const jsonArg  = args.find(a => !a.startsWith('--'));
  const dryRun   = args.includes('--dry-run');
  const force    = args.includes('--force');

  if (!jsonArg) { err('No JSON file path provided.'); process.exit(1); }

  const jsonPath = path.resolve(process.cwd(), jsonArg);
  if (!fs.existsSync(jsonPath)) { err(`File not found: ${jsonPath}`); process.exit(1); }

  loadEnv();

  console.log('');
  console.log(bold(`  VH Test Importer${dryRun ? ' [DRY RUN]' : ''}`));
  console.log(gray(`  File: ${jsonPath}`));
  console.log('');

  // ── Parse ──
  let data;
  try {
    data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch (e) {
    err(`JSON parse error: ${e.message}`);
    process.exit(1);
  }
  ok('JSON parsed.');

  // ── Validate ──
  info('Validating…');
  let sectionStats, totalUnkeyed;
  try {
    ({ sectionStats, totalUnkeyed } = validate(data));
  } catch (e) {
    err(`Validation failed: ${e.message}`);
    process.exit(1);
  }
  ok('Structure valid.');

  // ── Warnings ──
  const warnings = auditWarnings(data);
  for (const w of warnings) warn(w);
  if (totalUnkeyed > 0) warn(`${totalUnkeyed} question(s) have correctKey: null (answer key not yet loaded)`);

  // ── Summary table ──
  printSummary(data, sectionStats);

  if (dryRun) {
    ok(bold('Dry run complete — no DB writes performed.'));
    console.log('');
    process.exit(0);
  }

  // ── Seed ──
  info('Connecting to Turso…');
  try {
    await seed(data, force);
  } catch (e) {
    if (e.message.includes('attempt')) {
      err(e.message);
    } else {
      err(`DB error: ${e.message}`);
    }
    process.exit(2);
  }

  ok(bold('Import complete. Test status = draft. Publish via admin UI when ready.'));
  if (data.sections.some(s => s.questions.some(q => q.imageUrl))) {
    warn(`Remember to upload image files to public/tests/${data.slug}/ before publishing.`);
  }
  console.log('');
}

main().catch(e => {
  err(`Unexpected error: ${e.message}`);
  process.exit(2);
});
