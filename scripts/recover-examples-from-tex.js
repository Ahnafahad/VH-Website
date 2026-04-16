/**
 * Recover truncated example_sentence (and definition) rows in vocab_words
 * by reading the original LaTeX source files in D:\Downloads\Task Manager\.
 *
 * The DB-ingest pipeline previously mishandled LaTeX formatting commands
 * like \textbf{...} and left 257 example_sentence rows truncated mid-word.
 * The .tex files have the full, untruncated text.
 *
 * Run:  node --env-file=.env.local scripts/recover-examples-from-tex.js
 *       node --env-file=.env.local scripts/recover-examples-from-tex.js --dry-run
 */

'use strict';

const { createClient } = require('@libsql/client');
const fs   = require('fs');
const path = require('path');

const TEX_DIR  = 'D:\\Downloads\\Task Manager';
const DRY_RUN  = process.argv.includes('--dry-run');

// ------------------------------------------------------------------
// LaTeX helpers
// ------------------------------------------------------------------

/**
 * Extract the balanced-brace argument that starts at `idx` in `s`,
 * where `s[idx]` must be `{`. Returns `{ content, end }` where `end`
 * is the index just past the closing `}`. Returns null on mismatch.
 */
function readBraceArg(s, idx) {
  if (s[idx] !== '{') return null;
  let depth = 0;
  for (let i = idx; i < s.length; i++) {
    const c = s[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) {
        return { content: s.slice(idx + 1, i), end: i + 1 };
      }
    }
  }
  return null;
}

/**
 * Strip LaTeX formatting out of a plain-text example / definition string.
 * Keep the *content* inside \textbf{}, \textit{}, \emph{}, \underline{}.
 * Replace --- with an em dash, -- with an en dash.
 */
