// Deletes registrations still 'pending' after more than 2 months. Dry-run by default; --apply to delete.
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
const apply = process.argv.includes('--apply');
const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
const where = "status = 'pending' AND created_at < strftime('%s','now','-2 months')";

const rows = (await db.execute(`SELECT id, created_at FROM registrations WHERE ${where}`)).rows;
console.log(`${rows.length} stale pending registrations (ids: ${rows.map(r => r.id).join(', ')})`);
if (apply) {
  const r = await db.execute(`DELETE FROM registrations WHERE ${where}`);
  console.log(`Deleted ${r.rowsAffected}.`);
} else console.log('Dry run. Re-run with --apply to delete.');
