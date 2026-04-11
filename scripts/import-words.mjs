/**
 * import-words.mjs
 * Parses wordsmart_unit01.tex and inserts all vocab data into Turso.
 * Run: node scripts/import-words.mjs
 */

import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const client = createClient({
  url:       'libsql://vh-beyond-the-horizon-ahnafahad.aws-ap-south-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzUxNDUzODYsImlkIjoiMDE5ZDRjZGQtZmMwMS03Njc2LTkwODItNjUxYjlhMWUzMTVhIiwicmlkIjoiMjAxZGQ5ZDktYTEwYi00ZTA4LTg3ODgtMWMyMmRmZmMyODgxIn0.vw7b-JVuzAts5PP4rzgMwhKV-XRVLkXl_Lxfta5YUgtbUORsiHqFU6Tkb0Ll_D4L4tKeAM-lxF5e-OT_McZ_Aw',
});

// ─── LaTeX text cleaner ────────────────────────────────────────────────────────

function cleanLatex(s) {
  return s
    .replace(/\\textit\{([^}]*)\}/g, '$1')
    .replace(/\\textbf\{([^}]*)\}/g, '$1')
    .replace(/\\emph\{([^}]*)\}/g, '$1')
    .replace(/\\textnormal\{([^}]*)\}/g, '$1')
    .replace(/\\&/g, '&')
    .replace(/---/g, '—')
    .replace(/--/g, '–')
    .replace(/``/g, '\u201C')
    .replace(/''/g, '\u201D')
    .replace(/`/g, '\u2018')
    .replace(/'/g, '\u2019')
    .replace(/\\ldots/g, '…')
    .replace(/~/, ' ')
    .trim();
}

// ─── Extract balanced braces content ──────────────────────────────────────────

function extractBraces(s, start) {
  let depth = 0, i = start, result = '';
  while (i < s.length) {
    if (s[i] === '{') { depth++; if (depth === 1) { i++; continue; } }
    if (s[i] === '}') { depth--; if (depth === 0) return result; }
    if (depth > 0) result += s[i];
    i++;
  }
  return result;
}

// ─── Parse a single word block ─────────────────────────────────────────────────

function parseWordBlock(block, word, pos) {
  const definitions = [];
  const examples    = [];

  // Single \definition{...}
  const singleDef = block.match(/\\definition\{/);
  if (singleDef) {
    const idx = block.indexOf('\\definition{');
    definitions.push(cleanLatex(extractBraces(block, idx + '\\definition'.length)));
  }

  // Numbered \definitionnumbered{n}{text}
  let match;
  const defRe = /\\definitionnumbered\{(\d+)\}\{/g;
  while ((match = defRe.exec(block)) !== null) {
    const openBrace = block.indexOf('{', match.index + match[0].length - 1);
    definitions.push(cleanLatex(extractBraces(block, openBrace)));
  }

  // Single \examplesentence{...}
  const singleEx = block.indexOf('\\examplesentence{');
  if (singleEx !== -1) {
    examples.push(cleanLatex(extractBraces(block, singleEx + '\\examplesentence'.length)));
  }

  // Numbered \examplenumbered{n}{text}
  const exRe = /\\examplenumbered\{(\d+)\}\{/g;
  while ((match = exRe.exec(block)) !== null) {
    const openBrace = block.indexOf('{', match.index + match[0].length - 1);
    examples.push(cleanLatex(extractBraces(block, openBrace)));
  }

  // \synantline{synonyms}{antonym}
  let synonyms = [], antonyms = [];
  const synLine = block.indexOf('\\synantline{');
  if (synLine !== -1) {
    const synRaw = cleanLatex(extractBraces(block, synLine + '\\synantline'.length));
    synonyms = synRaw.split(',').map(s => s.trim()).filter(Boolean);
    const afterSyn = block.indexOf('}', synLine + '\\synantline'.length + 1) + 1;
    const antIdx   = block.indexOf('{', afterSyn);
    if (antIdx !== -1) {
      const antRaw = cleanLatex(extractBraces(block, antIdx));
      antonyms = antRaw.split(',').map(s => s.trim()).filter(Boolean);
    }
  }

  // \synantlinemulti{text}
  const multiLine = block.indexOf('\\synantlinemulti{');
  if (multiLine !== -1) {
    const raw = cleanLatex(extractBraces(block, multiLine + '\\synantlinemulti'.length));
    // Try to split on | if present
    if (raw.includes('|')) {
      const parts = raw.split('|').map(s => s.trim());
      synonyms = parts[0]?.replace(/^Synonyms[^:]*:\s*/i, '').split(',').map(s => s.trim()).filter(Boolean) ?? [];
      antonyms = parts[1]?.replace(/^Antonyms?[^:]*:\s*/i, '').split(',').map(s => s.trim()).filter(Boolean) ?? [];
    } else {
      synonyms = [raw];
    }
  }

  const definition    = definitions.join(' / ') || '(see entry)';
  const exampleSentence = examples[0] || '';

  return { word, pos, definition, exampleSentence, synonyms, antonyms };
}

// ─── Parse the full .tex file ──────────────────────────────────────────────────

function parseTex(tex) {
  const units = [];

  // Split on \section* markers
  const unitChunks = tex.split(/\\section\*\{/);

  for (const chunk of unitChunks.slice(1)) {
    // Extract unit title — use balanced-brace extraction (handles nested \textnormal{})
    const rawTitle  = extractBraces('{' + chunk, 0); // wrap to reuse helper
    const unitNum   = parseInt((rawTitle.match(/Unit\s+(\d+)/i) || [])[1] ?? '0');
    // Strip "Unit N \textnormal{---} " prefix then clean remaining LaTeX
    const unitTitle = cleanLatex(
      rawTitle
        .replace(/Unit\s+\d+\s*/i, '')
        .replace(/\\textnormal\{[^}]*\}\s*/g, '')
        .replace(/^[—–\-]+\s*/, '')
        .trim()
    );

    const words = [];

    // Split on \wordentry
    const wordChunks = chunk.split(/\\wordentry\{/);
    for (const wc of wordChunks.slice(1)) {
      const wordEnd = wc.indexOf('}');
      const word    = wc.slice(0, wordEnd).trim();

      const posStart = wc.indexOf('{', wordEnd + 1);
      const pos      = cleanLatex(extractBraces(wc, posStart));

      // Word block = everything after the \wordentry{...}{...} header up to next \wordentry or \section
      const blockStart = wc.indexOf('\n', posStart) + 1;
      const blockEnd   = wc.length;
      const block      = wc.slice(blockStart, blockEnd);

      const parsed = parseWordBlock(block, word, pos);
      words.push(parsed);
    }

    units.push({ unitNum, unitTitle, words });
  }

  return units;
}

// ─── Main import ──────────────────────────────────────────────────────────────

async function main() {
  const texPath = resolve(__dirname, '..', 'vocab game', 'wordsmart_unit01.tex');
  const tex     = readFileSync(texPath, 'utf8');
  const units   = parseTex(tex);

  console.log(`Parsed ${units.length} units, ${units.reduce((s, u) => s + u.words.length, 0)} words total\n`);

  // Clear existing data
  await client.execute('DELETE FROM vocab_words');
  await client.execute('DELETE FROM vocab_themes');
  await client.execute('DELETE FROM vocab_units');
  console.log('Cleared existing vocab data');

  for (const unit of units) {
    // Insert unit
    const unitRes = await client.execute({
      sql:  `INSERT INTO vocab_units (name, description, "order") VALUES (?, ?, ?) RETURNING id`,
      args: [
        `Unit ${unit.unitNum} — ${unit.unitTitle}`,
        unit.unitTitle,
        unit.unitNum,
      ],
    });
    const unitId = unitRes.rows[0].id;

    // Insert theme (one per unit — the flashcard deck)
    const themeRes = await client.execute({
      sql:  `INSERT INTO vocab_themes (unit_id, name, "order") VALUES (?, ?, ?) RETURNING id`,
      args: [unitId, unit.unitTitle, unit.unitNum],
    });
    const themeId = themeRes.rows[0].id;

    console.log(`Unit ${unit.unitNum}: "${unit.unitTitle}" → unitId=${unitId}, themeId=${themeId}`);

    // Insert words
    for (const w of unit.words) {
      await client.execute({
        sql: `INSERT INTO vocab_words
              (theme_id, unit_id, word, definition, synonyms, antonyms, example_sentence, part_of_speech, difficulty_base)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          themeId,
          unitId,
          w.word,
          w.definition,
          JSON.stringify(w.synonyms),
          JSON.stringify(w.antonyms),
          w.exampleSentence,
          w.pos,
          3,
        ],
      });
      console.log(`  + ${w.word} (${w.pos})`);
    }
  }

  console.log('\n✓ Import complete');
  client.close();
}

main().catch(e => { console.error(e); process.exit(1); });
