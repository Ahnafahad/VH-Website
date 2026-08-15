/**
 * Client-safe subject constants — no DB imports here. Anything that needs
 * to import subject info from a 'use client' component must come from this
 * file, not subject-data.ts (which pulls in the DB client and would leak
 * server-only code into the browser bundle).
 */

import type { LmsSubject, UserProduct } from '@/lib/db/schema';

/** Every subject this LMS knows about, across all products. */
export const SUBJECTS: readonly LmsSubject[] = [
  'english', 'math', 'analytical',
  'accounting', 'economics', 'business_studies',
];

/** Which subjects belong to which product — powers the dashboard subject-hub. */
export const SUBJECTS_BY_PRODUCT: Record<UserProduct, readonly LmsSubject[]> = {
  iba: ['english', 'math', 'analytical'],
  fbs: ['accounting', 'economics', 'business_studies'],
  fbs_detailed: ['accounting', 'economics', 'business_studies'],
};

export function isLmsSubject(value: string): value is LmsSubject {
  return (SUBJECTS as readonly string[]).includes(value);
}

export const SUBJECT_LABELS: Record<LmsSubject, string> = {
  english: 'English',
  math: 'Math',
  analytical: 'Analytical',
  accounting: 'Accounting',
  economics: 'Economics',
  business_studies: 'Business Studies',
};

/** Reverse lookup: which product a subject belongs to (undefined if unknown). */
export function productForSubject(subject: LmsSubject): UserProduct | undefined {
  return (Object.keys(SUBJECTS_BY_PRODUCT) as UserProduct[]).find((p) =>
    SUBJECTS_BY_PRODUCT[p].includes(subject),
  );
}
