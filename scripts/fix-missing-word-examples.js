/**
 * Patch the three example sentences where the word itself was absent.
 * Rewrites match the voice of the rest of the corpus: a specific scene,
 * em dashes for asides, enough surrounding detail to infer the meaning.
 *
 * Run:  node --env-file=.env.local scripts/fix-missing-word-examples.js --dry-run
 *       node --env-file=.env.local scripts/fix-missing-word-examples.js
 */

'use strict';

const { createClient } = require('@libsql/client');

const DRY_RUN = process.argv.includes('--dry-run');

const REWRITES = [
  {
    id:   1741,
    word: 'Altruism',
    example: 'Her decision to run a literacy programme in a poor rural town, on a fraction of her former salary, was a rare act of altruism\u2014no recognition sought, no reward expected, no audience watching.',
  },
  {
    id:   1801,
    word: 'Unctuous',
    example: 'The hotel manager\u2019s unctuous manner\u2014smiling at every complaint, praising every choice as inspired, agreeing with the most contradictory requests\u2014left guests more uneasy than welcomed.',
  },
  {
    id:   1820,
    word: 'Ironic',
    example: 'Her reply was ironic\u2014\u201CWhat a wonderful morning,\u201D she said as the rain poured down the windows\u2014and everyone at the table understood she meant exactly the opposite.',
  },
];

async function main() {
  const client = createClient({
    url:       process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  for (const r of REWRITES) {
    const before = (await client.execute({
      sql:  `SELECT example_sentence FROM vocab_words WHERE id = ?`,
      args: [r.id],
    })).rows[0]?.example_sentence;

    // Sanity check: the new sentence actually contains the word stem.
    const stem = r.word.toLowerCase().replace(/y$/, '').replace(/e$/, '');
    if (!new RegExp(`\\b${stem}`, 'i').test(r.example)) {
      console.error(`ERROR: new example for "${r.word}" still doesn't contain the word stem.`);
      process.exit(1);
    }

    console.log(`\nid=${r.id} · "${r.word}"`);
    console.log(`  before: ${JSON.stringify(before)}`);
    console.log(`  after : ${JSON.stringify(r.example)}`);

    if (!DRY_RUN) {
      await client.execute({
        sql:  `UPDATE vocab_words SET example_sentence = ? WHERE id = ?`,
        args: [r.example, r.id],
      });
    }
  }

  console.log(DRY_RUN ? `\n[DRY RUN] no rows modified.` : `\n✓ 3 rows updated.`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
