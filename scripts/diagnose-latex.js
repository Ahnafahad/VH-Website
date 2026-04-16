/**
 * Read-only: count LaTeX artifacts per unit in vocab_words.
 * Run: node --env-file=.env.local scripts/diagnose-latex.js
 */

'use strict';

const { createClient } = require('@libsql/client');

async function main() {
  const client = createClient({
    url:       process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const all = await client.execute(`
    SELECT u."order" AS unit_order, w.id, w.word, w.definition, w.example_sentence
    FROM vocab_words w
    JOIN vocab_units u ON w.unit_id = u.id
    ORDER BY u."order", w.id
  `);

  // Patterns that look like LaTeX leftovers
  const patterns = [
    { name: '\\textbf',   re: /\\textbf/ },
    { name: '\\textit',   re: /\\textit/ },
    { name: '\\emph',     re: /\\emph/ },
    { name: '{',          re: /\{/ },
    { name: '}',          re: /\}/ },
    { name: '\\\\',       re: /\\\\/ },
    { name: '\\&',        re: /\\&/ },
    { name: '\\%',        re: /\\%/ },
    { name: 'trunc?',     re: /\{[A-Za-z]+$/ },  // looks truncated at `{word`
  ];

  const perUnit = new Map();
  const affectedRows = [];

  for (const row of all.rows) {
    const u = Number(row.unit_order);
    const s = perUnit.get(u) || { total: 0, exHits: 0, defHits: 0 };
    s.total++;

    const ex  = row.example_sentence || '';
    const def = row.definition || '';
    let hit = false;
    for (const p of patterns) {
      if (p.re.test(ex))  { s.exHits++;  hit = true; break; }
    }
    for (const p of patterns) {
      if (p.re.test(def)) { s.defHits++; break; }
    }
    if (hit) affectedRows.push({ unit: u, id: row.id, word: row.word, example: ex });

    perUnit.set(u, s);
  }

  console.log('── LaTeX artifact count per unit ──');
  console.log('  Unit | words | ex_issues | def_issues');
  let totalEx = 0, totalDef = 0, totalWords = 0;
  for (const [u, s] of [...perUnit.entries()].sort((a,b)=>a[0]-b[0])) {
    console.log(`  ${String(u).padStart(4)} | ${String(s.total).padStart(5)} | ${String(s.exHits).padStart(9)} | ${String(s.defHits).padStart(10)}`);
    totalEx += s.exHits; totalDef += s.defHits; totalWords += s.total;
  }
  console.log(`  ---- | ${String(totalWords).padStart(5)} | ${String(totalEx).padStart(9)} | ${String(totalDef).padStart(10)}`);

  console.log(`\nTotal affected example rows: ${affectedRows.length}`);
  console.log('\n── Sample affected examples (first 15) ──');
  for (const r of affectedRows.slice(0, 15)) {
    console.log(`  Unit ${r.unit} · id=${r.id} · "${r.word}"`);
    console.log(`    ${JSON.stringify(r.example)}`);
  }

  // Check if examples appear truncated (end mid-word / end with { )
  let truncatedCount = 0;
  for (const r of affectedRows) {
    const e = r.example.trim();
    if (/\{[A-Za-z]*$/.test(e) || !/[.!?"]$/.test(e)) truncatedCount++;
  }
  console.log(`\nOf those, likely truncated (no ending punctuation or ends at '{word'): ${truncatedCount}`);

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
