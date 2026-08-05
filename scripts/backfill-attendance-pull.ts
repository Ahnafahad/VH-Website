/**
 * Attendance back-sync: for PAST classes, fills in the online-attendance fact
 * from submitted ONLINE test attempts wherever it is missing — see
 * src/lib/lms/attendance-backsync.ts for the exact rule (fills gaps and
 * upgrades non-manual offline rows; NEVER touches a row an instructor set
 * manually, source='manual').
 *
 * This is the explicit admin action Wave 4 §8 calls for — it never runs
 * automatically. Dry run by default; pass --apply to write.
 *
 *   $env:NODE_EXTRA_CA_CERTS="D:\VH Website\win-roots.pem"
 *   npx tsx scripts/backfill-attendance-pull.ts            # preview
 *   npx tsx scripts/backfill-attendance-pull.ts --apply    # write
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

// .env.local must land in process.env before the db client module is
// imported, since it reads TURSO_* at module scope.
const envPath = path.join(process.cwd(), '.env.local');
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const APPLY = process.argv.includes('--apply');

async function main() {
  const { db } = await import('../src/lib/db');
  const { planAttendanceBackSync, applyAttendanceBackSync } = await import('../src/lib/lms/attendance-backsync');

  const plan = await planAttendanceBackSync(db);

  console.log(`Would write:        ${plan.toWrite.length}`);
  console.log(`  inserts (gaps):   ${plan.toWrite.filter(w => w.action === 'insert').length}`);
  console.log(`  upgrades (offline->online, non-manual): ${plan.toWrite.filter(w => w.action === 'upgrade').length}`);
  console.log(`Skipped:            ${plan.skipped.length}`);
  console.log(`  already-online:  ${plan.skipped.filter(s => s.reason === 'already-online').length}`);
  console.log(`  manual-protected:${plan.skipped.filter(s => s.reason === 'manual-protected').length}`);
  console.log(`  no-match:        ${plan.skipped.filter(s => s.reason === 'no-match').length}\n`);

  for (const w of plan.toWrite) {
    console.log(`  ${w.action.toUpperCase()} — session ${w.sessionId}, user ${w.userId} (attempt ${w.attemptId})`);
  }
  if (plan.skipped.some(s => s.reason === 'manual-protected')) {
    console.log('\nManual-protected (never touched):');
    for (const s of plan.skipped.filter(s => s.reason === 'manual-protected')) {
      console.log(`  session ${s.sessionId}, user ${s.userId} (attempt ${s.attemptId})`);
    }
  }

  if (APPLY) {
    const written = await applyAttendanceBackSync(db, plan);
    console.log(`\nApplied ${written} write(s).`);
  } else {
    console.log('\nDry run — no writes performed. Re-run with --apply to write.');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