function stripLatex(raw) {
  let s = raw;

  // Keep-content commands (can nest) — repeat until no match.
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

  // Escaped punctuation.
  s = s.replace(/\\&/g,  '&')
       .replace(/\\%/g,  '%')
       .replace(/\\\$/g, '$')
       .replace(/\\#/g,  '#')
       .replace(/\\_/g,  '_')
       .replace(/\\textdollar\s*/g, '$');

  // Dashes and quotes.
  s = s.replace(/---/g, '\u2014')   // em dash
       .replace(/--/g,  '\u2013')   // en dash
       .replace(/``/g,  '\u201C')   // opening double quote
       .replace(/''/g,  '\u201D')   // closing double quote
       .replace(/`/g,   '\u2018')   // opening single quote
       .replace(/'/g,   '\u2019');  // closing single quote (also plain apostrophe)

  // Collapse whitespace.
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

/**
 * Parse a single .tex file into a map of word -> { definition, example }.
 * Prefers \examplesentence over \examplenumbered{1}; falls back to {2}.
 * Same for \definition vs \definitionnumbered.
 */
function parseTex(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const byWord = new Map();

  // Split on \wordentry — each chunk after the first is one entry.
  const chunks = text.split(/\\wordentry\{/);
  for (let i = 1; i < chunks.length; i++) {
    const chunk = chunks[i];

    // Word is everything up to the next `}`.
    const closeWord = chunk.indexOf('}');
    if (closeWord === -1) continue;
    const rawWord = chunk.slice(0, closeWord).trim();
    const word    = rawWord.toLowerCase();

    // Terminate this entry at the next \entryrule or \wordentry{ (already split)
    let body = chunk.slice(closeWord + 1);
    const stopIdx = body.search(/\\entryrule\b|\\section\*|\\newpage/);
    if (stopIdx !== -1) body = body.slice(0, stopIdx);

    // Find \examplesentence{...} first.
    let example = null;
    let mEx = body.match(/\\examplesentence\s*\{/);
    if (mEx) {
      const arg = readBraceArg(body, mEx.index + mEx[0].length - 1);
      if (arg) example = stripLatex(arg.content);
    }
    if (!example) {
      // Try \examplenumbered{1}{...} then {2}, etc.
      for (const n of ['1', '2', '3']) {
        const re = new RegExp(`\\\\examplenumbered\\{${n}\\}\\s*\\{`);
        const m  = body.match(re);
        if (m) {
          const arg = readBraceArg(body, m.index + m[0].length - 1);
          if (arg) { example = stripLatex(arg.content); break; }
        }
      }
    }

    // Same logic for definition.
    let definition = null;
    let mDef = body.match(/\\definition\s*\{/);
    if (mDef) {
      const arg = readBraceArg(body, mDef.index + mDef[0].length - 1);
      if (arg) definition = stripLatex(arg.content);
    }
    if (!definition) {
      for (const n of ['1', '2', '3']) {
        const re = new RegExp(`\\\\definitionnumbered\\{${n}\\}\\s*\\{`);
        const m  = body.match(re);
        if (m) {
          const arg = readBraceArg(body, m.index + m[0].length - 1);
          if (arg) { definition = stripLatex(arg.content); break; }
        }
      }
    }

    if (example || definition) {
      // If the same word appears in two different old-unit files, keep the
      // first occurrence — they represent the same dictionary entry.
      if (!byWord.has(word)) {
        byWord.set(word, { example, definition, sourceFile: path.basename(filePath) });
      }
    }
  }

  return byWord;
}

// ------------------------------------------------------------------
// Main
// ------------------------------------------------------------------

async function main() {
  // 1. Parse every tex file into a unified word -> {example, definition} map.
  const files = fs.readdirSync(TEX_DIR)
    .filter(f => /^unit_\d+_.*\.tex$/.test(f))
    .sort();

  console.log(`Parsing ${files.length} .tex files from ${TEX_DIR} …`);
  const corpus = new Map();
  for (const f of files) {
    const entries = parseTex(path.join(TEX_DIR, f));
    for (const [word, data] of entries) {
      if (!corpus.has(word)) corpus.set(word, data);
    }
  }
  console.log(`Parsed ${corpus.size} unique word entries from LaTeX source.\n`);

  // 2. Connect to Turso.
  const client = createClient({
    url:       process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  // 3. Pull every broken row (example_sentence OR definition with LaTeX artifacts).
  const broken = await client.execute(`
    SELECT u."order" AS unit_order, w.id, w.word, w.definition, w.example_sentence
    FROM vocab_words w
    JOIN vocab_units u ON w.unit_id = u.id
    WHERE w.example_sentence LIKE '%\\textbf%' ESCAPE '\\'
       OR w.example_sentence LIKE '%\\textit%' ESCAPE '\\'
       OR w.example_sentence LIKE '%\\emph%'   ESCAPE '\\'
       OR w.definition       LIKE '%\\textbf%' ESCAPE '\\'
       OR w.definition       LIKE '%\\textit%' ESCAPE '\\'
       OR w.definition       LIKE '%\\emph%'   ESCAPE '\\'
  `);
  console.log(`DB rows with LaTeX artifacts: ${broken.rows.length}\n`);

  // 4. Match and update.
  let exUpdated = 0, defUpdated = 0;
  const unmatched = [];
  const perUnit   = new Map();

  for (const r of broken.rows) {
    const key  = String(r.word).toLowerCase();
    const src  = corpus.get(key);
    const unit = Number(r.unit_order);

    const stats = perUnit.get(unit) || { broken: 0, recovered: 0 };
    stats.broken++;

    if (!src) {
      unmatched.push({ unit, id: r.id, word: r.word });
      perUnit.set(unit, stats);
      continue;
    }

    // Decide what to update.
    const exBroken  = /\\textbf|\\textit|\\emph/.test(r.example_sentence || '');
    const defBroken = /\\textbf|\\textit|\\emph/.test(r.definition       || '');

    const updates = [];
    const args    = [];
    if (exBroken && src.example) {
      updates.push(`example_sentence = ?`);
      args.push(src.example);
      exUpdated++;
    }
    if (defBroken && src.definition) {
      updates.push(`definition = ?`);
      args.push(src.definition);
      defUpdated++;
    }

    if (updates.length === 0) {
      unmatched.push({ unit, id: r.id, word: r.word, reason: 'no usable source field' });
      perUnit.set(unit, stats);
      continue;
    }

    if (!DRY_RUN) {
      args.push(r.id);
      await client.execute({
        sql:  `UPDATE vocab_words SET ${updates.join(', ')} WHERE id = ?`,
        args,
      });
    }

    stats.recovered++;
    perUnit.set(unit, stats);
  }

  // 5. Report.
  console.log(`── Recovery per unit ──`);
  for (const [u, s] of [...perUnit.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`  Unit ${String(u).padStart(2)}: ${s.recovered}/${s.broken} rows recovered`);
  }
  console.log(`\nTotals: ${exUpdated} example_sentence updates, ${defUpdated} definition updates.`);
  console.log(`Unmatched rows: ${unmatched.length}`);
  if (unmatched.length) {
    console.log(`\nFirst 20 unmatched:`);
    for (const u of unmatched.slice(0, 20)) {
      console.log(`  Unit ${u.unit} · id=${u.id} · "${u.word}"${u.reason ? ` (${u.reason})` : ''}`);
    }
  }

  if (DRY_RUN) {
    console.log(`\n[DRY RUN] no DB rows were modified.`);
  }

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
