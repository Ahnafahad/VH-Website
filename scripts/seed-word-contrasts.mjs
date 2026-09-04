/**
 * seed-word-contrasts.mjs
 * Loads scripts/data/word-contrasts.json into vocab_word_contrasts as `draft`,
 * and renames vocab_syllabuses.trial_theme_count -> trial_word_count (the trial
 * allowance is a word budget, not a theme count — SAT/GRE words are sprinkled
 * across ~70 WordSmart themes, so 3 themes unlocked only 4-5 of them).
 *
 * Idempotent: safe to re-run. Dry-run by default; pass --apply to write.
 *
 * Run (Windows PowerShell, from vh-website/):
 *   $env:NODE_EXTRA_CA_CERTS='D:\VH Website\win-roots.pem'
 *   node scripts/seed-word-contrasts.mjs --apply
 */

import { createClient } from '@libsql/client';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');

// Load .env.local
const envPath = resolve(__dirname, '..', '.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      process.env[trimmed.slice(0, eqIdx).trim()] =
        trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    }
  }
}

const { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN } = process.env;
if (!TURSO_DATABASE_URL) { console.error('TURSO_DATABASE_URL not set'); process.exit(1); }

const client = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN });

const TRIAL_WORD_BUDGET = 40;

async function columns(table) {
  const r = await client.execute(`SELECT name FROM pragma_table_info('${table}')`);
  return r.rows.map(x => x.name);
}

async function run() {
  // ── 1. trial allowance column ───────────────────────────────────────────
  const sylCols = await columns('vocab_syllabuses');
  if (sylCols.includes('trial_theme_count') && !sylCols.includes('trial_word_count')) {
    console.log(`rename trial_theme_count -> trial_word_count, set all to ${TRIAL_WORD_BUDGET}`);
    if (APPLY) {
      await client.execute('ALTER TABLE vocab_syllabuses RENAME COLUMN trial_theme_count TO trial_word_count');
      await client.execute({
        sql: 'UPDATE vocab_syllabuses SET trial_word_count = ?',
        args: [TRIAL_WORD_BUDGET],
      });
    }
  } else {
    console.log('trial_word_count already in place — skipping rename');
  }

  // ── 2. contrasts ────────────────────────────────────────────────────────
  const rows = JSON.parse(readFileSync(resolve(__dirname, 'data', 'word-contrasts.json'), 'utf-8'));

  const existing = new Set(
    (await client.execute('SELECT word_id FROM vocab_word_contrasts')).rows.map(r => Number(r.word_id)),
  );
  const validIds = new Set(
    (await client.execute('SELECT id FROM vocab_words')).rows.map(r => Number(r.id)),
  );

  const toInsert = rows.filter(r => validIds.has(r.wordId) && !existing.has(r.wordId));
  const orphans  = rows.filter(r => !validIds.has(r.wordId));

  console.log(`contrasts: ${rows.length} in file, ${existing.size} already loaded, ${toInsert.length} to insert${orphans.length ? `, ${orphans.length} orphaned wordIds skipped` : ''}`);
  console.log('sample:', toInsert.slice(0, 3).map(r => `${r.word} != ${r.contrastWord} (${r.contrastGloss})`));

  if (!APPLY) { console.log('\nDRY RUN — pass --apply to write.'); return; }

  for (let i = 0; i < toInsert.length; i += 50) {
    await client.batch(
      toInsert.slice(i, i + 50).map(r => ({
        sql: `INSERT INTO vocab_word_contrasts (word_id, contrast_word, contrast_gloss, confusion_type, status)
              VALUES (?, ?, ?, ?, 'draft')
              ON CONFLICT(word_id) DO NOTHING`,
        args: [r.wordId, r.contrastWord, r.contrastGloss, r.confusionType],
      })),
      'write',
    );
  }

  const [{ n }] = (await client.execute('SELECT COUNT(*) n FROM vocab_word_contrasts')).rows;
  console.log(`done — vocab_word_contrasts now holds ${n} rows (status=draft).`);
}

run().catch(e => { console.error(e); process.exit(1); });
