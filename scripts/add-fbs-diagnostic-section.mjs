#!/usr/bin/env node
// scripts/add-fbs-diagnostic-section.mjs — Adds ONE new elective section (with
// its questions) to an EXISTING, already-live FBS diagnostic test, without
// touching anything else. Unlike seed-fbs-diagnostic.mjs (which deletes and
// re-inserts the whole test, wiping attempts/leaderboard data), this only
// INSERTs — safe to run against a diagnostic that already has real attempts.
//
// Idempotent by section title: if a section with the same title already
// exists on the target test, it exits without making changes.
//
// Usage:
//   node scripts/add-fbs-diagnostic-section.mjs --slug=fbs-diagnostic-1 --section=Mathematics --dry-run
//   node scripts/add-fbs-diagnostic-section.mjs --slug=fbs-diagnostic-1 --section=Mathematics
//
// Reads the section's questions straight out of the matching entry in
// src/data/fbs-diagnostic/assessment-{N}.json (matched by slug), so the JSON
// file stays the single source of truth.
//
// Requires .env.local with TURSO_DATABASE_URL + TURSO_AUTH_TOKEN. Local Node→
// Turso TLS needs NODE_EXTRA_CA_CERTS → repo-root win-roots.pem.
// Exit codes: 0 ok, 1 usage/parse, 2 db failure.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq, and, sql } from 'drizzle-orm';
import { tests, testSections, testQuestions } from '../src/lib/db/schema.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

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

function loadEnv() {
  const envPath = path.join(ROOT, '.env.local');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function parseArgs() {
  const args = { slug: null, section: null, dryRun: false };
  for (const arg of process.argv.slice(2)) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg.startsWith('--slug=')) args.slug = arg.slice('--slug='.length);
    else if (arg.startsWith('--section=')) args.section = arg.slice('--section='.length);
  }
  return args;
}

async function main() {
  const { slug, section: sectionTitle, dryRun } = parseArgs();

  console.log('');
  console.log(bold(`  VH FBS Diagnostic — Add Section${dryRun ? ' [DRY RUN]' : ''}`));
  console.log('');

  if (!slug || !sectionTitle) {
    err('Usage: node scripts/add-fbs-diagnostic-section.mjs --slug=<test-slug> --section=<section-title> [--dry-run]');
    process.exit(1);
  }

  // Find the assessment JSON file whose slug matches, then pull the section.
  const dataDir = path.join(ROOT, 'src/data/fbs-diagnostic');
  const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
  let data = null;
  for (const f of files) {
    const parsed = JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8'));
    if (parsed.slug === slug) { data = parsed; break; }
  }
  if (!data) {
    err(`No assessment JSON found with slug "${slug}" under src/data/fbs-diagnostic/.`);
    process.exit(1);
  }
  const section = data.sections.find(s => s.title === sectionTitle);
  if (!section) {
    err(`Section "${sectionTitle}" not found in ${slug}'s JSON sections.`);
    process.exit(1);
  }

  info(`Test: ${bold(slug)}  Section: ${bold(sectionTitle)}  Questions: ${section.questions.length}`);

  loadEnv();
  const { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN } = process.env;
  if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) {
    err('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in .env.local');
    process.exit(2);
  }
  const client = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN });
  const db = drizzle(client);

  const test = await db.select().from(tests).where(eq(tests.slug, slug)).get();
  if (!test) {
    err(`No test row found in DB with slug "${slug}". Run seed-fbs-diagnostic.mjs first.`);
    process.exit(2);
  }

  const existingSection = await db.select().from(testSections)
    .where(and(eq(testSections.testId, test.id), eq(testSections.title, sectionTitle)))
    .get();
  if (existingSection) {
    warn(`Section "${sectionTitle}" already exists on test id=${test.id} (section id=${existingSection.id}) — nothing to do.`);
    process.exit(0);
  }

  const [{ maxOrder }] = await db.select({ maxOrder: sql`coalesce(max(${testSections.order}), 0)` })
    .from(testSections).where(eq(testSections.testId, test.id));
  const [{ maxNumber }] = await db.select({ maxNumber: sql`coalesce(max(${testQuestions.number}), 0)` })
    .from(testQuestions)
    .innerJoin(testSections, eq(testQuestions.sectionId, testSections.id))
    .where(eq(testSections.testId, test.id));

  const newOrder = Number(maxOrder) + 1;
  const startingNumber = Number(maxNumber);

  if (dryRun) {
    ok(`[dry-run] would insert section "${sectionTitle}" (order=${newOrder}) with ` +
       `${section.questions.length} questions numbered ${startingNumber + 1}-${startingNumber + section.questions.length}`);
    ok(`[dry-run] would bump tests.totalQuestions/totalMarks from ${test.totalQuestions}/${test.totalMarks} ` +
       `to ${test.totalQuestions + section.questions.length}/${test.totalMarks + section.questions.length}`);
    ok(bold('Dry run complete — no DB writes performed.'));
    process.exit(0);
  }

  const [insertedSection] = await db.insert(testSections).values({
    testId:           test.id,
    order:            newOrder,
    title:            section.title,
    totalQuestions:   section.questions.length,
    totalMarks:       section.questions.length,
    marksPerCorrect:  section.marksPerCorrect ?? 1,
    penaltyPerWrong:  section.penaltyPerWrong ?? 0,
    thresholdPercent: section.thresholdPercent ?? null,
  }).returning({ id: testSections.id });

  for (let i = 0; i < section.questions.length; i++) {
    const q = section.questions[i];
    await db.insert(testQuestions).values({
      sectionId:   insertedSection.id,
      groupId:     null,
      order:       q.order,
      number:      startingNumber + i + 1,
      type:        'mcq',
      stem:        q.stem,
      options:     JSON.stringify(q.options),
      correctKey:  q.correctKey,
      imageUrl:    null,
      explanation: q.explanation ?? null,
    });
  }

  await db.update(tests).set({
    totalQuestions: test.totalQuestions + section.questions.length,
    totalMarks:     test.totalMarks + section.questions.length,
  }).where(eq(tests.id, test.id));

  ok(bold(`Added section "${sectionTitle}" (id=${insertedSection.id}, order=${newOrder}) ` +
     `with ${section.questions.length} questions to test id=${test.id}.`));
  console.log('');
  process.exit(0);
}

main().catch((e) => {
  err(`Unexpected error: ${e.message}`);
  process.exit(2);
});
