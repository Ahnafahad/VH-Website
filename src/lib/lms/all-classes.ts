/**
 * Fetch layer for the student "all classes" calendar view
 * (/dashboard/classes). One query for scoped sessions, plus lightweight
 * recording-status / materials-existence flags — the actual materials list,
 * recording player, and Q&A live on the per-class detail page
 * (/dashboard/classes/[id]), which already handles access gating.
 */

import { db } from '@/lib/db';
import { classSessions, materials, recordings } from '@/lib/db/schema';
import type { UserWithProducts, UserProduct } from '@/lib/db/schema';
import { and, eq, inArray, or, sql } from 'drizzle-orm';
import { lmsScopeConditions } from './access';
import { getDisplayClassNumbers } from './class-numbering';

export interface CalendarClass {
  id: number;
  title: string;
  subject: string;
  classNumber: number | null;
  scheduledAt: number; // epoch ms
  durationMinutes: number;
  status: string;
  hasMaterials: boolean;
  recording: { status: string } | null;
}

export async function getAllClasses(
  user: UserWithProducts,
  product?: UserProduct,
): Promise<CalendarClass[]> {
  const scope = lmsScopeConditions(user, classSessions, product);

  const sessions = await db
    .select({
      id: classSessions.id,
      title: classSessions.title,
      subject: classSessions.subject,
      scheduledAt: classSessions.scheduledAt,
      durationMinutes: classSessions.durationMinutes,
      status: classSessions.status,
    })
    .from(classSessions)
    .where(
      and(
        ...scope,
        or(
          eq(classSessions.status, 'scheduled'),
          eq(classSessions.status, 'live'),
          eq(classSessions.status, 'completed'),
        ),
      ),
    )
    .orderBy(classSessions.scheduledAt);

  if (sessions.length === 0) return [];

  const ids = sessions.map((s) => s.id);
  const [classNumbers, materialCounts, recordingRows] = await Promise.all([
    getDisplayClassNumbers(),
    db
      .select({ classSessionId: materials.classSessionId, value: sql<number>`count(*)` })
      .from(materials)
      .where(inArray(materials.classSessionId, ids))
      .groupBy(materials.classSessionId),
    db
      .select({ classSessionId: recordings.classSessionId, status: recordings.status })
      .from(recordings)
      .where(inArray(recordings.classSessionId, ids)),
  ]);

  const materialsSet = new Set(
    materialCounts.filter((m) => (m.value ?? 0) > 0).map((m) => m.classSessionId),
  );
  const recordingMap = new Map(recordingRows.map((r) => [r.classSessionId, r.status]));

  return sessions.map((s) => ({
    id: s.id,
    title: s.title,
    subject: s.subject,
    classNumber: classNumbers.get(s.id) ?? null,
    scheduledAt: s.scheduledAt.getTime(),
    durationMinutes: s.durationMinutes,
    status: s.status,
    hasMaterials: materialsSet.has(s.id),
    recording: recordingMap.has(s.id) ? { status: recordingMap.get(s.id)! } : null,
  }));
}
