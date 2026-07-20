/**
 * scripts/fix-attendance.mjs
 * One-off production data fix for class_attendance.
 *
 * PART 1 — Mode inversion for the single session on 2026-07-20 (Asia/Dhaka):
 *   Every class_attendance row for that session has its mode swapped:
 *   online→offline and offline→online.
 *   ⚠  NOT idempotent: running --apply twice restores the original modes.
 *      Run --apply EXACTLY ONCE.
 *
 * PART 2 — Backfill "Offline, present" for all OTHER completed sessions:
 *   For every completed session (excluding the Part-1 session), inserts a
 *   class_attendance row (mode='offline', joined_at = session's scheduled_at)
 *   for every in-scope student who has no existing row. Existing rows are never
 *   touched. Idempotent — safe to re-run.
 *
 * ─── Run commands (PowerShell from D:\VH Website) ───────────────────────────
 *
 *  Dry run (prints what would change, writes nothing):
 *    $env:NODE_EXTRA_CA_CERTS="D:\VH Website\win-roots.pem"; cd "D:\VH Website\vh-website"; node scripts/fix-attendance.mjs
 *
 *  Apply (performs the writes):
 *    $env:NODE_EXTRA_CA_CERTS="D:\VH Website\win-roots.pem"; cd "D:\VH Website\vh-website"; node scripts/fix-attendance.mjs --apply
 *
 * ────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

// ─── Load .env ───────────────────────────────────────────────────────────────
// Read vh-website/.env.local manually (no dotenv dependency), same as the
// other DB scripts in this directory.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env.local');

try {
  const envContents = readFileSync(envPath, 'utf8');
  for (const line of envContents.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (key && !(key in process.env)) {
      process.env[key] = val;
    }
  }
} catch (err) {
  console.error(`Could not read ${envPath}:`, err.message);
  process.exit(1);
}

// ─── Args ────────────────────────────────────────────────────────────────────
const APPLY = process.argv.includes('--apply');
const MODE  = APPLY ? 'APPLY' : 'DRY RUN';

console.log(`\n=== fix-attendance.mjs [${MODE}] ===\n`);
if (!APPLY) {
  console.log('(Pass --apply to perform the actual writes)\n');
}

// ─── DB client ───────────────────────────────────────────────────────────────
const client = createClient({
  url:       process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Format a unix-seconds timestamp as a readable local string. */
