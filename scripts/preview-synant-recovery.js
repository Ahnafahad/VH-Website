/**
 * Read-only preview: show resolved syn/ant arrays for the freeform multi-POS
 * words (the ones that used the risky one-arg \synantlinemulti heuristic).
 *
 * Run: node --env-file=.env.local scripts/preview-synant-recovery.js
 */

'use strict';

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

function applyAccents(s) {
  const ACCENT = { "'":{a:'á',e:'é',i:'í',o:'ó',u:'ú'}, '`':{a:'à',e:'è'}, '^':{a:'â',e:'ê'}, '"':{o:'ö',u:'ü'}, '~':{n:'ñ'} };
  return s.replace(/\\([\'`^"~])\{?([A-Za-z])\}?/g, (_m, a, c) => (ACCENT[a] && ACCENT[a][c]) || c);
}

function stripLatex(raw) {
  let s = applyAccents(raw);
  for (const cmd of ['textbf','textit','emph','underline']) {
    s = s.replace(new RegExp(`\\\\${cmd}\\{([^{}]*)\\}`, 'g'), '$1');
  }
  s = s.replace(/\\\\/g, ' ').replace(/\\(?=\s|$)/g, '');
  s = s.replace(/---/g, '—').replace(/--/g, '–').replace(/``/g,'“').replace(/''/g,'”');
  return s.replace(/\s+/g, ' ').trim();
}

const splitTerms = s => stripLatex(s)
  .replace(/\([a-z]+\)/gi, '')
  .replace(/\\quad\\quad|\\quad/g, ' ')
  .replace(/\b(?:Antonym|Synonym)s?\s*:?/gi, '')
  .split(/[,;/|]/).map(x => x.trim().toLowerCase())
  .filter(x => x && x !== '—' && x !== '-' && x !== '–');

// Collect every (word, source, syns, ants) where the source used the
// one-arg \synantlinemulti freeform form — the risky cases.
const samples = [];
for (const f of fs.readdirSync(TEX_DIR).filter(f => /^unit_\d+_.*\.tex$/.test(f))) {
  const text = fs.readFileSync(path.join(TEX_DIR, f), 'utf8');
  const chunks = text.split(/\\wordentry\{/);
  for (let i = 1; i < chunks.length; i++) {
    const chunk = chunks[i];
    const closeWord = chunk.indexOf('}');
    if (closeWord === -1) continue;
    const word = applyAccents(chunk.slice(0, closeWord).trim()).toLowerCase();
    let body = chunk.slice(closeWord + 1);
    const stopIdx = body.search(/\\entryrule\b|\\section\*|\\newpage/);
    if (stopIdx !== -1) body = body.slice(0, stopIdx);

    const m = body.match(/\\synantlinemulti\s*\{/);
    if (!m) continue;
    const a1 = readBraceArg(body, m.index + m[0].length - 1);
    if (!a1) continue;
    let j = a1.end; while (j < body.length && /\s/.test(body[j])) j++;
    const a2 = body[j] === '{' ? readBraceArg(body, j) : null;
    if (a2) continue; // skip two-arg form — only want freeform

    // Parse freeform.
    const content = a1.content;
    let synPart, antPart;
    if (/\|/.test(content)) [synPart, antPart] = content.split('|', 2);
    else {
      const mm = content.match(/(.*?)\b(?:Antonyms?|Opposites?)\s*:?\s*(.*)/is);
      if (mm) { synPart = mm[1]; antPart = mm[2]; }
      else    { synPart = content; antPart = ''; }
    }
    samples.push({
      word, file: path.basename(f), raw: content.trim(),
      syns: splitTerms(synPart || ''),
      ants: splitTerms(antPart || ''),
    });
  }
}

console.log(`Freeform \\synantlinemulti entries: ${samples.length}\n`);
for (const s of samples) {
  console.log(`"${s.word}"  (${s.file})`);
  console.log(`  raw : ${s.raw}`);
  console.log(`  syns: [${s.syns.join(', ')}]`);
  console.log(`  ants: [${s.ants.join(', ')}]`);
  console.log();
}
