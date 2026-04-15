'use strict';
const { createClient } = require('@libsql/client');
const fs   = require('fs');

const client = createClient({
  url:       process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

function cleanLatex(s) {
  return s
    .replace(/\\textit\{([^}]*)\}/g, '$1')
    .replace(/\\textbf\{([^}]*)\}/g, '$1')
    .replace(/\\emph\{([^}]*)\}/g,   '$1')
    .replace(/---/g, '—').replace(/--/g, '–')
    .replace(/\s+/g, ' ').trim();
}

function extractBraces(s, start) {
  let depth = 0, i = start, r = '';
  while (i < s.length) {
    if (s[i] === '{') { depth++; if (depth === 1) { i++; continue; } }
    if (s[i] === '}') { depth--; if (depth === 0) return r; }
    if (depth > 0) r += s[i];
    i++;
  }
  return r;
}

async function main() {
  const content = fs.readFileSync('D:/Downloads/wordsmart_unit01.tex', 'utf8');

  // Extract Unit 1 section
  const u1start = content.indexOf('\\section*{Unit 1');
  const u1end   = content.indexOf('\\section*{Unit 2');
  const chunk   = content.slice(u1start, u1end);

  // Parse all wordentries
  const words = {};
  let i = 0;
  while (i < chunk.length) {
    const we = chunk.indexOf('\\wordentry{', i);
    if (we === -1) break;

    const wName  = extractBraces(chunk, we + 10);
    const posIdx = chunk.indexOf('{', we + 10 + wName.length + 1);
    const rawPos = extractBraces(chunk, posIdx);
    const pos    = rawPos.split('/')[0].trim().toLowerCase();

    const nextWe = chunk.indexOf('\\wordentry{', we + 1);
    const block  = chunk.slice(we, nextWe === -1 ? chunk.length : nextWe);

    let def = '';
    const dm = block.match(/\\definition\{([\s\S]*?)\}/);
    if (dm) { def = cleanLatex(dm[1]); }
    else {
      const d2 = block.match(/\\definitionnumbered\{1\}\{([\s\S]*?)\}/);
      if (d2) def = cleanLatex(d2[1]);
    }

    let ex = '';
    const em = block.match(/\\examplesentence\{([\s\S]*?)\}/);
    if (em) { ex = cleanLatex(em[1]); }
    else {
      const e2 = block.match(/\\examplenumbered\{1\}\{([\s\S]*?)\}/);
      if (e2) ex = cleanLatex(e2[1]);
    }

    const sm   = block.match(/\\synantline\{([^}]*)\}\{([^}]*)\}/);
    const syns = sm ? sm[1].split(',').map(s => s.trim()).filter(s => s && s.toLowerCase() !== 'none') : [];
    const ants = sm ? sm[2].split(',').map(s => s.trim()).filter(s => s && s.toLowerCase() !== 'none') : [];

    const key = wName.toLowerCase();
    words[key] = { word: wName.charAt(0).toUpperCase() + wName.slice(1).toLowerCase(), def, ex, pos, syns, ants };
    i = we + 1;
  }

  console.log('Parsed', Object.keys(words).length, 'words from Unit 1');

  for (const [key, d] of Object.entries(words)) {
    const r = await client.execute({
      sql:  'SELECT id FROM vocab_words WHERE LOWER(word) = ? AND (definition LIKE ? OR definition LIKE ?)',
      args: [key, 'Definition for%', 'Definition pending%'],
    });
    if (r.rows.length === 0) {
      console.log('  skip', d.word, '(already correct or not found)');
      continue;
    }
    const id = Number(r.rows[0].id ?? r.rows[0][0]);
    await client.execute({
      sql:  'UPDATE vocab_words SET definition=?, example_sentence=?, part_of_speech=?, synonyms=?, antonyms=? WHERE id=?',
      args: [d.def, d.ex, d.pos, JSON.stringify(d.syns), JSON.stringify(d.ants), id],
    });
    console.log('  updated:', d.word);
  }

  client.close();
  console.log('Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
