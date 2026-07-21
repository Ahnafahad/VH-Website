/**
 * Merges layers 1-3 into the final autofill suggestion, with per-field
 * provenance and confidence so the UI can show the reviewer where each
 * guess came from. Layer 4 (AI fallback) is out of scope here.
 */

import { COURSES, CourseKey, SubjectKey, DocTypeKey } from './taxonomy';
import { formatMaterialName } from './format-name';
import { parseFilename } from './parse-filename';
import { predictNextNumber, ExistingMaterial } from './predict';

// 'pdf' and 'linked-class' are emitted by the UI layer (PDF-heading read and
// linked-class name inheritance), not by suggestMaterialFields itself, but they
// share this type so the UI's provenance tags stay in one vocabulary.
export type Provenance = 'filename' | 'last-used' | 'sequence' | 'default' | 'pdf' | 'linked-class' | null;

type SuggestibleField = 'course' | 'subject' | 'docType' | 'number' | 'topic';

export interface SuggestContext {
  /** Values the current admin last used, e.g. read via getLastUsed() before calling. */
  lastUsed?: {
    course?:  CourseKey  | null;
    subject?: SubjectKey | null;
    docType?: DocTypeKey | null;
  };
  /** Existing materials, for sequence prediction. */
  existing?: ExistingMaterial[];
}

export interface MaterialSuggestion {
  course:  CourseKey  | null;
  subject: SubjectKey | null;
  docType: DocTypeKey | null;
  number:  string      | null;
  topic:   string      | null;
  title:   string      | null;
  provenance: Record<SuggestibleField, Provenance>;
  confidence: Record<SuggestibleField, number>;
}

// Confidence scale (0-1): filename parsing is near-certain, sequence
// prediction and last-used are reasonable guesses, default is a fallback
// with no real signal behind it, null (no value) is 0.
const CONFIDENCE: Record<Exclude<Provenance, null>, number> = {
  'linked-class': 0.9,
  filename: 0.95,
  sequence: 0.6,
  'last-used': 0.5,
  pdf: 0.5,
  default: 0.3,
};

export function suggestMaterialFields(fileName: string, ctx: SuggestContext = {}): MaterialSuggestion {
  const parsed = parseFilename(fileName);

  const provenance: Record<SuggestibleField, Provenance> = {
    course: parsed.course ? 'filename' : null,
    subject: parsed.subject ? 'filename' : null,
    docType: parsed.docType ? 'filename' : null,
    number: parsed.number ? 'filename' : null,
    topic: parsed.topic ? 'filename' : null,
  };

  let course = parsed.course;
  let subject = parsed.subject;
  let docType = parsed.docType;
  let number = parsed.number;
  const topic = parsed.topic; // no last-used/sequence layer for topic

  // Layer 2 — sticky last-used, for any field still null.
  if (course === null && ctx.lastUsed?.course) {
    course = ctx.lastUsed.course;
    provenance.course = 'last-used';
  }
  if (subject === null && ctx.lastUsed?.subject) {
    subject = ctx.lastUsed.subject;
    provenance.subject = 'last-used';
  }
  if (docType === null && ctx.lastUsed?.docType) {
    docType = ctx.lastUsed.docType;
    provenance.docType = 'last-used';
  }

  // Layer 3 — sequence, for number specifically.
  if (number === null && ctx.existing) {
    const next = predictNextNumber(ctx.existing, { course, subject, docType });
    if (next) {
      number = next;
      provenance.number = 'sequence';
    }
  }

  // Course default — only course in the taxonomy.
  if (course === null && COURSES.length === 1) {
    course = COURSES[0].key;
    provenance.course = 'default';
  }

  const confidence: Record<SuggestibleField, number> = {
    course: provenance.course ? CONFIDENCE[provenance.course] : 0,
    subject: provenance.subject ? CONFIDENCE[provenance.subject] : 0,
    docType: provenance.docType ? CONFIDENCE[provenance.docType] : 0,
    number: provenance.number ? CONFIDENCE[provenance.number] : 0,
    topic: provenance.topic ? CONFIDENCE[provenance.topic] : 0,
  };

  const title = course && subject && docType
    ? formatMaterialName({ course, subject, docType, number, topic })
    : null;

  return { course, subject, docType, number, topic, title, provenance, confidence };
}
