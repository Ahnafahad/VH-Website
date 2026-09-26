// scripts/redline/build-content.mjs — turns parsed bank records into Redline question rows
// (lossless: every teaching/autopsy/transfer/QA field is carried) and assigns them to levels.
import { canonicalSkill, classifyFamily, classifyTrap, difficultyLabel, difficultyScore } from './taxonomy.mjs';

export const LEVEL_SIZE = 20;
const BAND_LEVELS = 3; // levels per difficulty band; skills are dealt evenly across a band's levels

const str = (v) => (v == null ? null : String(v));

function buildRow(q) {
  const primary = canonicalSkill(q.skills.primary);
  const secondary = [...new Set((q.skills.secondary ?? []).map(canonicalSkill))].filter(s => s !== primary);
  const label = difficultyLabel(q.metadata?.source_difficulty ?? q.metadata?.difficulty);
  const correct = String(q.answer.correct).trim();
  const keys = Object.keys(q.source.options);

  const distractors = {};
  for (const k of keys) {
    const d = q.distractors[k];
    if (k === correct) {
      distractors[k] = { status: 'correct', reason: str(d.reason) };
    } else {
      distractors[k] = {
        status: 'incorrect',
        issue: str(d.issue), attraction: str(d.attraction), misconception: str(d.misconception),
        family: classifyFamily(d, primary), trap: classifyTrap(d, k),
      };
    }
  }

  const status = String(q.qa?.status ?? '');
  const held = status.startsWith('BLOCKED');
  const content = {
    sentence: str(q.source.sentence),
    span: str(q.source.replacement_span),
    options: Object.fromEntries(keys.map(k => [k, str(q.source.options[k])])),
    meaning: str(q.meaning?.plain_paraphrase),
    xray: (q.xray ?? []).map(x => ({ label: str(x.label), text: str(x.text) })),
    decision: str(q.decision?.question),
    hint1: str(q.teaching.hint1), hint2: str(q.teaching.hint2),
    correct,
    proof: str(q.answer.proof),
    closestCompetitor: str(q.answer.closest_competitor),
    whyCompetitorFails: str(q.answer.why_competitor_fails),
    distractors,
    explanation: str(q.teaching.explanation), deeper: str(q.teaching.deeper),
    whyMiss: str(q.teaching.why_students_miss), howCatch: str(q.teaching.how_to_catch),
    transfer: {
      prompt: str(q.transfer.prompt),
      options: Object.fromEntries(Object.entries(q.transfer.options ?? {}).map(([k, v]) => [k, str(v)])),
      answer: str(q.transfer.answer), explanation: str(q.transfer.explanation),
    },
    skills: { primary: str(q.skills.primary), secondary: (q.skills.secondary ?? []).map(str) },
    relatedItems: (q.metadata?.related_items ?? []).map(str),
    reviewFamily: str(q.metadata?.review_family), masterySkillId: str(q.metadata?.mastery_skill_id),
    sourcePdfPage: q.source_pdf_page ?? null,
  };
  const staff = {
    qa: q.qa ?? null, authorNotes: q.author_notes ?? null, authorConfidence: q.answer.author_confidence ?? null,
    metadata: q.metadata ?? null, decisionNote: q.decision_note ?? null,
  };

  return {
    number: q.__n, sourceId: String(q.id),
    level: null, position: null,
    status: held ? 'held' : 'live',
    holdReason: held ? `QA: ${status}` : null,
    skillId: primary, secondarySkills: secondary,
    difficultyLabel: label, difficultyScore: difficultyScore(q, label),
    correctKey: correct, content, staff,
  };
}

/** Validation of one built row — throws on anything that would break the taker. */
function validateRow(r) {
  const n = `Q${r.number}`;
  const keys = Object.keys(r.content.options);
  if (keys.length < 2) throw new Error(`${n}: fewer than 2 options`);
  if (!keys.includes(r.correctKey)) throw new Error(`${n}: correct key ${r.correctKey} not among options`);
  for (const f of ['sentence', 'hint1', 'hint2', 'proof', 'explanation', 'deeper', 'whyMiss', 'howCatch']) {
    if (!r.content[f]) throw new Error(`${n}: missing ${f}`);
  }
  for (const k of keys) if (!r.content.distractors[k]) throw new Error(`${n}: missing autopsy for ${k}`);
  const t = r.content.transfer;
  if (!t.prompt || !t.answer || !t.options[t.answer]) throw new Error(`${n}: bad transfer item`);
  if (r.content.span && !r.content.sentence.includes(r.content.span)) {
    // Not fatal — the UI falls back to plain text — but flag it.
    r.spanMismatch = true;
  }
}

/** Assign live questions to levels: difficulty ramps by band, skills are dealt evenly inside a band. */
export function assignLevels(rows) {
  const live = rows.filter(r => r.status === 'live').sort((a, b) => a.difficultyScore - b.difficultyScore || a.number - b.number);
  const nLevels = Math.floor(live.length / LEVEL_SIZE);
  const sizes = Array.from({ length: nLevels }, () => LEVEL_SIZE);
  sizes[nLevels - 1] += live.length - nLevels * LEVEL_SIZE; // leftover folds into the final level

  let cursor = 0;
  for (let bandStart = 0; bandStart < nLevels; bandStart += BAND_LEVELS) {
    const levelIdx = [];
    for (let i = bandStart; i < Math.min(bandStart + BAND_LEVELS, nLevels); i++) levelIdx.push(i);
    const bandSize = levelIdx.reduce((n, i) => n + sizes[i], 0);
    const band = live.slice(cursor, cursor + bandSize);
    cursor += bandSize;

    // Deal by skill (largest skill groups first), easiest first inside a group, into the level
    // with the most free capacity that holds the fewest of that skill so far.
    const bySkill = new Map();
    for (const r of band) (bySkill.get(r.skillId) ?? bySkill.set(r.skillId, []).get(r.skillId)).push(r);
    const groups = [...bySkill.values()].sort((a, b) => b.length - a.length);
    const buckets = levelIdx.map(i => ({ i, cap: sizes[i], items: [], skillCount: new Map() }));
    for (const g of groups) {
      for (const r of g) {
        const open = buckets.filter(b => b.items.length < b.cap);
        open.sort((a, b) => (a.skillCount.get(r.skillId) ?? 0) - (b.skillCount.get(r.skillId) ?? 0)
          || (b.cap - b.items.length) - (a.cap - a.items.length));
        const b = open[0];
        b.items.push(r);
        b.skillCount.set(r.skillId, (b.skillCount.get(r.skillId) ?? 0) + 1);
      }
    }
    for (const b of buckets) {
      b.items.sort((x, y) => x.difficultyScore - y.difficultyScore || x.number - y.number);
      b.items.forEach((r, p) => { r.level = b.i + 1; r.position = p + 1; });
    }
  }
  return nLevels;
}

export function buildAll(records) {
  const rows = records.map(buildRow);
  rows.forEach(validateRow);
  const nums = new Set(rows.map(r => r.number));
  if (nums.size !== rows.length) throw new Error('Duplicate question numbers in bank');
  const nLevels = assignLevels(rows);
  return { rows, nLevels };
}
