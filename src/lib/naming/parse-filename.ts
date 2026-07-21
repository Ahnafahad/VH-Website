/**
 * Layer 1 of the autofill engine — parses a material filename into
 * structured naming fields. Free, instant, deterministic. Every field is
 * `null` when the filename genuinely doesn't contain a signal for it —
 * this layer never guesses; later layers (predict.ts, suggest.ts) fill gaps.
 */

import { COURSES, CourseKey, SubjectKey, DocTypeKey } from './taxonomy';

export interface ParsedFilenameFields {
  course:  CourseKey  | null;
  subject: SubjectKey | null;
  docType: DocTypeKey | null;
  number:  string      | null;
  topic:   string      | null;
}

// Tokens that are brand noise, never topic content. `IBA`/`BBA` additionally
// signal course `iba`; `BTH`/`BH` are pure noise.
const BRAND_NOISE = new Set(['BTH', 'BH', 'BBA', 'IBA']);
const COURSE_SIGNAL = new Set(['BBA', 'IBA']);

const SUBJECT_MAP: Record<string, SubjectKey> = {
  MATHS: 'math',
  MATH: 'math',
  ENGLISH: 'english',
  ANALYTICAL: 'analytical',
};

// Doc-type vocabulary, ranked by priority (lower wins when several appear —
// e.g. "Lecture 1.1 - Solution" resolves to solution, not lecture).
const DOC_TYPE_PRIORITY: Record<DocTypeKey, number> = {
  solution: 1,
  question_paper: 2,
  notes: 3,
  homework: 4,
  practice: 5,
  lecture: 6,
};
const DOC_TYPE_SINGLE_WORDS: Record<string, DocTypeKey> = {
  SOLUTION: 'solution',
  QP: 'question_paper',
  NOTES: 'notes',
  HOMEWORK: 'homework',
  PRACTICE: 'practice',
  LECTURE: 'lecture',
};
const DOC_TYPE_PHRASES: Record<string, DocTypeKey> = {
  'LECTURE SHEET': 'lecture',
  'QUESTION PAPER': 'question_paper',
  'PRACTICE SET': 'practice',
};

function normalizeAndTokenize(fileName: string): string[] {
  // Strip extension (last dot-segment).
  let s = fileName.replace(/\.[^.\s]+$/, '');
  // Strip a trailing " (2)"-style duplicate marker.
  s = s.replace(/\s*\(\d+\)$/, '');
  // Normalize separators (` - `, `-`, `_`) to single spaces.
  s = s.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
  return s.length ? s.split(' ') : [];
}

function detectCourse(tokens: string[], consumed: boolean[]): CourseKey | null {
  let hasSignal = false;
  for (let i = 0; i < tokens.length; i++) {
    const upper = tokens[i].toUpperCase();
    if (BRAND_NOISE.has(upper)) {
      consumed[i] = true;
      if (COURSE_SIGNAL.has(upper)) hasSignal = true;
    }
  }
  if (hasSignal) return 'iba';
  // Taxonomy currently has exactly one course, so it's unambiguous even
  // without an explicit brand token in the filename.
  if (COURSES.length === 1) return COURSES[0].key;
  return null;
}

function detectSubject(tokens: string[], consumed: boolean[]): SubjectKey | null {
  for (let i = 0; i < tokens.length; i++) {
    if (consumed[i]) continue;
    const hit = SUBJECT_MAP[tokens[i].toUpperCase()];
    if (hit) {
      consumed[i] = true;
      return hit;
    }
  }
  return null;
}

function detectDocType(tokens: string[], consumed: boolean[]): DocTypeKey | null {
  const upper = tokens.map(t => t.toUpperCase());
  const matches: { docType: DocTypeKey; indices: number[] }[] = [];

  // Two-word phrases first, so "Lecture Sheet" isn't split into a lone
  // "Lecture" match plus a stray "Sheet" leftover.
  for (let i = 0; i < tokens.length - 1; i++) {
    if (consumed[i] || consumed[i + 1]) continue;
    const phrase = `${upper[i]} ${upper[i + 1]}`;
    const hit = DOC_TYPE_PHRASES[phrase];
    if (hit) matches.push({ docType: hit, indices: [i, i + 1] });
  }
  const phraseConsumed = new Set(matches.flatMap(m => m.indices));

  for (let i = 0; i < tokens.length; i++) {
    if (consumed[i] || phraseConsumed.has(i)) continue;
    const hit = DOC_TYPE_SINGLE_WORDS[upper[i]];
    if (hit) matches.push({ docType: hit, indices: [i] });
  }

  if (matches.length === 0) return null;
  // Every matched token is recognized vocabulary — remove all of them from
  // the topic pool, even the ones that lose the priority contest.
  matches.forEach(m => m.indices.forEach(idx => { consumed[idx] = true; }));
  matches.sort((a, b) => DOC_TYPE_PRIORITY[a.docType] - DOC_TYPE_PRIORITY[b.docType]);
  return matches[0].docType;
}

function detectNumber(tokens: string[], consumed: boolean[]): string | null {
  for (let i = 0; i < tokens.length; i++) {
    if (consumed[i]) continue;
    if (/^\d+\.\d+$/.test(tokens[i])) {
      consumed[i] = true;
      return tokens[i];
    }
  }
  for (let i = 0; i < tokens.length; i++) {
    if (consumed[i]) continue;
    const m = /^(?:ch(?:apter)?)(\d+)$/i.exec(tokens[i]);
    if (m) {
      consumed[i] = true;
      return m[1];
    }
  }
  for (let i = 0; i < tokens.length; i++) {
    if (consumed[i]) continue;
    if (/^\d+$/.test(tokens[i])) {
      consumed[i] = true;
      return tokens[i];
    }
  }
  return null;
}

function titleCase(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function buildTopic(tokens: string[], consumed: boolean[]): string | null {
  const leftover = tokens.filter((_, i) => !consumed[i]);
  if (leftover.length === 0) return null;
  return leftover.map(titleCase).join(' ');
}

export function parseFilename(fileName: string): ParsedFilenameFields {
  const tokens = normalizeAndTokenize(fileName);
  const consumed = new Array(tokens.length).fill(false);

  const course = detectCourse(tokens, consumed);
  const subject = detectSubject(tokens, consumed);
  const docType = detectDocType(tokens, consumed);
  const number = detectNumber(tokens, consumed);
  const topic = buildTopic(tokens, consumed);

  return { course, subject, docType, number, topic };
}
