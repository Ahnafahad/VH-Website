import { db } from '@/lib/db';
import { vocabWords } from '@/lib/db/schema';
import { unstable_cache } from 'next/cache';

/** Revalidated by admin word mutations (create/update/delete/import). */
export const WORD_BANK_TAG = 'vocab-word-bank';

type VocabWordRow = typeof vocabWords.$inferSelect;

/**
 * Full word bank, cached across requests. The bank only changes on admin
 * edits, yet quiz generation was re-fetching every row from Turso on each
 * session — the dominant DB cost on the quiz critical path.
 *
 * Note: unstable_cache JSON-serializes, so Date columns come back as ISO
 * strings — callers here only consume text/id fields, which is safe.
 */
export const getAllWordsCached = unstable_cache(
  async (): Promise<VocabWordRow[]> => db.select().from(vocabWords),
  ['vocab-all-words'],
  { revalidate: 3600, tags: [WORD_BANK_TAG] },
);
