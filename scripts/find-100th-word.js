// Find which unit the 100th word lands in, ordered by curriculum order
// (unit.order, theme.order, word.id).
// Run: node --env-file=.env.local scripts/find-100th-word.js

'use strict';
const { createClient } = require('@libsql/client');

(async () => {
  const db = createClient({
    url:       process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const rs = await db.execute(`
    SELECT
      w.id          AS word_id,
      w.word        AS word,
      u.id          AS unit_id,
      u."order"     AS unit_order,
      u.name        AS unit_name,
      t.id          AS theme_id,
      t."order"     AS theme_order,
      t.name        AS theme_name
    FROM vocab_words w
    JOIN vocab_themes t ON t.id = w.theme_id
    JOIN vocab_units  u ON u.id = w.unit_id
    ORDER BY u."order" ASC, t."order" ASC, w.id ASC
  `);

  const total = rs.rows.length;
  console.log(`Total words: ${total}`);

  // Cumulative count per unit
  const byUnit = new Map();
  for (const row of rs.rows) {
    const key = `${row.unit_order}|${row.unit_name}`;
    byUnit.set(key, (byUnit.get(key) ?? 0) + 1);
  }
  console.log('\nWords per unit (curriculum order):');
  let running = 0;
  for (const [key, count] of byUnit) {
    running += count;
    const [order, name] = key.split('|');
    console.log(`  U${order.padStart(2)} ${name.padEnd(40)} ${String(count).padStart(4)}  (cumulative ${running})`);
  }

  const hundredth = rs.rows[99];
  console.log('\n100th word in curriculum order:');
  console.log(`  word:  ${hundredth.word}`);
  console.log(`  unit:  U${hundredth.unit_order}  "${hundredth.unit_name}"`);
  console.log(`  theme: T${hundredth.theme_order} "${hundredth.theme_name}"`);
})();
