#!/usr/bin/env node
// scripts/seed-fbs-diagnostic.mjs — Seeds the 3 FBS public diagnostic tests.
// Reads src/data/fbs-diagnostic/assessment-{1,2,3}.json, IDEMPOTENTLY upserts
// each by slug (delete-then-insert; FK cascade removes sections/questions/
// windows/attempts), and creates one permanently-open online window per test.
//
// Usage:
//   node scripts/seed-fbs-diagnostic.mjs --dry-run   # plan only, no DB writes
//   node scripts/seed-fbs-diagnostic.mjs             # write to Turso
//
// Requires .env.local with TURSO_DATABASE_URL + TURSO_AUTH_TOKEN. Local Node→
// Turso TLS needs NODE_EXTRA_CA_CERTS → repo-root win-roots.pem.
// Exit codes: 0 ok, 1 usage/parse, 2 db failure.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import {
  tests, testSections, testQuestions, testWindows,
} from '../src/lib/db/schema.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ─── ANSI helpers ────────────────────────────────────────────────────────────

const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', red: '\x1b[31m',
  green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', gray: '\x1b[90m',
};
const ok   = (m) => console.log(`${c.green}✓${c.reset} ${m}`);
const warn = (m) => console.log(`${c.yellow}⚠${c.reset}  ${m}`);
const err  = (m) => console.error(`${c.red}✗${c.reset} ${m}`);
const info = (m) => console.log(`${c.cyan}ℹ${c.reset} ${m}`);
const bold = (m) => `${c.bold}${m}${c.reset}`;
const gray = (m) => `${c.gray}${m}${c.reset}`;

// ─── .env.local parser (matches import-test.mjs) ─────────────────────────────

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

// ─── Config ──────────────────────────────────────────────────────────────────

const ASSESSMENT_FILES = [
  'src/data/fbs-diagnostic/assessment-1.json',
  'src/data/fbs-diagnostic/assessment-2.json',
  'src/data/fbs-diagnostic/assessment-3.json',
];

const DESCRIPTION =
  'Free 30-minute FBS (DU C-Unit) diagnostic — English, Advanced English, ' +
  'Business, Economics, Accounting.';

// ─── Seed one assessment (delete-then-insert, idempotent by slug) ────────────

async function seedAssessment(db, data, dryRun) {
  const sectionCount = data.sections.length;
  const questionCount = data.sections.reduce((s, sec) => s + sec.questions.length, 0);

  info(`Assessment ${bold(data.slug)} — "${data.title}"`);
  console.log(gray(`    sections: ${sectionCount}, questions: ${questionCount}, ` +
    `duration: ${data.durationMinutes}min, marks: ${data.totalMarks}`));

  if (dryRun) {
    const existing = await db.select({ id: tests.id }).from(tests)
      .where(eq(tests.slug, data.slug)).get();
    if (existing) warn(`    [dry-run] would DELETE existing test id=${existing.id} then re-insert`);
    ok(`    [dry-run] would insert 1 test, ${sectionCount} sections, ` +
       `${questionCount} questions, 1 window`);
    return;
  }

  // Idempotent upsert: delete existing test by slug (FK cascade removes
  // sections/questions/windows/attempts), then insert fresh.
  const existing = await db.select({ id: tests.id }).from(tests)
    .where(eq(tests.slug, data.slug)).get();
  if (existing) {
    await db.delete(tests).where(eq(tests.id, existing.id));
    info(`    deleted existing test id=${existing.id} (cascade)`);
  }

  const now = new Date();
  const [insertedTest] = await db.insert(tests).values({
    slug:               data.slug,
    title:              data.title,
    bucket:             'du_fbs',
    status:             'published',
    allowedProducts:    null,
    isDiagnostic:       true,
    totalQuestions:     questionCount,
    totalMarks:         questionCount,
    resultsPublishedAt: now,
    syllabus:           null,
    description:        DESCRIPTION,
  }).returning({ id: tests.id });
  const testId = insertedTest.id;

  for (const sec of data.sections) {
    const [insertedSection] = await db.insert(testSections).values({
      testId,
      order:            sec.order,
      title:            sec.title,
      totalQuestions:   sec.questions.length,
      totalMarks:       sec.questions.length,
      marksPerCorrect:  1,
      penaltyPerWrong:  0,
      thresholdPercent: null,
    }).returning({ id: testSections.id });
    const sectionId = insertedSection.id;

    for (const q of sec.questions) {
      await db.insert(testQuestions).values({
        sectionId,
        groupId:     null,
        order:       q.order,
        number:      q.number,
        type:        'mcq',
        stem:        q.stem,
        options:     JSON.stringify(q.options),
        correctKey:  q.correctKey,
        imageUrl:    null,
        explanation: q.explanation ?? null,
      });
    }
  }

  await db.insert(testWindows).values({
    testId,
    mode:            'online',
    opensAt:         new Date('2020-01-01'),
    closesAt:        new Date('2035-01-01'),
    durationMinutes: 30,
    status:          'open',
  });

  ok(`    seeded test id=${testId}: ${sectionCount} sections, ` +
     `${questionCount} questions, 1 permanently-open window`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('');
  console.log(bold(`  VH FBS Diagnostic Seeder${dryRun ? ' [DRY RUN]' : ''}`));
  console.log('');

  loadEnv();

  let db = null;
  if (!dryRun) {
    const { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN } = process.env;
    if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) {
      err('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in .env.local');
      process.exit(2);
    }
    const client = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN });
    db = drizzle(client);
    // Self-migrate the single new column (avoids a blanket drizzle-kit push that
    // would also deploy unrelated in-flight schema). Idempotent.
    try {
      await client.execute('ALTER TABLE tests ADD COLUMN is_diagnostic integer NOT NULL DEFAULT 0');
      ok('added column tests.is_diagnostic');
    } catch (e) {
      if (/duplicate column|already exists/i.test(e.message)) info('column tests.is_diagnostic already present');
      else throw e;
    }
    // Elective mechanic: per-attempt JSON of the 4 chosen section ids. Idempotent.
    try {
      await client.execute('ALTER TABLE test_attempts ADD COLUMN chosen_sections text');
      ok('added column test_attempts.chosen_sections');
    } catch (e) {
      if (/duplicate column|already exists/i.test(e.message)) info('column test_attempts.chosen_sections already present');
      else throw e;
    }
  } else {
    // Dry-run still reads existing rows to report planned deletes, if creds present.
    const { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN } = process.env;
    if (TURSO_DATABASE_URL && TURSO_AUTH_TOKEN) {
      const client = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN });
      db = drizzle(client);
    } else {
      warn('No Turso creds — dry-run will report planned inserts only (no existing-row lookup).');
    }
  }

  let seeded = 0;
  for (const rel of ASSESSMENT_FILES) {
    const jsonPath = path.join(ROOT, rel);
    if (!fs.existsSync(jsonPath)) {
      warn(`Skipping ${rel} — file not found.`);
      continue;
    }

    let data;
    try {
      data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    } catch (e) {
      err(`Skipping ${rel} — JSON parse error: ${e.message}`);
      continue;
    }

    if (!data.slug || !Array.isArray(data.sections)) {
      err(`Skipping ${rel} — missing slug or sections[].`);
      continue;
    }

    if (dryRun && !db) {
      // No DB available: report planned inserts without existing-row lookup.
      const sectionCount = data.sections.length;
      const questionCount = data.sections.reduce((s, sec) => s + sec.questions.length, 0);
      info(`Assessment ${bold(data.slug)} — "${data.title}"`);
      ok(`    [dry-run] would insert 1 test, ${sectionCount} sections, ` +
         `${questionCount} questions, 1 window`);
      seeded++;
      continue;
    }

    try {
      await seedAssessment(db, data, dryRun);
      seeded++;
    } catch (e) {
      err(`Failed to seed ${rel}: ${e.message}`);
      process.exit(2);
    }
    console.log('');
  }

  if (seeded === 0) {
    warn('No assessment files found — nothing seeded.');
    process.exit(0);
  }

  ok(bold(dryRun
    ? `Dry run complete — ${seeded} assessment(s) planned, no DB writes performed.`
    : `Seed complete — ${seeded} diagnostic assessment(s) upserted.`));
  console.log('');
  process.exit(0);
}

main().catch((e) => {
  err(`Unexpected error: ${e.message}`);
  process.exit(2);
});
