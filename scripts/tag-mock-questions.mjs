/**
 * Question tagging for BTH (IBA) mocks — required step of every mock import (Mock Reports depend on it).
 * Tags: English/Analytical by question type, Mathematics by topic. Allowed values: src/lib/mocks/question-tags.ts.
 *
 *   export: writes <out>/<kind>-questions.json (english|math|analytical) for one mock, for a cheap model to tag
 *     node scripts/tag-mock-questions.mjs export <test-slug> <out-dir>
 *   apply:  validates and writes tags from one or more JSON files mapping questionId -> tag
 *     node scripts/tag-mock-questions.mjs apply <tags.json> [more.json ...] [--apply]   (dry-run without --apply)
 *   check:  lists untagged questions of a mock
 *     node scripts/tag-mock-questions.mjs check <test-slug>
 *
 * Needs $env:NODE_EXTRA_CA_CERTS='D:\VH Website\win-roots.pem' locally.
 * Image-only questions (stem says "shown in the image") export their image path; the tagger must look at the image.
 */
import { createClient } from '@libsql/client';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(root, '.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim();
    const i = t.indexOf('=');
    if (t && !t.startsWith('#') && i > 0) process.env[t.slice(0, i).trim()] ??= t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
}
const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

// Allowed tags are read from the TS source so there is one list.
const tagSrc = readFileSync(resolve(root, 'src/lib/mocks/question-tags.ts'), 'utf-8');
const allowed = {};
for (const [name, kind] of [['ENGLISH_TAGS', 'english'], ['MATH_TAGS', 'math'], ['ANALYTICAL_TAGS', 'analytical']]) {
  const body = tagSrc.match(new RegExp(`${name} = \\[([\\s\\S]*?)\\] as const`))[1];
  allowed[kind] = [...body.matchAll(/'([^']+)'/g)].map(m => m[1]);
}
const kindOf = title => /^lang|english/i.test(title) ? 'english' : /^math/i.test(title) ? 'math' : /^analyt/i.test(title) ? 'analytical' : null;
const strip = s => (s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

const [cmd, ...args] = process.argv.slice(2);

async function questionsOf(slug) {
  return (await db.execute({
    sql: `SELECT q.id, q.number n, q.stem, q.options, q.image_url, q.tag, s.title sec, g.id gid, g.kind, g.title gt, g.content gc
          FROM test_questions q JOIN test_sections s ON s.id = q.section_id JOIN tests t ON t.id = s.test_id
          LEFT JOIN test_question_groups g ON g.id = q.group_id WHERE t.slug = ? ORDER BY s."order", q."order"`,
    args: [slug],
  })).rows;
}

if (cmd === 'export') {
  const [slug, out] = args;
  mkdirSync(out, { recursive: true });
  const rows = await questionsOf(slug);
  if (!rows.length) throw new Error(`no questions for ${slug}`);
  const by = {};
  for (const x of rows) {
    const k = kindOf(x.sec);
    if (!k) continue;
    by[k] ??= { allowedTags: allowed[k], groups: {}, questions: [] };
    let options = [];
    try { options = JSON.parse(x.options).map(o => `${o.key}) ${strip(o.text)}`); } catch { /* keep empty */ }
    if (x.gid && !by[k].groups[x.gid]) by[k].groups[x.gid] = { kind: x.kind, title: strip(x.gt), content: strip(x.gc).slice(0, k === 'english' ? 400 : 1500) };
    by[k].questions.push({ id: x.id, n: x.n, group: x.gid ?? null, stem: strip(x.stem), options,
      image: x.image_url ? resolve(root, 'public' + x.image_url) : null });
  }
  for (const [k, v] of Object.entries(by)) {
    writeFileSync(resolve(out, `${k}-questions.json`), JSON.stringify(v, null, 1));
    console.log(`${k}: ${v.questions.length} questions -> ${k}-questions.json`);
  }
} else if (cmd === 'apply') {
  const write = args.includes('--apply');
  const tags = {};
  for (const f of args.filter(a => a !== '--apply')) Object.assign(tags, JSON.parse(readFileSync(f, 'utf-8')));
  const ids = Object.keys(tags).map(Number);
  const rows = (await db.execute(`SELECT q.id, s.title sec FROM test_questions q JOIN test_sections s ON s.id = q.section_id WHERE q.id IN (${ids.join(',')})`)).rows;
  const secOf = Object.fromEntries(rows.map(r => [r.id, r.sec]));
  const bad = ids.filter(id => !secOf[id] || !allowed[kindOf(secOf[id])]?.includes(tags[id]));
  if (bad.length) { console.error('Invalid tag or unknown id:', bad.map(id => `${id}=${tags[id]}`).join(', ')); process.exit(1); }
  console.log(`${ids.length} tags valid.${write ? '' : ' Dry run; pass --apply to write.'}`);
  if (write) {
    await db.batch(ids.map(id => ({ sql: 'UPDATE test_questions SET tag = ? WHERE id = ?', args: [tags[id], id] })), 'write');
    console.log('Written.');
  }
} else if (cmd === 'check') {
  const rows = await questionsOf(args[0]);
  const untagged = rows.filter(r => kindOf(r.sec) && !r.tag);
  console.log(`${rows.length - untagged.length}/${rows.length} tagged.`, untagged.length ? `Untagged ids: ${untagged.map(r => r.id).join(',')}` : '');
} else {
  console.log('usage: export <slug> <out> | apply <tags.json...> [--apply] | check <slug>');
}
