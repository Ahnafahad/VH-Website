/**
 * Read-only comprehensive audit of vocab_words and related tables.
 * Surfaces every data-quality issue we can detect programmatically.
 *
 * Run: node --env-file=.env.local scripts/audit-vocab-db.js
 */

'use strict';

const { createClient } = require('@libsql/client');

const CHECKS = [
  // id -> { label, test(row) -> truthy if issue }
];

function add(label, test) { CHECKS.push({ label, test }); }

// -------- Word field --------
add('word: empty',                  r => !r.word || !r.word.trim());
add('word: has whitespace',         r => /\s/.test(r.word));
add('word: leading/trailing ws',    r => r.word !== r.word.trim());
add('word: not starts uppercase',   r => r.word && /^[a-z]/.test(r.word));
add('word: non-ascii chars',        r => r.word && /[^\x00-\x7F]/.test(r.word));
add('word: has digits',             r => /\d/.test(r.word));

// -------- Part of speech --------
const POS_ALLOWED = new Set([
  'noun', 'verb', 'adjective', 'adverb', 'preposition', 'conjunction',
  'interjection', 'pronoun', 'determiner', 'proper noun',
]);
add('pos: empty',                   r => !r.part_of_speech || !r.part_of_speech.trim());
add('pos: leading/trailing ws',     r => r.part_of_speech && r.part_of_speech !== r.part_of_speech.trim());
add('pos: not lowercase',           r => r.part_of_speech && r.part_of_speech !== r.part_of_speech.toLowerCase());
add('pos: unrecognized value',      r => r.part_of_speech && !POS_ALLOWED.has(r.part_of_speech.toLowerCase().trim()));

