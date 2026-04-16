/**
 * Standardize synonyms/antonyms to lowercase.
 *
 * Units 1-8 and 22-77 have Title Case ("Commandeer"), while units 9-21 have
 * lowercase ("commandeer"). This script normalizes all to lowercase.
 *
 * Run: node --env-file=.env.local scripts/standardize-synonyms.js
 */

'use strict';

const { createClient } = require('@libsql/client');

async function main() {
  const client = createClient({
    url:       process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  // Also run diagnostic: word counts per broad unit order
  const unitCounts = await client.execute(`
    SELECT u."order" AS unit_order, u.name AS unit_name, COUNT(w.id) AS word_count
    FROM vocab_units u
    LEFT JOIN vocab_words w ON w.unit_id = u.id
    GROUP BY u.id
    ORDER BY u."order"
  `);
  console.log('\n── Word counts per unit ──');
  let cumulative = 0;
  for (const row of unitCounts.rows) {
    cumulative += Number(row.word_count);
    console.log(`  Unit ${row.unit_order} (${row.unit_name}): ${row.word_count} words  [cumulative: ${cumulative}]`);
  }
  console.log(`\nTotal words: ${cumulative}\n`);

  // Fetch all words
  const result = await client.execute('SELECT id, synonyms, antonyms FROM vocab_words');
  let updated = 0;
  let skipped = 0;

  for (const row of result.rows) {
    let changed = false;
    let newSyn = row.synonyms;
    let newAnt = row.antonyms;

    try {
      const synArr = JSON.parse(row.synonyms || '[]');
      const synLower = synArr.map(s => s.toLowerCase());
      if (JSON.stringify(synArr) !== JSON.stringify(synLower)) {
        newSyn = JSON.stringify(synLower);
        changed = true;
      }
    } catch {}

    try {
      const antArr = JSON.parse(row.antonyms || '[]');
      const antLower = antArr.map(a => a.toLowerCase());
      if (JSON.stringify(antArr) !== JSON.stringify(antLower)) {
        newAnt = JSON.stringify(antLower);
        changed = true;
      }
    } catch {}

    if (changed) {
      await client.execute({
        sql: 'UPDATE vocab_words SET synonyms = ?, antonyms = ? WHERE id = ?',
        args: [newSyn, newAnt, row.id],
      });
      updated++;
    } else {
      skipped++;
    }
  }

  console.log(`Done. Updated: ${updated}, Already correct: ${skipped}`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
