// One-off: inspect prod DB state after failed drizzle push.
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

const tables = await client.execute(
  "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('vocab_error_logs','vocab_quiz_answers','__old_push_vocab_quiz_answers') ORDER BY name"
);
console.log('tables:', tables.rows.map(r => r.name).join(', ') || '(none found)');

const count = await client.execute('SELECT COUNT(*) AS n FROM vocab_quiz_answers');
console.log('vocab_quiz_answers rows:', count.rows[0].n);

const dupes = await client.execute(
  'SELECT session_id, word_id, COUNT(*) AS n FROM vocab_quiz_answers GROUP BY session_id, word_id HAVING n > 1 ORDER BY n DESC LIMIT 10'
);
console.log('duplicate (session_id, word_id) groups:', dupes.rows.length === 0 ? 'none' : '');
for (const r of dupes.rows) console.log(`  session ${r.session_id} word ${r.word_id}: ${r.n} rows`);

const dupeTotal = await client.execute(
  'SELECT COUNT(*) AS total FROM (SELECT COUNT(*) AS n FROM vocab_quiz_answers GROUP BY session_id, word_id HAVING n > 1)'
);
console.log('total duplicate groups:', dupeTotal.rows[0].total);
client.close();
