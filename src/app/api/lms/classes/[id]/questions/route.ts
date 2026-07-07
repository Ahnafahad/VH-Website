/**
 * GET  /api/lms/classes/[id]/questions — list Q&A threads for a class
 * POST /api/lms/classes/[id]/questions — post a question (student or staff)
 */

import { NextRequest } from 'next/server';
import { eq, isNull, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { classSessions, classQuestions, users } from '@/lib/db/schema';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireUser } from '@/lib/tests/route-helpers';
import { canAccessLmsContent } from '@/lib/lms/access';

const MAX_BODY_LENGTH = 2000;

function isStaffRole(role: string) {
  return role === 'admin' || role === 'super_admin' || role === 'instructor';
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    const user = await requireUser();
    const { id } = await params;
    const sessionId = parseInt(id, 10);
    if (isNaN(sessionId)) throw new ApiException('Invalid id', 400);

    const classSession = await db
      .select()
      .from(classSessions)
      .where(eq(classSessions.id, sessionId))
      .get();
    if (!classSession) throw new ApiException('Class not found', 404);

    if (
      !canAccessLmsContent(user, {
        product: classSession.product,
        batch: classSession.batch,
      })
    ) {
      throw new ApiException('Access denied', 403, 'FORBIDDEN');
    }

    // Load all questions + answers for this session, joined with user info
    const rows = await db
      .select({
        id: classQuestions.id,
        parentId: classQuestions.parentId,
        body: classQuestions.body,
        createdAt: classQuestions.createdAt,
        userId: classQuestions.userId,
        userName: users.name,
        userRole: users.role,
      })
      .from(classQuestions)
      .innerJoin(users, eq(classQuestions.userId, users.id))
      .where(eq(classQuestions.sessionId, sessionId))
      .orderBy(classQuestions.createdAt);

    // Build threads: top-level (parentId null) + answers nested
    const topLevel = rows.filter((r) => r.parentId === null || r.parentId === undefined);
    const answerMap = new Map<number, typeof rows>();
    for (const row of rows) {
      if (row.parentId !== null && row.parentId !== undefined) {
        if (!answerMap.has(row.parentId)) answerMap.set(row.parentId, []);
        answerMap.get(row.parentId)!.push(row);
      }
    }

    const threads = topLevel.map((q) => ({
      id: q.id,
      body: q.body,
      createdAt: q.createdAt.getTime(),
      userId: q.userId,
      userName: q.userName,
      isStaff: isStaffRole(q.userRole),
      isOwn: q.userId === user.id,
      answers: (answerMap.get(q.id) ?? []).map((a) => ({
        id: a.id,
        body: a.body,
        createdAt: a.createdAt.getTime(),
        userId: a.userId,
        userName: a.userName,
        isStaff: isStaffRole(a.userRole),
        isOwn: a.userId === user.id,
      })),
    }));

    return { threads, sessionId };
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    const user = await requireUser();
    const { id } = await params;
    const sessionId = parseInt(id, 10);
    if (isNaN(sessionId)) throw new ApiException('Invalid id', 400);

    const classSession = await db
      .select()
      .from(classSessions)
      .where(eq(classSessions.id, sessionId))
      .get();
    if (!classSession) throw new ApiException('Class not found', 404);

    if (
      !canAccessLmsContent(user, {
        product: classSession.product,
        batch: classSession.batch,
      })
    ) {
      throw new ApiException('Access denied', 403, 'FORBIDDEN');
    }

    const body = (await req.json()) as { body?: string };
    const text = typeof body.body === 'string' ? body.body.trim() : '';
    if (!text) throw new ApiException('Question body is required', 400);
    if (text.length > MAX_BODY_LENGTH) {
      throw new ApiException(`Question must be at most ${MAX_BODY_LENGTH} characters`, 400);
    }

    const [inserted] = await db
      .insert(classQuestions)
      .values({
        sessionId,
        userId: user.id,
        parentId: null,
        body: text,
      })
      .returning();

    return {
      id: inserted.id,
      sessionId: inserted.sessionId,
      userId: inserted.userId,
      userName: user.name,
      isStaff: isStaffRole(user.role),
      isOwn: true,
      body: inserted.body,
      createdAt: inserted.createdAt.getTime(),
      answers: [],
    };
  });
}
