/**
 * seed-connotations.mjs
 * Updates vocab_words.connotation from scripts/data/vocab-connotations.json.
 * Matches on word text: tries exact → lowercase → diacritic-stripped lowercase.
 *
 * Run (Windows PowerShell, from vh-website/):
 *   $env:NODE_EXTRA_CA_CERTS='D:\VH Website\win-roots.pem'
 *   node scripts/seed-connotations.mjs
 */

import { createClient } from '@libsql/client';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local
const envPath = resolve(__dirname, '..', '.env.local');
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
        process.env[key] = val;
      }
    }
  }
}

const { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN } = process.env;
if (!TURSO_DATABASE_URL) { console.error('TURSO_DATABASE_URL not set'); process.exit(1); }

const client = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN });

/** Strip diacritics from a string and lowercase it. */
function normalise(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

async function run() {
  // Load JSON source
  const jsonPath = resolve(__dirname, 'data', 'vocab-connotations.json');
  const connotations = JSON.parse(readFileSync(jsonPath, 'utf-8'));
  // { Word: 'positive' | 'negative' | 'inapplicable' }

  // Fetch all vocab words from DB
  const { rows } = await client.execute('SELECT id, word FROM vocab_words');

  // Build lookup maps for the three matching strategies
  const byExact   = new Map(); // "Aberrant" → {id, word}
  const byLower   = new Map(); // "aberrant" → {id, word}
  const byNorm    = new Map(); // normalised → {id, word}

  for (const row of rows) {
    const id = row.id;
    const wordStr = String(row.word);
    byExact.set(wordStr, { id, word: wordStr });
    byLower.set(wordStr.toLowerCase(), { id, word: wordStr });
    byNorm.set(normalise(wordStr), { id, word: wordStr });
  }

  const updates   = []; // { id, connotation }
  const unmatched = []; // JSON keys that found no DB row

  for (const [jsonWord, connotation] of Object.entries(connotations)) {
    let match = byExact.get(jsonWord)
      ?? byLower.get(jsonWord.toLowerCase())
      ?? byNorm.get(normalise(jsonWord));

    if (match) {
      updates.push({ id: match.id, connotation });
    } else {
      unmatched.push(jsonWord);
    }
  }

  // Apply updates in batches
  let applied = 0;
  for (const { id, connotation } of updates) {
    await client.execute({
      sql: 'UPDATE vocab_words SET connotation = ? WHERE id = ?',
      args: [connotation, id],
    });
    applied++;
  }

  // Count remaining NULLs
  const nullResult = await client.execute(
    "SELECT COUNT(*) as cnt FROM vocab_words WHERE connotation IS NULL"
  );
  const nullCount = Number(nullResult.rows[0].cnt);

  // Print summary
  console.log(`\n=== Seed Connotations Summary ===`);
  console.log(`Matched/updated: ${applied}`);
  if (unmatched.length === 0) {
    console.log(`Unmatched JSON words: none`);
  } else {
    console.log(`Unmatched JSON words (${unmatched.length}):`);
    for (const w of unmatched) console.log(`  - ${w}`);
  }
  console.log(`DB words remaining NULL: ${nullCount}`);
  console.log(`=================================\n`);

  process.exit(0);
}

run().catch(e => { console.error('Seed failed:', e.message); process.exit(1); });
