import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';

// Load creds from vercel.env without printing them
const env = readFileSync(new URL('../vercel.env', import.meta.url), 'utf8');
const get = (k) => (env.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim();

const client = createClient({
  url: get('TURSO_DATABASE_URL'),
  authToken: get('TURSO_AUTH_TOKEN'),
});

const total = await client.execute('SELECT COUNT(*) AS c FROM registrations');
console.log('TOTAL registrations:', total.rows[0].c);

const byStatus = await client.execute(
  'SELECT status, COUNT(*) AS c FROM registrations GROUP BY status'
);
console.log('\nBy status:');
for (const r of byStatus.rows) console.log('  ', r.status, '=', r.c);

const emailStats = await client.execute(
  `SELECT
     SUM(CASE WHEN student_email_status='sent' THEN 1 ELSE 0 END) AS sent,
     SUM(CASE WHEN student_email_status='failed' THEN 1 ELSE 0 END) AS failed,
     SUM(CASE WHEN student_email_status IS NULL THEN 1 ELSE 0 END) AS none
   FROM registrations`
);
console.log('\nStudent email delivery status:', emailStats.rows[0]);

const rows = await client.execute(
  `SELECT id, name, email, program_mode, status,
          datetime(created_at,'unixepoch') AS created
   FROM registrations ORDER BY created_at DESC LIMIT 50`
);
console.log('\nMost recent (up to 50):');
for (const r of rows.rows) {
  console.log(`  #${r.id} | ${r.name} | ${r.email} | ${r.program_mode ?? '-'} | ${r.status} | ${r.created}`);
}

// Distinct valid emails count (dedup)
const distinct = await client.execute(
  `SELECT COUNT(DISTINCT lower(email)) AS c FROM registrations WHERE email LIKE '%@%'`
);
console.log('\nDistinct valid emails:', distinct.rows[0].c);
