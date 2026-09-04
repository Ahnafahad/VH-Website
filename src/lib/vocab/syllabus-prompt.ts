import { db, vocabSyllabuses } from '@/lib/db';

/**
 * Stable version string for "the full current set of syllabuses" — changes
 * whenever a syllabus is added or removed. Compared against a user's stored
 * `lastAnnouncementSeen` to detect existing users who haven't been asked
 * about newly-added syllabuses yet.
 */
export async function getSyllabusCatalogVersion(): Promise<string> {
  const rows = await db.select({ id: vocabSyllabuses.id }).from(vocabSyllabuses);
  return rows.map(r => r.id).sort((a, b) => a - b).join('-');
}
