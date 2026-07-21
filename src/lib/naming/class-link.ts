/**
 * Pure helpers for the material↔class name link. Kept out of the UI component
 * so the data-safety rule — never overwrite a class that already has a real
 * name — is unit-testable in isolation.
 */

import { formatClassName } from './format-name';
import { COURSES, SUBJECTS, DOC_TYPES, CourseKey, SubjectKey, DocTypeKey } from './taxonomy';

/** Minimal shape needed to judge a class's name; ClassSession satisfies it. */
export interface ClassNameSource {
  title: string;
  subject: string;
  topic: string | null;
}

/**
 * The human-readable lesson name a class carries, if any: its explicit topic,
 * else the text after the last " – "/" - " in the title, else null. A bare
 * generic title — "Thursday Class", "English Class 3" — has no lesson name.
 */
export function classUsableName(session: ClassNameSource | null): string | null {
  if (!session) return null;
  if (session.topic && session.topic.trim()) return session.topic.trim();
  const m = session.title.match(/\s[–-]\s(.+)$/);
  return m ? m[1].trim() : null;
}

// A class with a real lesson name is protected; anything else (no dash-name,
// no topic) is fixable when a material is attached — this is what the user
// means by "Thursday Class or English Class needs to be treated".
function docTypeLabel(k: DocTypeKey): string {
  return DOC_TYPES.find(d => d.key === k)?.label ?? k;
}
function trailingInt(s: string): number | null {
  const m = s.match(/(\d+)\s*$/);
  return m ? Number(m[1]) : null;
}

/** A class as it exists in the DB, for the rename planner. */
export interface ClassForRename {
  title: string;
  subject: string;
  topic: string | null;
  product: string;
  classNumber: number | null;
}
/** The attached material's naming facts (raw form values; strings may be blank). */
export interface MaterialFacts {
  course: CourseKey;
  subject: SubjectKey;
  docType: DocTypeKey | null;
  number: string;
  topic: string;
}

/**
 * Plan a class's rename from the material just attached to it. Returns null —
 * meaning "do not touch" — when the class already has a real lesson name.
 * Otherwise the class inherits: its subject (only if currently unset/'tbd'),
 * a name from the material's topic (or its type+number when there is no prose
 * topic), the trailing number already in its title, and a canonical title.
 */
export function planClassRenameFromMaterial(
  cls: ClassForRename,
  mat: MaterialFacts,
): { subject: SubjectKey; topic: string | null; classNumber: number | null; title: string } | null {
  if (classUsableName(cls) !== null) return null; // protected — already named
  const course = COURSES.find(c => c.key === cls.product)?.key ?? mat.course;
  const subject = (SUBJECTS.find(s => s.key === cls.subject)?.key) ?? mat.subject;
  const topic = mat.topic.trim()
    || (mat.docType && mat.number.trim() ? `${docTypeLabel(mat.docType)} ${mat.number.trim()}` : null);
  const classNumber = cls.classNumber ?? trailingInt(cls.title);
  const title = formatClassName({ course, subject, classNumber, topic });
  return { subject, topic, classNumber, title };
}

/**
 * PDF headings are frequently junk (logos, page numbers, whole sentences).
 * Returns a trimmed heading only when it looks like a real short title.
 */
export function cleanHeading(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const h = raw.trim();
  if (h.length < 3 || h.length > 60) return null;         // too short / a paragraph
  if (!/[a-z]/i.test(h)) return null;                     // no letters at all
  if (/^\d+$/.test(h)) return null;                       // just a number
  if (/^page\s*\d+/i.test(h)) return null;                // "Page 3"
  if (/beyond the horizons|\bbth\b/i.test(h)) return null; // brand noise
  if (h.split(/\s+/).length > 8) return null;             // a sentence, not a title
  return h;
}
