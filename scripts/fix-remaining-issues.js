/**
 * Apply remaining fixes on top of the LaTeX-recovery pass:
 *   A. Patch the two rows with raw LaTeX escapes (Cliché, Fatalist).
 *   B. Recover empty synonyms/antonyms for units 10-26 from \synantline in source.
 *
 * Run:  node --env-file=.env.local scripts/fix-remaining-issues.js --dry-run
 *       node --env-file=.env.local scripts/fix-remaining-issues.js
 */

'use strict';

const { createClient } = require('@libsql/client');
const fs   = require('fs');
const path = require('path');

const TEX_DIR = 'D:\\Downloads\\Task Manager';
const DRY_RUN = process.argv.includes('--dry-run');

// ------------------------------------------------------------------
// Shared helpers
// ------------------------------------------------------------------

function readBraceArg(s, idx) {
  if (s[idx] !== '{') return null;
  let depth = 0;
  for (let i = idx; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}') { depth--; if (depth === 0) return { content: s.slice(idx + 1, i), end: i + 1 }; }
  }
  return null;
}

/** Collapse LaTeX accent commands like \'e, \"u, \^a, \~n, \`e into their unicode form. */
function applyAccents(s) {
  const ACCENT = {
    "'": { a:'á', e:'é', i:'í', o:'ó', u:'ú', y:'ý', A:'Á', E:'É', I:'Í', O:'Ó', U:'Ú', Y:'Ý', c:'ć', C:'Ć', n:'ń', N:'Ń' },
    '`': { a:'à', e:'è', i:'ì', o:'ò', u:'ù', A:'À', E:'È', I:'Ì', O:'Ò', U:'Ù' },
    '^': { a:'â', e:'ê', i:'î', o:'ô', u:'û', A:'Â', E:'Ê', I:'Î', O:'Ô', U:'Û' },
    '"': { a:'ä', e:'ë', i:'ï', o:'ö', u:'ü', A:'Ä', E:'Ë', I:'Ï', O:'Ö', U:'Ü', y:'ÿ' },
    '~': { a:'ã', n:'ñ', o:'õ', A:'Ã', N:'Ñ', O:'Õ' },
    '=': { a:'ā', e:'ē', i:'ī', o:'ō', u:'ū' },
    '.': { a:'ȧ', e:'ė', o:'ȯ' },
  };
  // Forms: \'e   \'{e}   {\'e}   {\'{e}}
  // Use multiple regexes; strip any wrapping braces.
  let out = s;

  // \'{X}  and  \"{X}  etc.
  out = out.replace(/\\([\'`^"~=.])\{([A-Za-z])\}/g, (_m, acc, ch) => (ACCENT[acc] && ACCENT[acc][ch]) || ch);
  // \'X  (unbraced)
  out = out.replace(/\\([\'`^"~=.])([A-Za-z])/g,     (_m, acc, ch) => (ACCENT[acc] && ACCENT[acc][ch]) || ch);

  // Curly quotes that were already in source (keep them).
  return out;
}

function stripLatex(raw) {
  let s = raw;

  // Accents first.
  s = applyAccents(s);

  // Keep-content commands.
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

  // Line breaks: literal "\\" (two backslashes) OR lone "\" before whitespace/EOL.
  s = s.replace(/\\\\/g, ' ').replace(/\\(?=\s|$)/g, '');

  // Escaped punctuation.
  s = s.replace(/\\&/g,'&').replace(/\\%/g,'%').replace(/\\\$/g,'$').replace(/\\#/g,'#').replace(/\\_/g,'_');

  // Dashes / quotes.
  s = s.replace(/---/g,'\u2014').replace(/--/g,'\u2013')
       .replace(/``/g,'\u201C').replace(/''/g,'\u201D');

  return s.replace(/\s+/g, ' ').trim();
}

// ------------------------------------------------------------------
// Parse all tex files into { word: { example, definition, syns[], ants[] } }
// ------------------------------------------------------------------

function parseTex(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const byWord = new Map();
  const chunks = text.split(/\\wordentry\{/);
  for (let i = 1; i < chunks.length; i++) {
    const chunk = chunks[i];
    const closeWord = chunk.indexOf('}');
    if (closeWord === -1) continue;
    // Word may itself contain \'e etc; normalise for lookup.
    const rawWord = chunk.slice(0, closeWord).trim();
    const word    = applyAccents(rawWord).toLowerCase();

    let body = chunk.slice(closeWord + 1);
    const stopIdx = body.search(/\\entryrule\b|\\section\*|\\newpage/);
    if (stopIdx !== -1) body = body.slice(0, stopIdx);

    // Example
    let example = null;
    const mEx = body.match(/\\examplesentence\s*\{/);
    if (mEx) { const a = readBraceArg(body, mEx.index + mEx[0].length - 1); if (a) example = stripLatex(a.content); }
    if (!example) {
      for (const n of ['1','2','3']) {
        const re = new RegExp(`\\\\examplenumbered\\{${n}\\}\\s*\\{`);
        const m  = body.match(re);
        if (m) { const a = readBraceArg(body, m.index + m[0].length - 1); if (a) { example = stripLatex(a.content); break; } }
      }
    }

    // Definition
    let definition = null;
    const mDef = body.match(/\\definition\s*\{/);
    if (mDef) { const a = readBraceArg(body, mDef.index + mDef[0].length - 1); if (a) definition = stripLatex(a.content); }
    if (!definition) {
      for (const n of ['1','2','3']) {
        const re = new RegExp(`\\\\definitionnumbered\\{${n}\\}\\s*\\{`);
        const m  = body.match(re);
        if (m) { const a = readBraceArg(body, m.index + m[0].length - 1); if (a) { definition = stripLatex(a.content); break; } }
      }
    }

    // Synonyms / antonyms. Three source forms exist:
    //   \synantline{syn1, syn2}{ant1, ant2}            — simple two-arg
    //   \synantlinemulti{syn1, syn2}{ant1, ant2}       — two-arg multi-POS
    //   \synantlinemulti{freeform text with | or Antonym: separator}  — one-arg freeform
    let syns = [], ants = [];
    const splitTerms = s => {
      const out = stripLatex(s)
        // Strip POS / sense labels in parentheses: (adj.), (noun 1), (sense 2), (v.), etc.
        .replace(/\(\s*(?:adj|adv|verb|noun|n|v|sense)\.?\s*\d*\s*\)/gi, '')
        .replace(/\\quad\\quad|\\quad/g, ' ')
        .replace(/\b(?:Antonym|Synonym)s?\s*:?/gi, '')
        .split(/[,;/|]/)
        .map(x => x.trim().toLowerCase())
        .filter(x => x && !/^(?:—|-|–|none)$/i.test(x));
      // Dedupe while preserving order.
      const seen = new Set();
      return out.filter(x => { if (seen.has(x)) return false; seen.add(x); return true; });
    };

    const synCmd = body.match(/\\synantlinemulti\s*\{|\\synantline\s*\{/);
    if (synCmd) {
      const a1 = readBraceArg(body, synCmd.index + synCmd[0].length - 1);
      if (a1) {
        // Is there a second {...} immediately after?
        let j = a1.end;
        while (j < body.length && /\s/.test(body[j])) j++;
        const a2 = (body[j] === '{') ? readBraceArg(body, j) : null;

        if (a2) {
          // Two-arg form.
          syns = splitTerms(a1.content);
          ants = splitTerms(a2.content);
        } else {
          // One-arg freeform: split on '|' (primary) or 'Antonym:' keyword.
          const content = a1.content;
          let synPart, antPart;
          if (/\|/.test(content)) {
            [synPart, antPart] = content.split('|', 2);
          } else {
            const m = content.match(/(.*?)\b(?:Antonyms?|Opposites?)\s*:?\s*(.*)/is);
            if (m) { synPart = m[1]; antPart = m[2]; }
            else   { synPart = content; antPart = ''; }
          }
          syns = splitTerms(synPart || '');
          ants = splitTerms(antPart || '');
        }
      }
    }

    if (!byWord.has(word)) byWord.set(word, { example, definition, syns, ants });
  }
  return byWord;
}

// ------------------------------------------------------------------
// Main
// ------------------------------------------------------------------

async function main() {
  const files  = fs.readdirSync(TEX_DIR).filter(f => /^unit_\d+_.*\.tex$/.test(f));
  const corpus = new Map();
  for (const f of files) {
    const entries = parseTex(path.join(TEX_DIR, f));
    for (const [w, d] of entries) if (!corpus.has(w)) corpus.set(w, d);
  }
  console.log(`Parsed ${corpus.size} unique word entries from ${files.length} LaTeX files.\n`);

  const client = createClient({
    url:       process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  // -----------------------------------------------------------------
  // A. Patch the two rows with raw LaTeX escapes.
  // -----------------------------------------------------------------
  console.log('── Batch A: raw LaTeX escapes ──');
  const rawRows = (await client.execute(`
    SELECT w.id, w.word, w.example_sentence, w.definition
    FROM vocab_words w
    WHERE w.word             GLOB '*\\*'
       OR w.definition       GLOB '*\\*'
       OR w.example_sentence GLOB '*\\*'
  `)).rows;

  let aCount = 0;
  for (const r of rawRows) {
    const updates = [];
    const args    = [];

    const newWord = r.word && /\\/.test(r.word) ? stripLatex(r.word) : null;
    const newEx   = r.example_sentence && /\\/.test(r.example_sentence) ? stripLatex(r.example_sentence) : null;
    const newDef  = r.definition && /\\/.test(r.definition) ? stripLatex(r.definition) : null;

    if (newWord && newWord !== r.word) {
      updates.push('word = ?'); args.push(newWord);
    }
    if (newEx && newEx !== r.example_sentence) {
      updates.push('example_sentence = ?'); args.push(newEx);
    }
    if (newDef && newDef !== r.definition) {
      updates.push('definition = ?'); args.push(newDef);
    }

    if (updates.length === 0) continue;

    console.log(`  id=${r.id}: ${updates.map(u => u.split(' = ')[0]).join(', ')}`);
    for (const u of updates) {
      const field = u.split(' = ')[0];
      if (field === 'word') console.log(`    word: ${JSON.stringify(r.word)} → ${JSON.stringify(newWord)}`);
      if (field === 'example_sentence') console.log(`    ex:   ${JSON.stringify(r.example_sentence)} → ${JSON.stringify(newEx)}`);
      if (field === 'definition') console.log(`    def:  ${JSON.stringify(r.definition)} → ${JSON.stringify(newDef)}`);
    }

    if (!DRY_RUN) {
      args.push(r.id);
      await client.execute({ sql: `UPDATE vocab_words SET ${updates.join(', ')} WHERE id = ?`, args });
    }
    aCount++;
  }
  console.log(`  → ${aCount} row(s) patched.\n`);

  // -----------------------------------------------------------------
  // B. Fill in empty synonyms / antonyms from \synantline source.
  // -----------------------------------------------------------------
  console.log('── Batch B: empty synonyms / antonyms ──');
  const emptyRows = (await client.execute(`
    SELECT u."order" AS unit_order, w.id, w.word, w.synonyms, w.antonyms
    FROM vocab_words w JOIN vocab_units u ON w.unit_id = u.id
    WHERE w.synonyms IN ('[]','') OR w.antonyms IN ('[]','')
  `)).rows;

  let synFilled = 0, antFilled = 0, unmatched = 0;
  const stillEmpty = [];

  for (const r of emptyRows) {
    const key = String(r.word).toLowerCase();
    const src = corpus.get(key);
    const synsEmpty = r.synonyms === '[]' || r.synonyms === '';
    const antsEmpty = r.antonyms === '[]' || r.antonyms === '';

    if (!src) {
      unmatched++;
      stillEmpty.push({ unit: r.unit_order, id: r.id, word: r.word, synsEmpty, antsEmpty, reason: 'no source' });
      continue;
    }

    const updates = [];
    const args    = [];

    if (synsEmpty && src.syns.length > 0) {
      updates.push('synonyms = ?'); args.push(JSON.stringify(src.syns)); synFilled++;
    }
    if (antsEmpty && src.ants.length > 0) {
      updates.push('antonyms = ?'); args.push(JSON.stringify(src.ants)); antFilled++;
    }

    if (updates.length === 0) {
      stillEmpty.push({ unit: r.unit_order, id: r.id, word: r.word,
                        synsEmpty, antsEmpty,
                        reason: 'source has no syn/ant either' });
      continue;
    }

    if (!DRY_RUN) {
      args.push(r.id);
      await client.execute({ sql: `UPDATE vocab_words SET ${updates.join(', ')} WHERE id = ?`, args });
    }
  }

  console.log(`  synonyms filled: ${synFilled}`);
  console.log(`  antonyms filled: ${antFilled}`);
  console.log(`  rows still empty: ${stillEmpty.length}\n`);

  if (stillEmpty.length) {
    console.log('── Rows that remain empty (unit not in LaTeX source, or source has no syn/ant) ──');
    // Group by reason.
    const byReason = new Map();
    for (const s of stillEmpty) {
      const arr = byReason.get(s.reason) || [];
      arr.push(s);
      byReason.set(s.reason, arr);
    }
    for (const [reason, arr] of byReason) {
      console.log(`\n  "${reason}" (${arr.length} rows):`);
      for (const s of arr.slice(0, 100)) {
        const tag = [s.synsEmpty ? 'syn' : '', s.antsEmpty ? 'ant' : ''].filter(Boolean).join('+');
        console.log(`    unit ${String(s.unit).padStart(2)} · id=${s.id} · "${s.word}"  [${tag}]`);
      }
      if (arr.length > 100) console.log(`    …and ${arr.length - 100} more`);
    }
  }

  if (DRY_RUN) console.log(`\n[DRY RUN] no DB rows were modified.`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
