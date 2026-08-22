#!/usr/bin/env node
// scripts/prep-marathon-from-tagged-json.mjs
// Merges a "TAGGED questions" JSON + a "CORRECTED answer keys" JSON + a folder
// of per-day `Day_N_Solutions.md` files (test-import's Day-solutions format —
// see docs/marathon-module.md) into one canonical marathon-import JSON that
// scripts/import-marathon.mjs can seed.
//
// Usage:
//   node scripts/prep-marathon-from-tagged-json.mjs \
//     --questions <path to *_TAGGED.json> \
//     --answers   <path to *_answer_keys*.json> \
//     --solutions-dir <dir containing Day_N_Solutions.md files, optional> \
//     --slug <kebab-case chapter slug> \
//     --title "<Chapter title>" \
//     --subject math --product iba \
//     --out marathon-import/<slug>.json

import fs from 'fs';
import path from 'path';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      out[key] = val;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
for (const req of ['questions', 'answers', 'slug', 'title', 'out']) {
  if (!args[req]) { console.error(`Missing required --${req}`); process.exit(1); }
}
const subject = args.subject ?? 'math';
const product = args.product ?? 'iba';

// ─── Load inputs ──────────────────────────────────────────────────────────────

const questionsData = JSON.parse(fs.readFileSync(args.questions, 'utf8'));
const answersData = JSON.parse(fs.readFileSync(args.answers, 'utf8'));

const answersByDay = new Map(answersData.days.map(d => [d.day, new Map(d.answers.map(a => [a.question, a.answer]))]));

// ─── Parse per-day solutions markdown (optional) ──────────────────────────────
// Format (see docs/test-data or the uploaded Day_N_Solutions.md files):
//   ### Question N
//   ...question restated, options...
//   **Answer: (X) ...**
//   **Solution.** ... (may include further **Label.** paragraphs)
//   ---
//   (repeats; ends with "## Closing note — ..." after the last question)

// RichText (src/components/workbook/RichText.tsx) only recognizes **bold**
// and _italic_ — not single-asterisk *italic* — so convert single-asterisk
// spans (not part of a **bold** pair) before they reach the DB.
function convertSingleAsteriskItalics(text) {
  return text.replace(/(?<!\*)\*(?!\*)([^*\n]+?)(?<!\*)\*(?!\*)/g, '_$1_');
}

function parseSolutionsFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const parts = content.split(/\n### Question (\d+)\s*\n/);
  // parts = [preamble, "1", block1, "2", block2, ...]
  const solutions = new Map();
  for (let i = 1; i < parts.length; i += 2) {
    const number = Number(parts[i]);
    const block = parts[i + 1] ?? '';
    const answerMatch = block.match(/\*\*Answer:.*?\*\*/s);
    if (!answerMatch) continue;
    let solution = block.slice(answerMatch.index + answerMatch[0].length);
    let cut = solution.length;
    const dividerIdx = solution.indexOf('\n---\n');
    if (dividerIdx !== -1) cut = Math.min(cut, dividerIdx);
    const closingIdx = solution.indexOf('\n## Closing note');
    if (closingIdx !== -1) cut = Math.min(cut, closingIdx);
    solution = convertSingleAsteriskItalics(solution.slice(0, cut).trim());
    if (solution) solutions.set(number, solution);
  }
  return solutions;
}

const solutionsByDay = new Map();
if (args['solutions-dir'] && fs.existsSync(args['solutions-dir'])) {
  const dir = args['solutions-dir'];
  for (const file of fs.readdirSync(dir)) {
    const m = file.match(/^Day_(\d+)_Solutions\.md$/);
    if (!m) continue;
    solutionsByDay.set(Number(m[1]), parseSolutionsFile(path.join(dir, file)));
  }
}

// ─── Merge ──────────────────────────────────────────────────────────────────

const days = [];
const warnings = [];

for (const dayBlock of questionsData.days) {
  const dayNumber = dayBlock.day;
  const answerMap = answersByDay.get(dayNumber);
  if (!answerMap) { warnings.push(`Day ${dayNumber}: no answer key found — skipping day`); continue; }
  const solutionMap = solutionsByDay.get(dayNumber) ?? new Map();

  const questions = dayBlock.questions.map(q => {
    const correctKey = answerMap.get(q.number);
    if (!correctKey) warnings.push(`Day ${dayNumber} Q${q.number}: no answer key entry`);
    const options = Object.entries(q.options).map(([key, text]) => ({ key, text }));
    return {
      number: q.number,
      stem: q.question,
      options,
      correctKey: correctKey ?? null,
      solution: solutionMap.get(q.number) ?? null,
      imageUrl: null,
      primaryTag: q.tags?.primary ? { code: q.tags.primary.code, label: q.tags.primary.subtopic } : null,
      secondaryTag: q.tags?.secondary ? { code: q.tags.secondary.code, label: q.tags.secondary.subtopic } : null,
    };
  });

  days.push({ day: dayNumber, questions });
}

const canonical = {
  slug: args.slug,
  title: args.title,
  subject,
  product,
  days,
};

fs.mkdirSync(path.dirname(args.out), { recursive: true });
fs.writeFileSync(args.out, JSON.stringify(canonical, null, 2));

console.log(`Wrote ${args.out} — ${days.length} days, ${days.reduce((s, d) => s + d.questions.length, 0)} questions.`);
if (warnings.length) {
  console.log(`\n${warnings.length} warning(s):`);
  for (const w of warnings) console.log(`  - ${w}`);
}
const withSolutions = days.reduce((s, d) => s + d.questions.filter(q => q.solution).length, 0);
console.log(`Solutions attached: ${withSolutions} of ${days.reduce((s, d) => s + d.questions.length, 0)} questions.`);
