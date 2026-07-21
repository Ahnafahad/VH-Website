/**
 * Pure name-assembly functions. No I/O — given structured fields, produces
 * the display name used for materials and class sessions.
 *
 * Format: [COURSE] [SUBJECT] [TYPE] [NUMBER] — [TOPIC]
 * The em-dash and topic are both omitted when there's no topic.
 */

import { COURSES, SUBJECTS, DOC_TYPES, CourseKey, SubjectKey, DocTypeKey } from './taxonomy';

function labelFor<K extends string>(list: readonly { key: K; label: string }[], key: K): string {
  return list.find(item => item.key === key)?.label ?? key;
}

export interface FormatMaterialNameInput {
  course:  CourseKey;
  subject: SubjectKey;
  docType: DocTypeKey;
  number?: string | null;
  topic?:  string | null;
}

/** e.g. "IBA Math Lecture 1.3" or "IBA English Lecture 4 — Advanced Sentence Structures" */
export function formatMaterialName(input: FormatMaterialNameInput): string {
  const parts = [
    labelFor(COURSES, input.course),
    labelFor(SUBJECTS, input.subject),
    labelFor(DOC_TYPES, input.docType),
  ];
  if (input.number) parts.push(input.number);

  let name = parts.join(' ');
  if (input.topic) name += ` — ${input.topic}`;
  return name;
}

export interface FormatClassNameInput {
  course:       CourseKey;
  subject:      SubjectKey;
  classNumber?: number | null;
  topic?:       string | null;
}

/** e.g. "IBA Math Class 3 — Lecture 1.3" */
export function formatClassName(input: FormatClassNameInput): string {
  const parts = [
    labelFor(COURSES, input.course),
    labelFor(SUBJECTS, input.subject),
    'Class',
  ];
  if (input.classNumber != null) parts.push(String(input.classNumber));

  let name = parts.join(' ');
  if (input.topic) name += ` — ${input.topic}`;
  return name;
}
