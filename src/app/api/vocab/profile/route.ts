/**
 * PATCH /api/vocab/profile
 * Updates the authenticated user's profile settings.
 * Accepts any combination of:
 *   { name }                                         — display name
 *   { deadline, recalculateDailyTarget }             — study deadline
 *   { notificationsEnabled }                         — push notifications toggle
 *   { emailSummaryEnabled }                          — weekly email summary toggle
 *   { cardPrefs }                                    — flashcard style (see card-prefs.ts)
 */

import { NextRequest } from 'next/server';
import { eq, count } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { users, vocabUserProgress, vocabWords } from '@/lib/db/schema';
import { safeApiHandler, validateAuth, ApiException } from '@/lib/api-utils';
import { revalidateTag } from 'next/cache';
import { VocabCacheTag } from '@/lib/vocab/cache-keys';

// ─── Zod schema ───────────────────────────────────────────────────────────────

const schema = z.object({
  name:                    z.string().min(1).max(100).trim().optional(),
  deadline:                z.string().datetime({ offset: true }).nullable().optional(),
  recalculateDailyTarget:  z.boolean().optional(),
  notificationsEnabled:    z.boolean().optional(),
  emailSummaryEnabled:     z.boolean().optional(),
  // Dismisses the post-full-access-upgrade "set a target date" prompt without setting a deadline.
  dismissFullAccessDeadlinePrompt: z.boolean().optional(),
  // Flashcard style. Sent whole, not per-field: the card is edited as one thing.
  cardPrefs: z.object({
    definitionVariant: z.enum(['standard', 'alt']),
    showExample:       z.boolean(),
    showSynonyms:      z.boolean(),
    showConnotation:   z.boolean(),
    showContrast:      z.boolean(),
  }).optional(),
});

// ─── Daily target helper ──────────────────────────────────────────────────────

function calcDailyTarget(deadline: Date, totalWords: number, masteredWords: number): number {
  const remaining = Math.max(0, totalWords - masteredWords);
  const msPerDay  = 1000 * 60 * 60 * 24;
  const daysLeft  = Math.ceil((deadline.getTime() - Date.now()) / msPerDay);
  if (daysLeft <= 0) return Math.max(1, remaining);
  return Math.max(1, Math.ceil(remaining / daysLeft));
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  return safeApiHandler(async () => {
    const { email } = await validateAuth();

    const body   = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new ApiException(
        'Invalid request body: ' + (parsed.error.issues[0]?.message ?? 'unknown'),
        400,
      );
    }

    const data = parsed.data;

    if (
      data.name                             === undefined &&
      data.deadline                         === undefined &&
      data.notificationsEnabled             === undefined &&
      data.emailSummaryEnabled              === undefined &&
      data.dismissFullAccessDeadlinePrompt  === undefined &&
      data.cardPrefs                        === undefined
    ) {
      throw new ApiException('No fields to update', 400);
    }

    // Resolve user row
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (!user) throw new ApiException('User not found', 404);

    // ── Name ─────────────────────────────────────────────────────────────────
    if (data.name !== undefined) {
      await db
        .update(users)
        .set({ name: data.name, updatedAt: new Date() })
        .where(eq(users.id, user.id));
    }

    // ── Progress-level fields ────────────────────────────────────────────────
    const hasDeadline       = data.deadline             !== undefined;
    const hasNotifications  = data.notificationsEnabled !== undefined;
    const hasEmail          = data.emailSummaryEnabled  !== undefined;
    const hasDismiss        = data.dismissFullAccessDeadlinePrompt === true;
    const hasCardPrefs      = data.cardPrefs !== undefined;

    if (hasDeadline || hasNotifications || hasEmail || hasDismiss || hasCardPrefs) {
      // Build a typed partial object matching Drizzle's inferred insert type
      type ProgressUpdate = {
        deadline?:                Date | null;
        dailyTarget?:             number;
        notificationsEnabled?:    boolean;
        emailSummaryEnabled?:     boolean;
        fullAccessDeadlineSetAt?: Date;
        cardDefinitionVariant?:   string;
        cardShowExample?:         boolean;
        cardShowSynonyms?:        boolean;
        cardShowConnotation?:     boolean;
        cardShowContrast?:        boolean;
        updatedAt:                Date;
      };

      const update: ProgressUpdate = { updatedAt: new Date() };

      if (data.cardPrefs) {
        // Cached study sessions embed the prefs — drop them all, or the new
        // card style would not appear for up to the cache TTL.
        revalidateTag(VocabCacheTag.flashcardAll(email));
        update.cardDefinitionVariant = data.cardPrefs.definitionVariant;
        update.cardShowExample       = data.cardPrefs.showExample;
        update.cardShowSynonyms      = data.cardPrefs.showSynonyms;
        update.cardShowConnotation   = data.cardPrefs.showConnotation;
        update.cardShowContrast      = data.cardPrefs.showContrast;
      }

      if (hasDeadline) {
        update.deadline = data.deadline ? new Date(data.deadline) : null;
        // Setting a deadline resolves the post-upgrade "set a target date" prompt too.
        update.fullAccessDeadlineSetAt = new Date();

        // Recalculate daily target when a new deadline is set
        if (data.recalculateDailyTarget && data.deadline) {
          // Get current progress for mastered word count
          const [prog] = await db
            .select({ dailyTarget: vocabUserProgress.dailyTarget })
            .from(vocabUserProgress)
            .where(eq(vocabUserProgress.userId, user.id))
            .limit(1);

          void prog; // We derive target from deadline ÷ remaining words
          const [{ totalWords }] = await db.select({ totalWords: count() }).from(vocabWords);
          update.dailyTarget = calcDailyTarget(new Date(data.deadline), totalWords, 0);
        }
      }

      if (hasDismiss)       update.fullAccessDeadlineSetAt = new Date();
      if (hasNotifications) update.notificationsEnabled = data.notificationsEnabled!;
      if (hasEmail)         update.emailSummaryEnabled  = data.emailSummaryEnabled!;

      await db
        .update(vocabUserProgress)
        .set(update)
        .where(eq(vocabUserProgress.userId, user.id));
    }

    return { ok: true, name: data.name };
  }, '/api/vocab/profile');
}
