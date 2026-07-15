// One-off: remove duplicate (session_id, word_id) rows from vocab_quiz_answers,
// keeping the earliest (lowest id) row of each pair. Required before drizzle-kit
// push can apply the unique constraint the schema has declared since July 2026.
import { createClient } from '@libsql/client';
import { readFileSync } from 'node:fs';

for (const f of ['.env.local', '.env']) {
  try {
    for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
    }
  } catch {}
}

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const victims = await client.execute(
  `SELECT id, session_id, word_id FROM vocab_quiz_answers
   WHERE id NOT IN (SELECT MIN(id) FROM vocab_quiz_answers GROUP BY session_id, word_id)
   ORDER BY id`
);
console.log(`rows to delete: ${victims.rows.length}`);
for (const r of victims.rows) console.log(`  id ${r.id} (session ${r.session_id}, word ${r.word_id})`);

if (victims.rows.length === 0) {
  console.log('nothing to do.');
} else if (victims.rows.length > 20) {
  console.log('SAFETY STOP: more than 20 rows matched — aborting without deleting. Re-inspect first.');
} else {
  const result = await client.execute(
    `DELETE FROM vocab_quiz_answers
     WHERE id NOT IN (SELECT MIN(id) FROM vocab_quiz_answers GROUP BY session_id, word_id)`
  );
  console.log(`deleted: ${result.rowsAffected}`);
  const remaining = await client.execute(
    'SELECT COUNT(*) AS total FROM (SELECT 1 FROM vocab_quiz_answers GROUP BY session_id, word_id HAVING COUNT(*) > 1)'
  );
  console.log(`duplicate groups remaining: ${remaining.rows[0].total} (should be 0)`);
  const count = await client.execute('SELECT COUNT(*) AS n FROM vocab_quiz_answers');
  console.log(`vocab_quiz_answers rows now: ${count.rows[0].n} (was 2230, expect 2225)`);
}
client.close();
