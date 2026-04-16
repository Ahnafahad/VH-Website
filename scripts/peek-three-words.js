'use strict';
const { createClient } = require('@libsql/client');

(async () => {
  const client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
  const r = await client.execute(`
    SELECT u."order" AS u, w.id, w.word, w.part_of_speech, w.definition, w.example_sentence,
           w.synonyms, w.antonyms
    FROM vocab_words w JOIN vocab_units u ON w.unit_id = u.id
    WHERE w.id IN (1741, 1801, 1820)
  `);
  for (const x of r.rows) {
    console.log(`\n[unit ${x.u}] id=${x.id} · ${x.word} (${x.part_of_speech})`);
    console.log(`  def:  ${x.definition}`);
    console.log(`  ex:   ${x.example_sentence}`);
    console.log(`  syns: ${x.synonyms}`);
    console.log(`  ants: ${x.antonyms}`);
  }
  process.exit(0);
})();
