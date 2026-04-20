/**
 * One-time backfill for two corrupted fields on vocab_user_word_records:
 *
 *   1. accuracy_rate — older code paths (flashcard/rate, practice/rate) never
 *      recomputed this, and legacy migration didn't populate it, so many rows
 *      store 0 or 0.5 despite high correct_attempts counts. We recompute it
 *      from (correct_attempts / total_attempts).
 *
 *   2. in_srs_pool — a handful of rows ended up at 0 despite having real study
 *      history (total_attempts > 0 or srs_repetitions > 0). No current writer
 *      sets it to false, so these are residue from an earlier migration /
 *      manual script. We flip them back to 1 so they re-enter the review queue.
 *
 * Run:  node --env-file=.env.local scripts/backfill-vocab-stats.js
 *       node --env-file=.env.local scripts/backfill-vocab-stats.js --dry-run
 */

'use strict';

const { createClient } = require('@libsql/client');

const url       = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url || !authToken) {
  console.error('Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN');
  process.exit(1);
}

const DRY = process.argv.includes('--dry-run');
const client = createClient({ url, authToken });

(async () => {
  const header = DRY ? '[DRY RUN]' : '[APPLY]';
  console.log(`${header} Backfilling vocab_user_word_records…\n`);

  // ── 1. accuracy_rate ───────────────────────────────────────────────────────

  const accuracyBefore = await client.execute({
    sql: `SELECT COUNT(*) AS n
          FROM vocab_user_word_records
          WHERE total_attempts > 0
            AND ABS(accuracy_rate - (CAST(correct_attempts AS REAL) / total_attempts)) > 0.0001`,
  });
  const accuracyRowsToFix = accuracyBefore.rows[0].n;
  console.log(`accuracy_rate: ${accuracyRowsToFix} rows need correction`);

  if (accuracyRowsToFix > 0 && !DRY) {
    const now = Math.floor(Date.now() / 1000);
    await client.execute({
      sql: `UPDATE vocab_user_word_records
            SET accuracy_rate = CAST(correct_attempts AS REAL) / total_attempts,
                updated_at    = ?
            WHERE total_attempts > 0
              AND ABS(accuracy_rate - (CAST(correct_attempts AS REAL) / total_attempts)) > 0.0001`,
      args: [now],
    });
    console.log(`  → updated ${accuracyRowsToFix} rows`);
  }

  // ── 2. in_srs_pool ─────────────────────────────────────────────────────────

  const poolBefore = await client.execute({
    sql: `SELECT COUNT(*) AS n
          FROM vocab_user_word_records
          WHERE in_srs_pool = 0
            AND (total_attempts > 0 OR srs_repetitions > 0)`,
  });
  const poolRowsToFix = poolBefore.rows[0].n;
  console.log(`\nin_srs_pool:   ${poolRowsToFix} studied words wrongly excluded`);

  if (poolRowsToFix > 0 && !DRY) {
    const now = Math.floor(Date.now() / 1000);
    await client.execute({
      sql: `UPDATE vocab_user_word_records
            SET in_srs_pool = 1, updated_at = ?
            WHERE in_srs_pool = 0
              AND (total_attempts > 0 OR srs_repetitions > 0)`,
      args: [now],
    });
    console.log(`  → updated ${poolRowsToFix} rows`);
  }

  // ── Spot-check Habib ────────────────────────────────────────────────────────

  const habib = await client.execute({
    sql: `SELECT w.word, r.total_attempts, r.correct_attempts, r.accuracy_rate,
                 r.consecutive_correct, r.in_srs_pool
          FROM vocab_user_word_records r
          JOIN vocab_words w ON w.id = r.word_id
          JOIN users u ON u.id = r.user_id
          WHERE u.email = 'habiburrahmanrayat@gmail.com'
            AND r.total_attempts >= 3
          ORDER BY w.word`,
  });
  console.log(`\nHabib's words with total_attempts >= 3 (post-backfill):`);
  for (const row of habib.rows) {
    console.log(`  ${row.word.padEnd(16)} ${row.correct_attempts}/${row.total_attempts}  acc=${Number(row.accuracy_rate).toFixed(3)}  consec_correct=${row.consecutive_correct}  pool=${row.in_srs_pool}`);
  }

  console.log(`\n${DRY ? 'No changes applied (dry run).' : 'Done.'}`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