// -------- Definition --------
add('definition: empty',            r => !r.definition || !r.definition.trim());
add('definition: leading/trail ws', r => r.definition && r.definition !== r.definition.trim());
add('definition: double space',     r => r.definition && /\s{2,}/.test(r.definition));
add('definition: not cap first',    r => r.definition && r.definition[0] !== r.definition[0].toUpperCase());
add('definition: no ending punct',  r => r.definition && !/[.!?"')]$/.test(r.definition.trim()));
add('definition: latex artefact',   r => r.definition && /\\[a-zA-Z]{2,}/.test(r.definition));
add('definition: stray brace',      r => r.definition && /[{}]/.test(r.definition));
add('definition: html-like tag',    r => r.definition && /<[a-zA-Z\/][^>]*>/.test(r.definition));
add('definition: html entity',      r => r.definition && /&(amp|lt|gt|quot|#\d+);/.test(r.definition));
add('definition: very short (<15)', r => r.definition && r.definition.trim().length < 15);
add('definition: mojibake ?',       r => r.definition && /�/.test(r.definition));

// -------- Example sentence --------
add('example: empty',               r => !r.example_sentence || !r.example_sentence.trim());
add('example: leading/trail ws',    r => r.example_sentence && r.example_sentence !== r.example_sentence.trim());
add('example: double space',        r => r.example_sentence && /\s{2,}/.test(r.example_sentence));
add('example: not cap first',       r => r.example_sentence && r.example_sentence[0] !== r.example_sentence[0].toUpperCase());
add('example: no ending punct',     r => r.example_sentence && !/[.!?"')]$/.test(r.example_sentence.trim()));
add('example: latex artefact',      r => r.example_sentence && /\\[a-zA-Z]{2,}/.test(r.example_sentence));
add('example: stray brace',         r => r.example_sentence && /[{}]/.test(r.example_sentence));
add('example: html-like tag',       r => r.example_sentence && /<[a-zA-Z\/][^>]*>/.test(r.example_sentence));
add('example: html entity',         r => r.example_sentence && /&(amp|lt|gt|quot|#\d+);/.test(r.example_sentence));
add('example: very short (<20)',    r => r.example_sentence && r.example_sentence.trim().length < 20);
add('example: mojibake ?',          r => r.example_sentence && /�/.test(r.example_sentence));
add('example: missing word',        r => {
  if (!r.example_sentence || !r.word) return false;
  // Relaxed: also accept common inflections (plural / -ed / -ing / -s / -es / -ly)
  const stem = r.word.trim().toLowerCase().replace(/e?$/, '');
  const re   = new RegExp(`\\b${stem}[a-z]{0,4}\\b`, 'i');
  return !re.test(r.example_sentence);
});

// -------- Synonyms / antonyms --------
function parseArr(s) { try { return JSON.parse(s || '[]'); } catch { return null; } }

add('synonyms: invalid json',       r => parseArr(r.synonyms) === null);
add('synonyms: empty array',        r => { const a = parseArr(r.synonyms); return Array.isArray(a) && a.length === 0; });
add('synonyms: contains empty',     r => { const a = parseArr(r.synonyms); return Array.isArray(a) && a.some(x => !x || !String(x).trim()); });
add('synonyms: has whitespace pad', r => { const a = parseArr(r.synonyms); return Array.isArray(a) && a.some(x => typeof x === 'string' && x !== x.trim()); });
add('synonyms: not lowercase',      r => { const a = parseArr(r.synonyms); return Array.isArray(a) && a.some(x => typeof x === 'string' && x !== x.toLowerCase()); });
add('synonyms: latex leftover',     r => { const a = parseArr(r.synonyms); return Array.isArray(a) && a.some(x => typeof x === 'string' && /\\|[{}]/.test(x)); });
add('synonyms: duplicates',         r => { const a = parseArr(r.synonyms); if (!Array.isArray(a)) return false; const s = new Set(a.map(x => String(x).toLowerCase().trim())); return s.size !== a.length; });

add('antonyms: invalid json',       r => parseArr(r.antonyms) === null);
add('antonyms: empty array',        r => { const a = parseArr(r.antonyms); return Array.isArray(a) && a.length === 0; });
add('antonyms: contains empty',     r => { const a = parseArr(r.antonyms); return Array.isArray(a) && a.some(x => !x || !String(x).trim()); });
add('antonyms: has whitespace pad', r => { const a = parseArr(r.antonyms); return Array.isArray(a) && a.some(x => typeof x === 'string' && x !== x.trim()); });
add('antonyms: not lowercase',      r => { const a = parseArr(r.antonyms); return Array.isArray(a) && a.some(x => typeof x === 'string' && x !== x.toLowerCase()); });
add('antonyms: latex leftover',     r => { const a = parseArr(r.antonyms); return Array.isArray(a) && a.some(x => typeof x === 'string' && /\\|[{}]/.test(x)); });
add('antonyms: duplicates',         r => { const a = parseArr(r.antonyms); if (!Array.isArray(a)) return false; const s = new Set(a.map(x => String(x).toLowerCase().trim())); return s.size !== a.length; });

// -------- Cross-field consistency --------
add('word equals synonym',          r => { const a = parseArr(r.synonyms); return Array.isArray(a) && a.some(x => typeof x === 'string' && x.toLowerCase().trim() === r.word.toLowerCase().trim()); });
add('word equals antonym',          r => { const a = parseArr(r.antonyms); return Array.isArray(a) && a.some(x => typeof x === 'string' && x.toLowerCase().trim() === r.word.toLowerCase().trim()); });
add('syn overlaps antonyms',        r => {
  const s = parseArr(r.synonyms); const a = parseArr(r.antonyms);
  if (!Array.isArray(s) || !Array.isArray(a)) return false;
  const aset = new Set(a.map(x => String(x).toLowerCase().trim()));
  return s.some(x => aset.has(String(x).toLowerCase().trim()));
});

async function main() {
  const client = createClient({
    url:       process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  // 1. Schema summary.
  console.log('── Table row counts ──');
  const tables = [
    'vocab_units', 'vocab_themes', 'vocab_words',
    'vocab_user_progress', 'vocab_user_word_records',
    'vocab_confusion_pairs', 'vocab_flashcard_sessions',
    'vocab_quiz_sessions', 'vocab_quiz_answers',
    'vocab_user_badges', 'vocab_weekly_leaderboard',
    'vocab_hall_of_fame', 'vocab_admin_settings', 'vocab_access_requests',
  ];
  for (const t of tables) {
    try {
      const r = await client.execute(`SELECT COUNT(*) AS c FROM ${t}`);
      console.log(`  ${t.padEnd(32)} ${String(r.rows[0].c).padStart(6)}`);
    } catch (e) {
      console.log(`  ${t.padEnd(32)} ERROR: ${e.message}`);
    }
  }

  // 2. Pull every word row with its unit metadata.
  const rows = (await client.execute(`
    SELECT u."order" AS unit_order, u.id AS unit_id, u.name AS unit_name,
           w.id, w.word, w.part_of_speech, w.definition, w.example_sentence,
           w.synonyms, w.antonyms, w.theme_id
    FROM vocab_words w
    JOIN vocab_units u ON w.unit_id = u.id
  `)).rows;

  console.log(`\nAudited ${rows.length} word rows.\n`);

  // 3. Run every check.
  const counts    = new Map();     // label -> count
  const examples  = new Map();     // label -> first 3 rows
  const rowIssues = new Map();     // row.id -> [labels]

  for (const row of rows) {
    for (const { label, test } of CHECKS) {
      let hit = false;
      try { hit = !!test(row); } catch { hit = false; }
      if (!hit) continue;
      counts.set(label, (counts.get(label) || 0) + 1);
      const arr = examples.get(label) || [];
      if (arr.length < 3) {
        arr.push({ id: row.id, unit: row.unit_order, word: row.word });
        examples.set(label, arr);
      }
      rowIssues.set(row.id, [...(rowIssues.get(row.id) || []), label]);
    }
  }

  console.log('── Issue counts (only non-zero) ──');
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [label, count] of sorted) {
    console.log(`  ${String(count).padStart(5)}  ${label}`);
  }
  if (sorted.length === 0) console.log('  (none)');

  // 4. Samples per issue.
  console.log('\n── Samples (up to 3 per issue) ──');
  for (const [label] of sorted) {
    const ex = examples.get(label) || [];
    console.log(`\n  ${label}`);
    for (const e of ex) {
      console.log(`    unit ${e.unit} · id=${e.id} · "${e.word}"`);
    }
  }

  // 5. Duplicate-word detection (within a unit and across units).
  const byLower = new Map();
  for (const r of rows) {
    const k = String(r.word).toLowerCase().trim();
    byLower.set(k, [...(byLower.get(k) || []), { id: r.id, unit: r.unit_order }]);
  }
  const dups = [...byLower.entries()].filter(([, arr]) => arr.length > 1);
  console.log(`\n── Duplicate word entries: ${dups.length} ──`);
  for (const [w, arr] of dups.slice(0, 15)) {
    console.log(`  "${w}": ${arr.map(a => `unit ${a.unit} id=${a.id}`).join(', ')}`);
  }

  // 6. Orphan references.
  console.log('\n── Referential checks ──');
  const orphanUnit  = await client.execute(`SELECT COUNT(*) AS c FROM vocab_words WHERE unit_id NOT IN (SELECT id FROM vocab_units)`);
  const orphanTheme = await client.execute(`SELECT COUNT(*) AS c FROM vocab_words WHERE theme_id IS NOT NULL AND theme_id NOT IN (SELECT id FROM vocab_themes)`);
  const orphanProg  = await client.execute(`SELECT COUNT(*) AS c FROM vocab_user_word_records WHERE word_id NOT IN (SELECT id FROM vocab_words)`);
  console.log(`  vocab_words rows with unknown unit_id:         ${orphanUnit.rows[0].c}`);
  console.log(`  vocab_words rows with unknown theme_id:        ${orphanTheme.rows[0].c}`);
  console.log(`  vocab_user_word_records rows w/ unknown word:  ${orphanProg.rows[0].c}`);

  // 7. Themes without words, units without themes.
  const emptyThemes = await client.execute(`
    SELECT t.id, t.name FROM vocab_themes t
    LEFT JOIN vocab_words w ON w.theme_id = t.id
    GROUP BY t.id HAVING COUNT(w.id) = 0
  `);
  const emptyUnits  = await client.execute(`
    SELECT u.id, u."order", u.name FROM vocab_units u
    LEFT JOIN vocab_words w ON w.unit_id = u.id
    GROUP BY u.id HAVING COUNT(w.id) = 0
  `);
  console.log(`  themes with 0 words: ${emptyThemes.rows.length}`);
  for (const t of emptyThemes.rows.slice(0, 10)) console.log(`     theme id=${t.id} "${t.name}"`);
  console.log(`  units with 0 words:  ${emptyUnits.rows.length}`);
  for (const u of emptyUnits.rows.slice(0, 10)) console.log(`     unit ${u.order} "${u.name}" (id=${u.id})`);

  // 8. Rows with multiple issues — most suspect candidates.
  const worst = [...rowIssues.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 10);
  console.log(`\n── Top 10 rows with most issues ──`);
  for (const [id, labels] of worst) {
    const r = rows.find(x => x.id === id);
    console.log(`  unit ${r.unit_order} · id=${id} · "${r.word}" (${labels.length} issues)`);
    console.log(`    → ${labels.join(', ')}`);
  }

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
