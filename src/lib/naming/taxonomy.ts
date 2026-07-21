/**
 * Naming taxonomy — single source of truth for courses, subjects, doc types,
 * and batches. Every entry has a stable `key` (what's stored in the DB) and
 * a display `label` (what users see). Materials, classes, filters, and the
 * name generator all read from these lists — adding a course, subject, or
 * batch is a one-line change here.
 */

export const COURSES = [
  { key: 'iba', label: 'IBA' },
] as const;

export const SUBJECTS = [
  { key: 'math', label: 'Math' },
  { key: 'english', label: 'English' },
  { key: 'analytical', label: 'Analytical' },
] as const;

export const DOC_TYPES = [
  { key: 'lecture', label: 'Lecture' },
  { key: 'solution', label: 'Solution' },
  { key: 'question_paper', label: 'Question Paper' },
  { key: 'notes', label: 'Notes' },
  { key: 'homework', label: 'Homework' },
  { key: 'practice', label: 'Practice Set' },
] as const;

export const BATCHES = [
  { key: '2026-27', label: '2026-27' },
] as const;

export type CourseKey  = typeof COURSES[number]['key'];
export type SubjectKey = typeof SUBJECTS[number]['key'];
export type DocTypeKey = typeof DOC_TYPES[number]['key'];
export type BatchKey   = typeof BATCHES[number]['key'];
