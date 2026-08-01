/**
 * scripts/backfill-session-materials.mjs
 *
 * One-off production data fix: materials link to a class two ways —
 * the legacy `materials.class_session_id` column and the `session_materials`
 * junction table. Some materials only got the column (linked via the old
 * "Link to class" dialog, before it also wrote the junction). This backfills
 * the missing junction row for every such material.
 *
 * Idempotent — safe to run twice. Rows already in session_materials are
 * skipped (INSERT OR IGNORE on the (session_id, material_id) unique index),
 * and the "missing" set is recomputed fresh each run via a LEFT JOIN, so a
 * second run finds nothing left to do.
 *
 * Does NOT touch materials.class_session_id — read-only on that column.
 * Does NOT delete or modify any existing session_materials row.
 *
 * ─── Run commands (PowerShell from D:\VH Website) ───────────────────────────
 *
 *  Dry run (prints what would change, writes nothing):
 *    $env:NODE_EXTRA_CA_CERTS="D:\VH Website\win-roots.pem"; cd "D:\VH Website\vh-website"; node scripts/backfill-session-materials.mjs
 *
 *  Apply (performs the writes):
 *    $env:NODE_EXTRA_CA_CERTS="D:\VH Website\win-roots.pem"; cd "D:\VH Website\vh-website"; node scripts/backfill-session-materials.mjs --apply
 *
 * ────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

// ─── Load .env ───────────────────────────────────────────────────────────────
// Read vh-website/.env.local manually (no dotenv dependency), same as the
// other DB scripts in this directory. Never hardcode credentials — they come
// from env only.

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

if (!process.env.TURSO_DATABASE_URL) {
  console.error('TURSO_DATABASE_URL is not set (checked process.env and .env.local).');
  process.exit(1);
}

// ─── Args ────────────────────────────────────────────────────────────────────
const APPLY = process.argv.includes('--apply');
const MODE  = APPLY ? 'APPLY' : 'DRY RUN';

console.log(`\n=== backfill-session-materials.mjs [${MODE}] ===\n`);
if (!APPLY) {
  console.log('(Pass --apply to perform the actual writes)\n');
}

// ─── DB client ───────────────────────────────────────────────────────────────
const client = createClient({
  url:       process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// ─── Scan ────────────────────────────────────────────────────────────────────

const scannedRows = await client.execute(
  `SELECT COUNT(*) AS cnt FROM materials WHERE class_session_id IS NOT NULL`,
);
const scannedCount = Number(scannedRows.rows[0].cnt);

// Materials with class_session_id set but no matching session_materials row.
const missingRows = await client.execute(`
  SELECT m.id AS material_id, m.class_session_id AS session_id
  FROM materials m
  LEFT JOIN session_materials sm
    ON sm.session_id = m.class_session_id AND sm.material_id = m.id
  WHERE m.class_session_id IS NOT NULL AND sm.id IS NULL
  ORDER BY m.id ASC
`);
const missing = missingRows.rows.map(r => ({
  materialId: Number(r.material_id),
  sessionId:  Number(r.session_id),
}));

console.log(`Materials with class_session_id set: ${scannedCount}`);
console.log(`Missing session_materials row:       ${missing.length}\n`);

if (missing.length > 0) {
  console.log('Preview (up to 20):');
  for (const row of missing.slice(0, 20)) {
    console.log(`  material_id=${row.materialId}  session_id=${row.sessionId}`);
  }
  if (missing.length > 20) {
    console.log(`  ... and ${missing.length - 20} more`);
  }
  console.log();
}

// ─── Apply ───────────────────────────────────────────────────────────────────

if (!APPLY) {
  console.log(`Would insert ${missing.length} session_materials row(s). No writes performed.\n`);
} else if (missing.length === 0) {
  console.log('Nothing to insert.\n');
} else {
  const BATCH_SIZE = 100;
  let inserted = 0;
  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const chunk = missing.slice(i, i + BATCH_SIZE);
    const placeholders = chunk.map(() => '(?, ?)').join(', ');
    const args = [];
    for (const row of chunk) {
      args.push(row.sessionId, row.materialId);
    }
    await client.execute({
      sql: `INSERT OR IGNORE INTO session_materials (session_id, material_id) VALUES ${placeholders}`,
      args,
    });
    inserted += chunk.length;
  }
  console.log(`Inserted ${inserted} session_materials row(s) (conflicts skipped via INSERT OR IGNORE).\n`);
}

await client.close();
console.log(`=== Done [${MODE}] ===\n`);
