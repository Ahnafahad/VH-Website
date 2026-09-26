// scripts/redline/taxonomy.mjs — normalises the bank's free-text labels into the canonical
// Redline taxonomy (src/lib/redline/taxonomy.json) and derives difficulty scores.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const TAXONOMY = JSON.parse(fs.readFileSync(path.join(here, '../../src/lib/redline/taxonomy.json'), 'utf8'));

const norm = (s) => String(s ?? '').toLowerCase().replace(/\s*\/\s*/g, ' / ').replace(/\s+/g, ' ').trim();

const skillByAlias = new Map();
for (const s of TAXONOMY.skills) for (const a of s.aliases) skillByAlias.set(norm(a), s.id);

export function canonicalSkill(label) {
  const id = skillByAlias.get(norm(label));
  if (!id) throw new Error(`Unmapped skill label: "${label}"`);
  return id;
}

const skillDefaultFamily = new Map(TAXONOMY.families.map(f => [f.skill, f.id]));
// Skills with no dedicated family fall back to the nearest one.
skillDefaultFamily.set('correlative', 'parallel-break');
skillDefaultFamily.set('pronoun-agreement', 'pronoun-error');

const familyRes = TAXONOMY.families.map(f => ({ id: f.id, skill: f.skill, res: f.patterns.map(p => new RegExp(p)) }));
const trapRes = TAXONOMY.traps.filter(t => t.patterns.length).map(t => ({ id: t.id, res: t.patterns.map(p => new RegExp(p)) }));

export function classifyFamily(distractor, skillId) {
  const tag = norm(String(distractor.misconception ?? '').replace(/-/g, ' '));
  const issue = norm(String(distractor.issue ?? '').replace(/-/g, ' '));
  // The short misconception tag is the specific signal; the long issue text mentions many
  // concepts, so it only breaks ties. A family matching the question's own skill gets a bonus.
  let best = null, bestScore = 0;
  for (const f of familyRes) {
    const hits = (text) => f.res.reduce((n, re) => n + (re.test(text) ? 1 : 0), 0);
    const base = 4 * hits(tag) + hits(issue);
    if (base === 0) continue;
    const score = base + (f.skill === skillId ? 2 : 0);
    if (score > bestScore) { best = f.id; bestScore = score; }
  }
  return best ?? skillDefaultFamily.get(skillId) ?? 'meaning-distortion';
}

export function classifyTrap(distractor, key) {
  if (key === 'A') return 'keeps-original';
  const text = norm(String(distractor.attraction ?? '').replace(/-/g, ' '));
  for (const t of trapRes) if (t.res.some(re => re.test(text))) return t.id;
  return 'other';
}

const LABEL_BASE = { foundation: 1, standard: 2, advanced: 3, 'high trap density': 3.6, hard: 4 };
export function difficultyLabel(raw) {
  const k = norm(raw).replace(/[_-]/g, ' ');
  if (!(k in LABEL_BASE)) throw new Error(`Unknown difficulty label: "${raw}"`);
  return k;
}

/** Composite difficulty: authored label + structural signals. Higher = harder. */
export function difficultyScore(q, label) {
  const sec = (q.skills.secondary ?? []).length;
  const conf = String(q.metadata?.confidence_state ?? 'high').toLowerCase();
  const words = String(q.source.sentence).split(/\s+/).length
    + Object.values(q.source.options).reduce((n, o) => n + String(o).split(/\s+/).length, 0) / 5;
  let s = LABEL_BASE[label];
  s += 0.25 * Math.min(sec, 3);
  s += conf === 'low' ? 0.6 : conf === 'medium' ? 0.3 : 0;
  s += q.qa?.status === 'PASS WITH EDITS' ? 0.2 : 0;
  s += Math.min(words / 100, 0.6);
  return Math.round(s * 1000) / 1000;
}
