/**
 * Client-safe subject constants — no DB imports here. Anything that needs
 * to import subject info from a 'use client' component must come from this
 * file, not subject-data.ts (which pulls in the DB client and would leak
 * server-only code into the browser bundle).
 */

import type { LmsSubject } from '@/lib/db/schema';

export const SUBJECTS: readonly LmsSubject[] = ['english', 'math', 'analytical'];

export function isLmsSubject(value: string): value is LmsSubject {
  return (SUBJECTS as readonly string[]).includes(value);
}

export const SUBJECT_LABELS: Record<LmsSubject, string> = {
  english: 'English',
  math: 'Math',
  analytical: 'Analytical',
};
