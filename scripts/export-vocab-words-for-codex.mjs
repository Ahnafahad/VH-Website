// Read-only export of vocab_words for the Codex alt-definition pipeline.
// Codex never touches the DB directly — it only ever sees this file.
// Usage: NODE_EXTRA_CA_CERTS="../win-roots.pem" node scripts/export-vocab-words-for-codex.mjs
import { createClient } from '@libsql/client';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env.local');
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const i = trimmed.indexOf('=');
      if (i > 0) process.env[trimmed.slice(0, i).trim()] = trimmed.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    }
  }
}

const client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

const r = await client.execute(`
  SELECT id, word, part_of_speech, definition, synonyms, antonyms
  FROM vocab_words
  ORDER BY id
`);

const words = r.rows.map(row => ({
  id: row.id,
  word: row.word,
  pos: row.part_of_speech,
  current_definition: row.definition,
  synonyms: JSON.parse(row.synonyms || '[]'),
  antonyms: JSON.parse(row.antonyms || '[]'),
}));

const outPath = resolve(__dirname, '..', '.claude/scratch/vocab-alt-defs/words-snapshot.json');
writeFileSync(outPath, JSON.stringify(words, null, 2));
console.log(`Exported ${words.length} words to ${outPath}`);
process.exit(0);
