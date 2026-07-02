/**
 * GET   /api/admin/tests/[id]/answer-key — admin: current keys per question
 * PATCH /api/admin/tests/[id]/answer-key — admin: set/override keys
 *   Body: { keys: { [questionId: string]: string | null } }
 * Editing keys after submissions re-scores every submitted attempt.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tests, testSections, testQuestions, testAttempts } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireUser } from '@/lib/tests/route-helpers';
import { scoreAttemptById } from '@/lib/tests/service';

async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== 'admin' && user.role !== 'super_admin') {
    throw new ApiException('Admin access required', 403);
  }
  return user;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    await requireAdmin();
    const id = parseInt((await params).id, 10);

    const rows = await db
      .select({
        id: testQuestions.id,
        number: testQuestions.number,
        sectionTitle: testSections.title,
        sectionOrder: testSections.order,
        correctKey: testQuestions.correctKey,
      })
      .from(testQuestions)
      .innerJoin(testSections, eq(testQuestions.sectionId, testSections.id))
      .where(eq(testSections.testId, id));

    return {
      questions: rows.sort((a, b) => a.sectionOrder - b.sectionOrder || a.number - b.number),
    };
  });
}

const bodySchema = z.object({
  keys: z.record(z.string(), z.string().max(2).nullable()),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    await requireAdmin();
    const id = parseInt((await params).id, 10);

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiException('Invalid body', 400);

    const test = await db.select().from(tests).where(eq(tests.id, id)).get();
    if (!test) throw new ApiException('Test not found', 404);

    // Only touch questions that belong to this test
    const owned = await db
      .select({ id: testQuestions.id })
      .from(testQuestions)
      .innerJoin(testSections, eq(testQuestions.sectionId, testSections.id))
      .where(eq(testSections.testId, id));
    const ownedIds = new Set(owned.map(q => q.id));

    let updated = 0;
    for (const [qidStr, key] of Object.entries(parsed.data.keys)) {
      const qid = parseInt(qidStr, 10);
      if (!ownedIds.has(qid)) continue;
      await db.update(testQuestions)
        .set({ correctKey: key })
        .where(eq(testQuestions.id, qid));
      updated++;
    }

    // Re-score all submitted attempts against the new key
    const submitted = await db.select().from(testAttempts).where(
      and(eq(testAttempts.testId, id), eq(testAttempts.status, 'submitted')),
    );
    for (const attempt of submitted) {
      const score = await scoreAttemptById(attempt.id, id);
      await db.update(testAttempts).set({
        totalScore: score.totalScore,
        totalCorrect: score.totalCorrect,
        totalWrong: score.totalWrong,
        totalUnattempted: score.totalUnattempted,
        sectionScores: JSON.stringify(score.sections),
      }).where(eq(testAttempts.id, attempt.id));
    }

    return { updated, rescored: submitted.length };
  });
}
