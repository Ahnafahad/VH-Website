import { and, desc, eq, lte } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { classSessions, operationalEntries, operationalExtraClasses, users } from '@/lib/db/schema';
import { ApiException } from '@/lib/api-utils';
import {
  buildInstructorReport, extraClassInput, financialEntryInput, operationalSections,
  type OperationalSection,
} from './operations';

export function parseOperationalSection(value: string): OperationalSection {
  if (!(operationalSections as readonly string[]).includes(value)) {
    throw new ApiException('Section not found', 404);
  }
  return value as OperationalSection;
}

export function parseOperationalId(value: string): number {
  const id = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(id) || id < 1) {
    throw new ApiException('Invalid record ID', 400);
  }
  return id;
}

function parseInput<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new ApiException(result.error.issues[0].message, 400);
  return result.data;
}

export async function readOperationalSection(section: OperationalSection) {
  if (section === 'instructors') {
    const now = new Date();
    const [sessions, teachingUsers] = await Promise.all([
      db.select({
        instructorId: classSessions.instructorId, instructorName: users.name,
        scheduledAt: classSessions.scheduledAt, status: classSessions.status,
      }).from(classSessions).leftJoin(users, eq(classSessions.instructorId, users.id))
        .where(and(eq(classSessions.status, 'completed'), lte(classSessions.scheduledAt, now))),
      db.select({ id: users.id, name: users.name }).from(users).where(eq(users.isTeaching, true)),
    ]);
    return { report: buildInstructorReport(sessions, teachingUsers, now) };
  }
  if (section === 'extra-classes') {
    const [rows, instructors] = await Promise.all([
      db.select({ record: operationalExtraClasses, instructorName: users.name })
        .from(operationalExtraClasses).leftJoin(users, eq(operationalExtraClasses.instructorId, users.id))
        .orderBy(desc(operationalExtraClasses.startsAt), desc(operationalExtraClasses.id)),
      db.select({ id: users.id, name: users.name }).from(users)
        .where(eq(users.isTeaching, true)).orderBy(users.name),
    ]);
    return {
      classes: rows.map(({ record, instructorName }) => ({
        ...record, instructorName, startsAt: record.startsAt.toISOString(), endsAt: record.endsAt.toISOString(),
      })),
      instructors,
    };
  }
  const kind = section === 'expenses' ? 'expense' : 'income';
  const entries = await db.select().from(operationalEntries).where(eq(operationalEntries.kind, kind))
    .orderBy(desc(operationalEntries.date), desc(operationalEntries.id));
  return { entries };
}

export async function saveOperationalRecord(
  section: OperationalSection, body: unknown, adminId: number, id?: number,
) {
  if (section === 'instructors') throw new ApiException('Instructor report is read-only', 405);
  if (section === 'extra-classes') {
    const input = parseInput(extraClassInput, body);
    const existing = id === undefined ? undefined : await db.select().from(operationalExtraClasses)
      .where(eq(operationalExtraClasses.id, id)).get();
    if (id !== undefined && !existing) throw new ApiException('Extra class not found', 404);
    const instructor = await db.select({ id: users.id, isTeaching: users.isTeaching }).from(users)
      .where(eq(users.id, input.instructorId)).get();
    if (!instructor || (!instructor.isTeaching && existing?.instructorId !== input.instructorId)) {
      throw new ApiException('Select a teaching instructor', 400);
    }
    const values = { ...input, startsAt: new Date(input.startsAt), endsAt: new Date(input.endsAt) };
    const [saved] = id === undefined
      ? await db.insert(operationalExtraClasses).values({ ...values, createdBy: adminId }).returning()
      : await db.update(operationalExtraClasses).set({ ...values, updatedAt: new Date() })
        .where(eq(operationalExtraClasses.id, id)).returning();
    if (!saved) throw new ApiException('Extra class not found', 404);
    return { id: saved.id };
  }
  const input = parseInput(financialEntryInput, body);
  const kind = section === 'expenses' ? 'expense' : 'income';
  const values = { kind, date: input.date, amountMinor: input.amount, category: input.category, description: input.description } as const;
  const [saved] = id === undefined
    ? await db.insert(operationalEntries).values({ ...values, createdBy: adminId }).returning()
    : await db.update(operationalEntries).set({ ...values, updatedAt: new Date() })
      .where(and(eq(operationalEntries.id, id), eq(operationalEntries.kind, kind))).returning();
  if (!saved) throw new ApiException('Entry not found', 404);
  return { id: saved.id };
}
