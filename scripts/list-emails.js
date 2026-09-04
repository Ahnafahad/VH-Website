const { createClient } = require('@libsql/client');
const fs = require('fs');
const path = require('path');

const env = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
env.split('\n').forEach(line => {
  const [k, ...v] = line.trim().split('=');
  if (k && !k.startsWith('#')) process.env[k] = v.join('=');
});

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  const res = await db.execute(`SELECT email, name, role FROM users WHERE email IS NOT NULL AND email != '' ORDER BY role, name`);
  console.log(`\nTotal: ${res.rows.length} users\n`);
  res.rows.forEach(r => console.log(`[${r.role}] ${r.name || '(no name)'} — ${r.email}`));
}

main().catch(console.error);
