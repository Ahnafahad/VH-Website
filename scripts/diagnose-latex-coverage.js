/**
 * Read-only: cross-check which DB units the LaTeX source words cover.
 * Answers: can the 08_vocab_wordsmart.tex recover any broken examples?
 */

'use strict';

const { createClient } = require('@libsql/client');
const fs = require('fs');

async function main() {
  const client = createClient({
    url:       process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  // Extract all \wordentry{WORD}{...} from the LaTeX file
  const latexPath = 'D:\\Downloads\\VH Workbook-20260415T114146Z-3-001\\LaTeX Output\\chapters\\08_vocab_wordsmart.tex';
  const tex = fs.readFileSync(latexPath, 'utf8');
  const matches = [...tex.matchAll(/\\wordentry\{([A-Z][A-Z]+)\}/g)];
  const latexWords = matches.map(m => m[1].toLowerCase());
  console.log(`LaTeX source contains ${latexWords.length} words.`);

  // Map each to its DB unit
  const map = new Map(); // unitOrder -> count
  const found = [];
  const missing = [];

  for (const w of latexWords) {
    const res = await client.execute({
      sql: `SELECT u."order" AS unit_order, w.word, w.example_sentence
            FROM vocab_words w JOIN vocab_units u ON w.unit_id = u.id
            WHERE LOWER(w.word) = ? LIMIT 1`,
      args: [w],
    });
    if (res.rows.length === 0) {
      missing.push(w);
      continue;
    }
    const r = res.rows[0];
    const u = Number(r.unit_order);
    map.set(u, (map.get(u) || 0) + 1);
    found.push({ word: r.word, unit: u, hasLatexArtifact: /\\textbf|\\textit|\{[a-zA-Z]+$/.test(r.example_sentence || '') });
  }

  console.log(`\n── LaTeX words mapped to DB units ──`);
  for (const [u, c] of [...map.entries()].sort((a,b)=>a[0]-b[0])) {
    console.log(`  DB Unit ${u}: ${c} words`);
  }
  console.log(`\nLaTeX words NOT found in DB: ${missing.length}`);
  if (missing.length) console.log(`  ${missing.join(', ')}`);

  // Any LaTeX-source words currently broken in the DB?
  const brokenInDb = found.filter(f => f.hasLatexArtifact);
  console.log(`\nLaTeX-source words that are BROKEN in DB: ${brokenInDb.length}`);
  for (const f of brokenInDb) {
    console.log(`  DB Unit ${f.unit} · ${f.word}`);
  }

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
