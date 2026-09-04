/**
 * PATCH /api/vocab/syllabuses
 *
 * Manages a user's `vocab_user_syllabuses` selection. Backs two different UI
 * surfaces:
 *   { action: 'add',  syllabusIds }  — the "new syllabuses" interstitial:
 *     additively insert the chosen ones, mark the current catalog as seen.
 *   { action: 'skip' }               — interstitial dismissed without adding
 *     anything; still marks the current catalog as seen so it doesn't recur.
 *   { action: 'set',  syllabusIds }  — the Study/Practice checkbox filter:
 *     replaces the full selection (delete-then-insert, same as onboarding).
 *
 * Any change alters which words are unlocked (access-check.ts), so every
 * branch busts the caches that read word access.
 */

import { NextRequest } from 'next/server';
import { eq, inArray } from 'drizzle-orm';
import { revalidateTag } from 'next/cache';
import { z } from 'zod';
import { db, users, vocabSyllabuses, vocabUserSyllabuses, vocabUserProgress } from '@/lib/db';
import { safeApiHandler, validateAuth, ApiException } from '@/lib/api-utils';
import { VocabCacheTag } from '@/lib/vocab/cache-keys';
import { getSyllabusCatalogVersion } from '@/lib/vocab/syllabus-prompt';

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('add'), syllabusIds: z.array(z.number().int().positive()).min(1) }),
  z.object({ action: z.literal('skip') }),
  z.object({ action: z.literal('set'), syllabusIds: z.array(z.number().int().positive()).min(1) }),
]);

export async function PATCH(req: NextRequest) {
  return safeApiHandler(async () => {
    const { email } = await validateAuth();

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      throw new ApiException('Invalid request body: ' + (parsed.error.issues[0]?.message ?? 'unknown'), 400);
    }
    const data = parsed.data;

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (!user) throw new ApiException('User not found', 404);

    if (data.action === 'add' || data.action === 'set') {
      const [progress] = await db
        .select({ syllabusLocked: vocabUserProgress.syllabusLocked })
        .from(vocabUserProgress)
        .where(eq(vocabUserProgress.userId, user.id))
        .limit(1);
      if (progress?.syllabusLocked) throw new ApiException('Your syllabus selection is fixed and can’t be changed', 403);
    }

    if (data.action === 'add' || data.action === 'skip') {
      if (data.action === 'add') {
        const valid = await db
          .select({ id: vocabSyllabuses.id })
          .from(vocabSyllabuses)
          .where(inArray(vocabSyllabuses.id, data.syllabusIds));
        if (valid.length > 0) {
          await db
            .insert(vocabUserSyllabuses)
            .values(valid.map(s => ({ userId: user.id, syllabusId: s.id })))
            .onConflictDoNothing();
        }
      }
      const catalogVersion = await getSyllabusCatalogVersion();
      await db
        .update(vocabUserProgress)
        .set({ lastAnnouncementSeen: catalogVersion, updatedAt: new Date() })
        .where(eq(vocabUserProgress.userId, user.id));
    } else {
      const valid = await db
        .select({ id: vocabSyllabuses.id })
        .from(vocabSyllabuses)
        .where(inArray(vocabSyllabuses.id, data.syllabusIds));
      if (valid.length === 0) throw new ApiException('No valid syllabus selected', 400);

      await db.delete(vocabUserSyllabuses).where(eq(vocabUserSyllabuses.userId, user.id));
      await db.insert(vocabUserSyllabuses)
        .values(valid.map(s => ({ userId: user.id, syllabusId: s.id })));
    }

    revalidateTag(VocabCacheTag.home(email));
    revalidateTag(VocabCacheTag.study(email));
    revalidateTag(VocabCacheTag.practiceUi(email));
    revalidateTag(VocabCacheTag.flashcardAll(email));
    revalidateTag(VocabCacheTag.letters(user.id));

    return { ok: true };
  }, '/api/vocab/syllabuses');
}
