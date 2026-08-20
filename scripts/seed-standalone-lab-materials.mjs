#!/usr/bin/env node
// scripts/seed-standalone-lab-materials.mjs — Registers the two standalone
// interactive HTML labs (served as-is from public/, not linked in any navbar)
// as 'link' materials in the LMS so students can find them under Materials:
//   - punctuation-mastery-lab.html  (English, Punctuation)
//   - verb-tenses-lab.html          (English, Chapter 5.1 — Verb Tenses)
//
// Idempotent: skips a row if a material with the same blobUrl already exists.
//
// Usage:
//   node scripts/seed-standalone-lab-materials.mjs             # dry-run (default)
//   node scripts/seed-standalone-lab-materials.mjs --apply     # write to Turso
//
// Requires .env.local with TURSO_DATABASE_URL + TURSO_AUTH_TOKEN. Local Node→
// Turso TLS needs NODE_EXTRA_CA_CERTS → repo-root win-roots.pem.
// Exit codes: 0 ok, 1 usage/lookup failure, 2 db failure.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import { materials, users } from '../src/lib/db/schema.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', red: '\x1b[31m',
  green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m',
};
const ok   = (m) => console.log(`${c.green}✓${c.reset} ${m}`);
const warn = (m) => console.log(`${c.yellow}⚠${c.reset}  ${m}`);
const err  = (m) => console.error(`${c.red}✗${c.reset} ${m}`);
const info = (m) => console.log(`${c.cyan}ℹ${c.reset} ${m}`);
const bold = (m) => `${c.bold}${m}${c.reset}`;

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

const UPLOADER_EMAIL = 'ahnaf816@gmail.com';
const SITE = 'https://www.vh-beyondthehorizons.org';

const ROWS = [
  {
    title: 'Punctuation Mastery Lab',
    blobUrl: `${SITE}/punctuation-mastery-lab.html`,
    subject: 'english',
    product: 'iba',
    batch: null,
    docType: 'practice',
    number: null,
    topic: 'Punctuation',
  },
  {
    title: 'Verb Tenses Interactive Lab (5.1)',
    blobUrl: `${SITE}/verb-tenses-lab.html`,
    subject: 'english',
    product: 'iba',
    batch: null,
    docType: 'practice',
    number: '5.1',
    topic: 'Verb Tenses',
  },
];

async function main() {
  const apply = process.argv.includes('--apply');

  console.log('');
  console.log(bold(`  Standalone Lab Materials Seeder${apply ? '' : ' [DRY RUN]'}`));
  console.log('');

  loadEnv();

  const { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN } = process.env;
  if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) {
    err('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in .env.local');
    process.exit(1);
  }

  const client = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN });
  const db = drizzle(client);

  const uploader = await db.select({ id: users.id }).from(users)
    .where(eq(users.email, UPLOADER_EMAIL)).get();
  if (!uploader) {
    err(`No user found with email ${UPLOADER_EMAIL} — cannot set uploadedBy`);
    process.exit(1);
  }
  info(`uploadedBy → user id ${uploader.id} (${UPLOADER_EMAIL})`);

  let inserted = 0;
  for (const row of ROWS) {
    const existing = await db.select({ id: materials.id }).from(materials)
      .where(eq(materials.blobUrl, row.blobUrl)).get();
    if (existing) {
      info(`'${row.title}' already exists (id=${existing.id}, blobUrl=${row.blobUrl}) — skipping`);
      continue;
    }
    if (!apply) {
      ok(`[dry-run] would insert '${row.title}' → ${row.blobUrl}`);
      continue;
    }
    const [created] = await db.insert(materials).values({
      title: row.title,
      type: 'link',
      blobUrl: row.blobUrl,
      fileName: null,
      fileSize: null,
      subject: row.subject,
      product: row.product,
      batch: row.batch,
      docType: row.docType,
      number: row.number,
      topic: row.topic,
      classSessionId: null,
      uploadedBy: uploader.id,
    }).returning();
    ok(`inserted material id=${created.id}: '${row.title}'`);
    inserted++;
  }

  console.log('');
  if (!apply) {
    ok(bold('Dry run complete — no DB writes performed. Re-run with --apply to write.'));
  } else {
    ok(bold(`Seed complete — ${inserted} material row(s) inserted.`));
  }
  process.exit(0);
}

main().catch((e) => {
  err(`Unexpected error: ${e.message}`);
  process.exit(2);
});
