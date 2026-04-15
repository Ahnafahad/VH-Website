'use strict';
const { createClient } = require('@libsql/client');
const fs = require('fs'), path = require('path');

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
      const t = line.trim();
      if (t && !t.startsWith('#')) {
        const [key, ...rest] = t.split('=');
        if (key && rest.length > 0) process.env[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
      }
    });
  }
}
loadEnv();

const client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

async function main() {
  const rows = await client.execute(`
    SELECT vu.id, vu.name, vu."order",
           vt.id as tid, vt.name as tname,
           COUNT(vw.id) as wc
    FROM vocab_units vu
    LEFT JOIN vocab_themes vt ON vt.unit_id = vu.id
    LEFT JOIN vocab_words vw ON vw.theme_id = vt.id
    GROUP BY vu.id, vt.id
    ORDER BY vu."order", vt."order"
  `);

  let emptyUnits = 0;
  console.log('\nAll units/themes:\n');
  for (const r of rows.rows) {
    const wc = Number(r[5] ?? r.wc ?? 0);
    const marker = wc === 0 ? ' ← EMPTY' : '';
    console.log(`  Broad Unit ${r[2]} (id=${r[0]}): ${r[1]}`);
    console.log(`    Theme id=${r[3]}: ${r[4]} | ${wc} words${marker}`);
    if (wc === 0) emptyUnits++;
  }

  console.log(`\nTotal empty themes: ${emptyUnits}`);

  // Also show the 1 word not in source
  const all = await client.execute('SELECT id, word FROM vocab_words ORDER BY id');
  console.log(`\nTotal words in DB: ${all.rows.length}`);

  await client.close();
}

main().catch(err => { console.error(err); process.exit(1); });
