/**
 * Read-only: preview 20 random "before / after" pairs from the recovery
 * pipeline without touching the DB. Use to sanity-check LaTeX stripping.
 *
 * Run: node --env-file=.env.local scripts/preview-tex-recovery.js
 */

'use strict';

const { createClient } = require('@libsql/client');
const fs   = require('fs');
const path = require('path');

const TEX_DIR = 'D:\\Downloads\\Task Manager';

function readBraceArg(s, idx) {
  if (s[idx] !== '{') return null;
  let depth = 0;
  for (let i = idx; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}') { depth--; if (depth === 0) return { content: s.slice(idx + 1, i), end: i + 1 }; }
  }
  return null;
}

function stripLatex(raw) {
  let s = raw;
  const keepCmds = ['textbf', 'textit', 'emph', 'underline', 'textsc'];
  let changed = true;
  while (changed) {
    changed = false;
    for (const cmd of keepCmds) {
      const re = new RegExp(`\\\\${cmd}\\{([^{}]*)\\}`, 'g');
      const next = s.replace(re, (_m, inner) => inner);
      if (next !== s) { s = next; changed = true; }
    }
  }
  s = s.replace(/\\&/g,'&').replace(/\\%/g,'%').replace(/\\\$/g,'$').replace(/\\#/g,'#').replace(/\\_/g,'_');
  s = s.replace(/---/g,'\u2014').replace(/--/g,'\u2013')
       .replace(/``/g,'\u201C').replace(/''/g,'\u201D')
       .replace(/`/g,'\u2018').replace(/'/g,'\u2019');
  return s.replace(/\s+/g, ' ').trim();
}

function parseTex(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const byWord = new Map();
  const chunks = text.split(/\\wordentry\{/);
  for (let i = 1; i < chunks.length; i++) {
    const chunk = chunks[i];
    const closeWord = chunk.indexOf('}');
    if (closeWord === -1) continue;
    const word = chunk.slice(0, closeWord).trim().toLowerCase();
    let body = chunk.slice(closeWord + 1);
    const stopIdx = body.search(/\\entryrule\b|\\section\*|\\newpage/);
    if (stopIdx !== -1) body = body.slice(0, stopIdx);

    let example = null;
    let mEx = body.match(/\\examplesentence\s*\{/);
    if (mEx) { const a = readBraceArg(body, mEx.index + mEx[0].length - 1); if (a) example = stripLatex(a.content); }
    if (!example) {
      for (const n of ['1','2','3']) {
        const re = new RegExp(`\\\\examplenumbered\\{${n}\\}\\s*\\{`);
        const m  = body.match(re);
        if (m) { const a = readBraceArg(body, m.index + m[0].length - 1); if (a) { example = stripLatex(a.content); break; } }
      }
    }
    if (example && !byWord.has(word)) byWord.set(word, { example, sourceFile: path.basename(filePath) });
  }
  return byWord;
}

async function main() {
  const files = fs.readdirSync(TEX_DIR).filter(f => /^unit_\d+_.*\.tex$/.test(f));
  const corpus = new Map();
  for (const f of files) {
    const entries = parseTex(path.join(TEX_DIR, f));
    for (const [w, d] of entries) if (!corpus.has(w)) corpus.set(w, d);
  }

  const client = createClient({
    url:       process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const res = await client.execute(`
    SELECT u."order" AS unit_order, w.id, w.word, w.example_sentence
    FROM vocab_words w
    JOIN vocab_units u ON w.unit_id = u.id
    WHERE w.example_sentence LIKE '%\\textbf%' ESCAPE '\\'
       OR w.example_sentence LIKE '%\\textit%' ESCAPE '\\'
    ORDER BY RANDOM() LIMIT 12
  `);

  for (const r of res.rows) {
    const src = corpus.get(String(r.word).toLowerCase());
    console.log(`\nUnit ${r.unit_order} · "${r.word}" (id=${r.id})`);
    console.log(`  BEFORE: ${JSON.stringify(r.example_sentence)}`);
    console.log(`  AFTER : ${JSON.stringify(src ? src.example : null)}`);
    if (src) console.log(`  (from ${src.sourceFile})`);
  }

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