function fmtTs(unixSec) {
  return new Date(unixSec * 1000).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

/**
 * Asia/Dhaka is UTC+6, no DST.
 * Given a calendar date string 'YYYY-MM-DD', returns the [startUnix, endUnix)
 * range in UTC seconds that covers that full Dhaka day.
 */
function dhakaDayBounds(dateStr) {
  // Dhaka midnight = UTC midnight - 6 hours
  const [y, m, d] = dateStr.split('-').map(Number);
  const startUtc = Date.UTC(y, m - 1, d, 0, 0, 0) - 6 * 3600 * 1000; // subtract +6 offset
  const endUtc   = startUtc + 24 * 3600 * 1000;
  return {
    startSec: Math.floor(startUtc / 1000),
    endSec:   Math.floor(endUtc   / 1000),
  };
}

// ─── Part 1: find + invert the 2026-07-20 session ────────────────────────────
console.log('── PART 1: Mode inversion for 2026-07-20 (Asia/Dhaka) ──────────────\n');

const { startSec, endSec } = dhakaDayBounds('2026-07-20');

const candidateRows = await client.execute({
  sql: `SELECT id, title, scheduled_at FROM class_sessions
        WHERE scheduled_at >= ? AND scheduled_at < ?`,
  args: [startSec, endSec],
});

const candidates = candidateRows.rows;

if (candidates.length !== 1) {
  if (candidates.length === 0) {
    console.error('ABORT: No class_sessions found on 2026-07-20 (Dhaka). Nothing was written.');
  } else {
    console.error(`ABORT: Expected exactly 1 session on 2026-07-20 (Dhaka), found ${candidates.length}:`);
    for (const r of candidates) {
      console.error(`  id=${r.id}  title="${r.title}"  scheduled_at=${fmtTs(r.scheduled_at)}`);
    }
  }
  await client.close();
  process.exit(1);
}

const targetSession = candidates[0];
const targetSessionId = Number(targetSession.id);

console.log(`Target session: id=${targetSessionId}  title="${targetSession.title}"  scheduled_at=${fmtTs(Number(targetSession.scheduled_at))}`);

// Count rows that will be swapped
const countRows = await client.execute({
  sql: `SELECT COUNT(*) AS cnt FROM class_attendance WHERE session_id = ?`,
  args: [targetSessionId],
});
const swapCount = Number(countRows.rows[0].cnt);

if (APPLY) {
  if (swapCount > 0) {
    await client.execute({
      sql: `UPDATE class_attendance
            SET mode = CASE mode
              WHEN 'online'  THEN 'offline'
              WHEN 'offline' THEN 'online'
              ELSE mode
            END
            WHERE session_id = ?`,
      args: [targetSessionId],
    });
    console.log(`  ✓ Swapped mode on ${swapCount} attendance row(s).`);
  } else {
    console.log('  No attendance rows exist for this session — nothing to swap.');
  }
  console.log('\n  ⚠  WARNING: Part 1 is NOT idempotent. Do NOT run --apply again');
  console.log('     or the modes will be inverted back to their original values.\n');
} else {
  console.log(`  Would swap mode on ${swapCount} attendance row(s) (online↔offline).`);
  if (swapCount > 0) {
    const preview = await client.execute({
      sql: `SELECT user_id, mode FROM class_attendance WHERE session_id = ? LIMIT 10`,
      args: [targetSessionId],
    });
    console.log('  Preview (up to 10 rows):');
    for (const r of preview.rows) {
      const newMode = r.mode === 'online' ? 'offline' : 'online';
      console.log(`    user_id=${r.user_id}  ${r.mode} → ${newMode}`);
    }
    if (swapCount > 10) {
      console.log(`    ... and ${swapCount - 10} more`);
    }
  }
  console.log();
}

// ─── Part 2: backfill "Offline, present" for all other completed sessions ────
console.log('── PART 2: Backfill offline attendance for all other completed sessions ──\n');

const completedRows = await client.execute({
  sql: `SELECT id, title, subject, product, batch, scheduled_at
        FROM class_sessions
        WHERE status = 'completed' AND id != ?
        ORDER BY scheduled_at ASC`,
  args: [targetSessionId],
});

const completedSessions = completedRows.rows;
console.log(`Found ${completedSessions.length} completed session(s) to process.\n`);

let grandTotalInserted = 0;
let grandTotalAlready  = 0;

for (const session of completedSessions) {
  const sessId      = Number(session.id);
  const product     = session.product;
  const batch       = session.batch;       // may be null
  const scheduledAt = Number(session.scheduled_at);

  // Step 1: users with active access to this product
  const accessRows = await client.execute({
    sql: `SELECT ua.user_id
          FROM user_access ua
          WHERE ua.product = ? AND ua.active = 1`,
    args: [product],
  });

  if (accessRows.rows.length === 0) {
    console.log(`  #${sessId} "${session.title}" — 0 in-scope students (no active access rows), skipped`);
    continue;
  }

  const accessUserIds = accessRows.rows.map(r => Number(r.user_id));

  // Step 2: filter to active students respecting batch rule
  // batch IS NULL → no batch filter; else users.batch = session.batch OR users.batch IS NULL
  let studentRows;
  if (batch === null || batch === undefined) {
    // No batch filter
    const placeholders = accessUserIds.map(() => '?').join(',');
    studentRows = await client.execute({
      sql: `SELECT id FROM users
            WHERE id IN (${placeholders})
              AND status = 'active'
              AND role   = 'student'`,
      args: accessUserIds,
    });
  } else {
    const placeholders = accessUserIds.map(() => '?').join(',');
    studentRows = await client.execute({
      sql: `SELECT id FROM users
            WHERE id IN (${placeholders})
              AND status = 'active'
              AND role   = 'student'
              AND (batch = ? OR batch IS NULL)`,
      args: [...accessUserIds, batch],
    });
  }

  const scopedIds = studentRows.rows.map(r => Number(r.id));

  if (scopedIds.length === 0) {
    console.log(`  #${sessId} "${session.title}" — 0 in-scope students, skipped`);
    continue;
  }

  // Step 3: find which students already have an attendance row
  const existingRows = await client.execute({
    sql: `SELECT user_id FROM class_attendance WHERE session_id = ?`,
    args: [sessId],
  });
  const existingSet = new Set(existingRows.rows.map(r => Number(r.user_id)));

  const missing = scopedIds.filter(uid => !existingSet.has(uid));
  const alreadyPresent = scopedIds.length - missing.length;

  if (!APPLY || missing.length === 0) {
    console.log(`  #${sessId} "${session.title}" — ${APPLY ? 0 : missing.length} inserted, ${alreadyPresent} already recorded${!APPLY && missing.length > 0 ? ' (dry run — no writes)' : ''}`);
    grandTotalInserted += APPLY ? 0 : missing.length;
    grandTotalAlready  += alreadyPresent;
    continue;
  }

  // Step 4 (apply only): insert missing rows in batches of 100
  const BATCH_SIZE = 100;
  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const chunk = missing.slice(i, i + BATCH_SIZE);
    const placeholders = chunk.map(() => '(?, ?, ?, ?)').join(', ');
    const args = [];
    for (const uid of chunk) {
      args.push(sessId, uid, scheduledAt, 'offline');
    }
    await client.execute({
      sql: `INSERT OR IGNORE INTO class_attendance (session_id, user_id, joined_at, mode)
            VALUES ${placeholders}`,
      args,
    });
  }

  console.log(`  #${sessId} "${session.title}" — ${missing.length} inserted, ${alreadyPresent} already recorded`);
  grandTotalInserted += missing.length;
  grandTotalAlready  += alreadyPresent;
}

console.log(`\nGrand total: ${grandTotalInserted} ${APPLY ? 'inserted' : 'would be inserted'}, ${grandTotalAlready} already recorded across ${completedSessions.length} session(s).\n`);

await client.close();
console.log(`=== Done [${MODE}] ===\n`);
