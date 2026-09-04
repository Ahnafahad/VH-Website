/**
 * export-vocab-words.mjs
 * Exports all LexiCore vocab content (units → themes → words, full word detail)
 * from Turso into one JSON file. No user/progress data.
 *
 * Run:
 *   $env:NODE_EXTRA_CA_CERTS='D:\VH Website\win-roots.pem'; node --env-file=.env.local scripts/export-vocab-words.mjs
 */

import { createClient } from '@libsql/client';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  throw new Error('Missing TURSO_DATABASE_URL / TURSO_AUTH_TOKEN. Run with: node --env-file=.env.local <script>');
}

const client = createClient({
  url:       process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  const [unitsRes, themesRes, wordsRes] = await Promise.all([
    client.execute('SELECT * FROM vocab_units ORDER BY "order"'),
    client.execute('SELECT * FROM vocab_themes ORDER BY unit_id, "order"'),
    client.execute('SELECT * FROM vocab_words ORDER BY theme_id, id'),
  ]);

  const wordsByTheme = new Map();
  for (const w of wordsRes.rows) {
    const word = {
      id:              w.id,
      word:            w.word,
      partOfSpeech:    w.part_of_speech,
      definition:      w.definition,
      exampleSentence: w.example_sentence,
      synonyms:        JSON.parse(w.synonyms ?? '[]'),
      antonyms:        JSON.parse(w.antonyms ?? '[]'),
      difficultyBase:  w.difficulty_base,
      connotation:     w.connotation,
    };
    if (!wordsByTheme.has(w.theme_id)) wordsByTheme.set(w.theme_id, []);
    wordsByTheme.get(w.theme_id).push(word);
  }

  const themesByUnit = new Map();
  for (const t of themesRes.rows) {
    const theme = {
      id:    t.id,
      name:  t.name,
      order: t.order,
      words: wordsByTheme.get(t.id) ?? [],
    };
    if (!themesByUnit.has(t.unit_id)) themesByUnit.set(t.unit_id, []);
    themesByUnit.get(t.unit_id).push(theme);
  }

  const units = unitsRes.rows.map(u => ({
    id:          u.id,
    name:        u.name,
    description: u.description,
    order:       u.order,
    themes:      themesByUnit.get(u.id) ?? [],
  }));

  const totalWords = wordsRes.rows.length;
  const output = {
    exportedAt: new Date().toISOString(),
    unitCount:  units.length,
    themeCount: themesRes.rows.length,
    wordCount:  totalWords,
    units,
  };

  const outPath = resolve(__dirname, '..', 'vocab-words-export.json');
  writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');

  console.log(`✓ Exported ${units.length} units, ${themesRes.rows.length} themes, ${totalWords} words`);
  console.log(`  → ${outPath}`);

  client.close();
}

main().catch(e => { console.error(e); process.exit(1); });
