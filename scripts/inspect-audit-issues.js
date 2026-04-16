/**
 * Read-only: show full detail for every row flagged by audit-vocab-db.js,
 * grouped by issue type, so we can decide which need fixing.
 *
 * Run: node --env-file=.env.local scripts/inspect-audit-issues.js
 */

'use strict';

const { createClient } = require('@libsql/client');

function parseArr(s) { try { return JSON.parse(s || '[]'); } catch { return null; } }

async function main() {
  const client = createClient({
    url:       process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const rows = (await client.execute(`
    SELECT u."order" AS unit_order, w.id, w.word, w.part_of_speech,
           w.definition, w.example_sentence, w.synonyms, w.antonyms
    FROM vocab_words w JOIN vocab_units u ON w.unit_id = u.id
  `)).rows;

  const POS_ALLOWED = new Set([
    'noun', 'verb', 'adjective', 'adverb', 'preposition', 'conjunction',
    'interjection', 'pronoun', 'determiner', 'proper noun',
  ]);

  console.log(`\n============== pos: unrecognized value ==============\n`);
  for (const r of rows) {
    if (!POS_ALLOWED.has((r.part_of_speech || '').toLowerCase().trim())) {
      console.log(`  unit ${r.unit_order} · id=${r.id} · "${r.word}"`);
      console.log(`    pos: ${JSON.stringify(r.part_of_speech)}`);
    }
  }

  console.log(`\n============== example: no ending punct ==============\n`);
  for (const r of rows) {
    const e = r.example_sentence || '';
    if (e && !/[.!?"')]$/.test(e.trim())) {
      console.log(`  unit ${r.unit_order} · id=${r.id} · "${r.word}"`);
      console.log(`    ex: ${JSON.stringify(e)}`);
    }
  }

  console.log(`\n============== example: missing word ==============\n`);
  for (const r of rows) {
    if (!r.example_sentence || !r.word) continue;
    const stem = r.word.trim().toLowerCase().replace(/e?$/, '');
    const re   = new RegExp(`\\b${stem}[a-z]{0,4}\\b`, 'i');
    if (!re.test(r.example_sentence)) {
      console.log(`  unit ${r.unit_order} · id=${r.id} · "${r.word}"`);
      console.log(`    ex: ${JSON.stringify(r.example_sentence)}`);
    }
  }

  console.log(`\n============== synonyms: empty array ==============\n`);
  let count = 0;
  for (const r of rows) {
    const a = parseArr(r.synonyms);
    if (Array.isArray(a) && a.length === 0) {
      console.log(`  unit ${r.unit_order} · id=${r.id} · "${r.word}" (${r.part_of_speech})`);
      console.log(`    def: ${JSON.stringify(String(r.definition || '').slice(0, 80))}`);
      count++;
    }
  }
  console.log(`\n  total: ${count}`);

  console.log(`\n============== antonyms: empty array ==============\n`);
  let acount = 0;
  for (const r of rows) {
    const a = parseArr(r.antonyms);
    if (Array.isArray(a) && a.length === 0) {
      console.log(`  unit ${r.unit_order} · id=${r.id} · "${r.word}"`);
      acount++;
    }
  }
  console.log(`\n  total: ${acount}`);

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
