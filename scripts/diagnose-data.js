/**
 * Read-only diagnostic: surface data-quality issues in vocab_words
 * before committing to a standardization strategy.
 *
 * Run: node --env-file=.env.local scripts/diagnose-data.js
 */

'use strict';

const { createClient } = require('@libsql/client');

async function main() {
  const client = createClient({
    url:       process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  // Unit counts
  const unitCounts = await client.execute(`
    SELECT u."order" AS unit_order, u.name AS unit_name, COUNT(w.id) AS word_count
    FROM vocab_units u
    LEFT JOIN vocab_words w ON w.unit_id = u.id
    GROUP BY u.id
    ORDER BY u."order"
  `);
  console.log('── Word counts per unit ──');
  let cumulative = 0;
  for (const row of unitCounts.rows) {
    cumulative += Number(row.word_count);
    console.log(`  Unit ${String(row.unit_order).padStart(2)} (${row.unit_name}): ${String(row.word_count).padStart(3)} words  [cumulative: ${cumulative}]`);
  }
  console.log(`\nTotal words: ${cumulative}\n`);

  // Sample one word per unit — compare formatting across unit ranges
  const sampleQuery = await client.execute(`
    SELECT u."order" AS unit_order, w.word, w.part_of_speech, w.definition, w.example_sentence, w.synonyms, w.antonyms
    FROM vocab_words w
    JOIN vocab_units u ON w.unit_id = u.id
    WHERE w.id IN (
      SELECT MIN(id) FROM vocab_words GROUP BY unit_id
    )
    ORDER BY u."order"
  `);
  console.log('── Sample row per unit ──');
  for (const row of sampleQuery.rows) {
    console.log(`\n  Unit ${row.unit_order}`);
    console.log(`    word:            ${JSON.stringify(row.word)}`);
    console.log(`    part_of_speech:  ${JSON.stringify(row.part_of_speech)}`);
    console.log(`    definition:      ${JSON.stringify(String(row.definition || '').slice(0, 80))}`);
    console.log(`    example:         ${JSON.stringify(String(row.example_sentence || '').slice(0, 80))}`);
    console.log(`    synonyms:        ${row.synonyms}`);
    console.log(`    antonyms:        ${row.antonyms}`);
  }

  // Data hygiene scan across ALL rows
  console.log('\n── Data hygiene scan (all rows) ──');
  const all = await client.execute('SELECT id, word, part_of_speech, definition, example_sentence, synonyms, antonyms FROM vocab_words');
  const issues = {
    wordLeadingTrailingWs:       0,
    wordInternalDoubleSpace:     0,
    wordNotTitleCase:            0,
    posLeadingTrailingWs:        0,
    posNotLowercase:             0,
    definitionLeadingTrailingWs: 0,
    definitionDoubleSpace:       0,
    definitionNotCapFirst:       0,
    exampleLeadingTrailingWs:    0,
    exampleDoubleSpace:          0,
    exampleNotCapFirst:          0,
    synAntEmptyString:           0,
    synAntLeadingTrailingWs:     0,
    synonymsTitleCase:           0,
    synonymsLowercase:           0,
    antonymsTitleCase:           0,
    antonymsLowercase:           0,
  };

  for (const r of all.rows) {
    const w = r.word || '';
    if (w !== w.trim())               issues.wordLeadingTrailingWs++;
    if (/\s{2,}/.test(w))             issues.wordInternalDoubleSpace++;
    if (w && w[0] !== w[0].toUpperCase()) issues.wordNotTitleCase++;

    const p = r.part_of_speech || '';
    if (p !== p.trim())               issues.posLeadingTrailingWs++;
    if (p && p !== p.toLowerCase())   issues.posNotLowercase++;

    const d = r.definition || '';
    if (d !== d.trim())               issues.definitionLeadingTrailingWs++;
    if (/\s{2,}/.test(d))             issues.definitionDoubleSpace++;
    if (d && d[0] !== d[0].toUpperCase()) issues.definitionNotCapFirst++;

    const e = r.example_sentence || '';
    if (e !== e.trim())               issues.exampleLeadingTrailingWs++;
    if (/\s{2,}/.test(e))             issues.exampleDoubleSpace++;
    if (e && e[0] !== e[0].toUpperCase()) issues.exampleNotCapFirst++;

    for (const field of ['synonyms', 'antonyms']) {
      try {
        const arr = JSON.parse(r[field] || '[]');
        for (const item of arr) {
          if (!item || typeof item !== 'string') continue;
          if (item === '') issues.synAntEmptyString++;
          if (item !== item.trim()) issues.synAntLeadingTrailingWs++;
          if (item && item[0] === item[0].toUpperCase() && item !== item.toUpperCase()) {
            issues[`${field}TitleCase`]++;
          }
          if (item && item === item.toLowerCase()) {
            issues[`${field}Lowercase`]++;
          }
        }
      } catch {}
    }
  }

  for (const [key, val] of Object.entries(issues)) {
    console.log(`  ${key.padEnd(32)} ${val}`);
  }

  // Per-unit casing distribution for syn/ant
  console.log('\n── Synonym casing by unit (first-letter uppercase count / total terms) ──');
  const perUnit = await client.execute(`
    SELECT u."order" AS unit_order, w.synonyms, w.antonyms
    FROM vocab_words w JOIN vocab_units u ON w.unit_id = u.id
  `);
  const unitStats = new Map();
  for (const r of perUnit.rows) {
    const o = Number(r.unit_order);
    const s = unitStats.get(o) || { synUpper: 0, synTotal: 0, antUpper: 0, antTotal: 0 };
    for (const f of ['synonyms', 'antonyms']) {
      try {
        const arr = JSON.parse(r[f] || '[]');
        for (const item of arr) {
          if (!item) continue;
          const isUp = item[0] === item[0].toUpperCase() && item !== item.toUpperCase();
          if (f === 'synonyms') { s.synTotal++; if (isUp) s.synUpper++; }
          else                   { s.antTotal++; if (isUp) s.antUpper++; }
        }
      } catch {}
    }
    unitStats.set(o, s);
  }
  for (const [o, s] of [...unitStats.entries()].sort((a,b)=>a[0]-b[0])) {
    console.log(`  Unit ${String(o).padStart(2)}: syn ${s.synUpper}/${s.synTotal} Title,  ant ${s.antUpper}/${s.antTotal} Title`);
  }

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
