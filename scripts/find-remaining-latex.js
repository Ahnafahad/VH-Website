/**
 * Read-only: find DB rows that still have raw LaTeX escapes like \'e, \"u, \^a, etc.
 * These slipped past the earlier recovery because my stripper didn't handle accents.
 *
 * Run: node --env-file=.env.local scripts/find-remaining-latex.js
 */

'use strict';

const { createClient } = require('@libsql/client');

async function main() {
  const client = createClient({
    url:       process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  // Any remaining backslash followed by (' " ^ ~ ` =) is a LaTeX accent; \\ is a line break.
  const res = await client.execute(`
    SELECT u."order" AS unit_order, w.id, w.word, w.definition, w.example_sentence
    FROM vocab_words w JOIN vocab_units u ON w.unit_id = u.id
    WHERE w.word             GLOB '*\\*'
       OR w.definition       GLOB '*\\*'
       OR w.example_sentence GLOB '*\\*'
  `);

  console.log(`Rows with any backslash anywhere: ${res.rows.length}\n`);

  for (const r of res.rows) {
    console.log(`  unit ${r.unit_order} · id=${r.id} · "${r.word}"`);
    if (/\\/.test(r.word))             console.log(`    word: ${JSON.stringify(r.word)}`);
    if (/\\/.test(r.definition || '')) console.log(`    def:  ${JSON.stringify(r.definition)}`);
    if (/\\/.test(r.example_sentence || '')) console.log(`    ex:   ${JSON.stringify(r.example_sentence)}`);
  }

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
