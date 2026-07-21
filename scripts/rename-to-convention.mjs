/**
 * One-time backfill: rename existing materials + well-formed classes to the
 * naming convention, and populate the doc_type/number/topic columns that were
 * added empty in Phase 1. Mapping is EXPLICIT and reviewed (not parser-driven)
 * so there are no surprises on a production write.
 *
 * Dry run (default): prints current -> new for every row, writes NOTHING.
 * Apply:  node scripts/rename-to-convention.mjs --apply
 * Idempotent: a row already equal to its target is skipped.
 *
 * Needs NODE_EXTRA_CA_CERTS -> win-roots.pem (Turso TLS workaround).
 */
import { readFileSync } from 'node:fs';
const { createClient } = await import(
  new URL('../node_modules/@libsql/client/lib-esm/node.js', import.meta.url).href
);

const APPLY = process.argv.includes('--apply');

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')
    .filter(l => l.trim() && !l.trim().startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
);
const db = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });

// id -> target. Materials carry docType/number/topic; classes carry classNumber/topic.
const MATERIALS = {
  1:  { title: 'IBA English Lecture 1 — Foundation Grammar Skills',      docType: 'lecture',  number: '1',   topic: 'Foundation Grammar Skills' },
  3:  { title: 'IBA English Lecture 2 — Punctuation & Commas',           docType: 'lecture',  number: '2',   topic: 'Punctuation & Commas' },
  4:  { title: 'IBA Math Lecture 1.1',                                    docType: 'lecture',  number: '1.1', topic: null },
  5:  { title: 'IBA Math Lecture 1.2',                                    docType: 'lecture',  number: '1.2', topic: null },
  6:  { title: 'IBA English Lecture 3 — Vocabulary Guide',               docType: 'lecture',  number: '3',   topic: 'Vocabulary Guide' },
  7:  { title: 'IBA Math Lecture 1.3',                                    docType: 'lecture',  number: '1.3', topic: null },
  8:  { title: 'IBA Math Solution 1.1',                                   docType: 'solution', number: '1.1', topic: null },
  9:  { title: 'IBA Math Solution 1.2',                                   docType: 'solution', number: '1.2', topic: null },
  10: { title: 'IBA Math Solution 1.3',                                   docType: 'solution', number: '1.3', topic: null },
  11: { title: 'IBA English Lecture 4 — Advanced Sentence Structures',   docType: 'lecture',  number: '4',   topic: 'Advanced Sentence Structures' },
};

const CLASSES = {
  14: { title: 'IBA Math Class 1 — Lecture 1.1',                classNumber: 1, topic: 'Lecture 1.1' },
  7:  { title: 'IBA English Class 1 — Foundation Grammar Skills', classNumber: 1, topic: 'Foundation Grammar Skills' },
  1:  { title: 'IBA English Class 2 — Punctuation & Commas',    classNumber: 2, topic: 'Punctuation & Commas' },
  6:  { title: 'IBA English Class 3 — Vocabulary Guide',        classNumber: 3, topic: 'Vocabulary Guide' }, // inherits name from linked material #6
  2:  { title: 'IBA Math Class 3 — Lecture 1.3',                classNumber: 3, topic: 'Lecture 1.3' },
};

let changes = 0, skipped = 0;

console.log(`\n=== ${APPLY ? 'APPLYING' : 'DRY RUN (no writes)'} ===\n`);

console.log('--- MATERIALS ---');
for (const [id, t] of Object.entries(MATERIALS)) {
  const cur = await db.execute({ sql: 'SELECT title, doc_type, number, topic FROM materials WHERE id = ?', args: [Number(id)] });
  if (cur.rows.length === 0) { console.log(`  #${id}  MISSING — skipped`); continue; }
  const c = cur.rows[0];
  const same = c.title === t.title && c.doc_type === t.docType && c.number === t.number && (c.topic ?? null) === t.topic;
  if (same) { skipped++; console.log(`  #${id}  = already correct`); continue; }
  changes++;
  console.log(`  #${id}  "${c.title}"\n       -> "${t.title}"  [type=${t.docType} num=${t.number} topic=${t.topic ?? '-'}]`);
  if (APPLY) {
    await db.execute({ sql: 'UPDATE materials SET title=?, doc_type=?, number=?, topic=? WHERE id=?',
      args: [t.title, t.docType, t.number, t.topic, Number(id)] });
  }
}

console.log('\n--- CLASSES ---');
for (const [id, t] of Object.entries(CLASSES)) {
  const cur = await db.execute({ sql: 'SELECT title, class_number, topic FROM class_sessions WHERE id = ?', args: [Number(id)] });
  if (cur.rows.length === 0) { console.log(`  #${id}  MISSING — skipped`); continue; }
  const c = cur.rows[0];
  const same = c.title === t.title && c.class_number === t.classNumber && (c.topic ?? null) === t.topic;
  if (same) { skipped++; console.log(`  #${id}  = already correct`); continue; }
  changes++;
  console.log(`  #${id}  "${c.title}"\n       -> "${t.title}"  [class#=${t.classNumber} topic=${t.topic ?? '-'}]`);
  if (APPLY) {
    await db.execute({ sql: 'UPDATE class_sessions SET title=?, class_number=?, topic=? WHERE id=?',
      args: [t.title, t.classNumber, t.topic, Number(id)] });
  }
}

console.log(`\n=== ${APPLY ? 'APPLIED' : 'DRY RUN'}: ${changes} to change, ${skipped} already correct ===`);
if (!APPLY && changes) console.log('Re-run with --apply to write these changes.\n');
