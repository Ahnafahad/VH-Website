#!/usr/bin/env node
// scripts/export-theme-catalog.mjs — READ-ONLY. Exports a compact profile of
// every existing vocab_units → vocab_themes → representative-words structure
// to .claude/scratch/vocab-syllabus/theme-catalog.json. This is the reusable
// retrieval context handed to Codex for new-word theme placement — built once
// so we never have to re-send the full 805-word database per batch (manual's
// token-efficiency rule).
//
// Usage:
//   node scripts/export-theme-catalog.mjs
//
// Requires .env.local with TURSO_DATABASE_URL + TURSO_AUTH_TOKEN. Local Node→
// Turso TLS needs NODE_EXTRA_CA_CERTS → repo-root win-roots.pem.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@libsql/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, '.claude', 'scratch', 'vocab-syllabus');
const REP_WORDS_PER_THEME = 6;

const c = { reset: '\x1b[0m', bold: '\x1b[1m', red: '\x1b[31m', green: '\x1b[32m', cyan: '\x1b[36m' };
const ok = (m) => console.log(`${c.green}✓${c.reset} ${m}`);
const err = (m) => console.error(`${c.red}✗${c.reset} ${m}`);
const info = (m) => console.log(`${c.cyan}ℹ${c.reset} ${m}`);
const bold = (m) => `${c.bold}${m}${c.reset}`;

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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

async function main() {
  console.log('');
  console.log(bold('  Theme Catalog Export [READ-ONLY]'));
  console.log('');

  loadEnv();
  const { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN } = process.env;
  if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) {
    err('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in .env.local');
    process.exit(2);
  }

  const client = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN });

  const units = (await client.execute('SELECT id, name, "order" FROM vocab_units ORDER BY "order"')).rows;
  const themes = (await client.execute('SELECT id, unit_id, name, "order" FROM vocab_themes ORDER BY "order"')).rows;
  const words = (await client.execute('SELECT id, theme_id, word, part_of_speech FROM vocab_words')).rows;

  const wordsByTheme = new Map();
  for (const w of words) {
    const themeId = Number(w.theme_id);
    if (!wordsByTheme.has(themeId)) wordsByTheme.set(themeId, []);
    wordsByTheme.get(themeId).push({ word: String(w.word), pos: String(w.part_of_speech) });
  }

  const unitById = new Map(units.map((u) => [Number(u.id), String(u.name)]));

  const catalog = themes.map((t) => {
    const themeId = Number(t.id);
    const allWords = wordsByTheme.get(themeId) ?? [];
    return {
      themeId,
      themeName: String(t.name),
      unitId: Number(t.unit_id),
      unitName: unitById.get(Number(t.unit_id)) ?? null,
      memberCount: allWords.length,
      representativeWords: allWords.slice(0, REP_WORDS_PER_THEME).map((w) => w.word),
    };
  });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, 'theme-catalog.json');
  fs.writeFileSync(outPath, JSON.stringify({
    stats: { unitCount: units.length, themeCount: themes.length, wordCount: words.length },
    units: units.map((u) => ({ unitId: Number(u.id), unitName: String(u.name), order: Number(u.order) })),
    themes: catalog,
  }, null, 2));

  console.log('');
  ok(bold(`Exported ${units.length} units, ${themes.length} themes (${words.length} words total).`));
  info(`Catalog written to ${outPath}`);
  process.exit(0);
}

main().catch((e) => {
  err(`Unexpected error: ${e.message}`);
  process.exit(2);
});
