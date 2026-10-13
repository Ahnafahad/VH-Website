import { and, desc, eq, inArray, lte } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { classSessions, operationalEntries, operationalExtraClasses, users } from '@/lib/db/schema';
import { ApiException } from '@/lib/api-utils';
import {
  buildInstructorReport, expenseEntryInput, extraClassInput, financialEntryInput, operationalSections,
  isOperationalAdmin, type FinancialEntryRecord, type OperationalSection,
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
  const entries = await listEntries(kind);
  if (kind === 'income') return { entries };
  const [payers, classes] = await Promise.all([
    db.select({ id: users.id, name: users.name }).from(users)
      .where(inArray(users.role, ['admin', 'super_admin'])).orderBy(users.name),
    db.select({ id: classSessions.id, title: classSessions.title, scheduledAt: classSessions.scheduledAt })
      .from(classSessions).orderBy(desc(classSessions.scheduledAt)).limit(120),
  ]);
  return { entries, payers, classes: classes.map(c => ({ id: c.id, label: classLabel(c.title, c.scheduledAt) })) };
}

const classLabel = (title: string, at: Date) =>
  `${title} (${new Date(at.getTime() + 6 * 60 * 60 * 1000).toISOString().slice(0, 10)})`;

async function listEntries(kind: 'expense' | 'income'): Promise<FinancialEntryRecord[]> {
  const rows = await db.select({
    entry: operationalEntries, paidByName: users.name, classTitle: classSessions.title, classAt: classSessions.scheduledAt,
  }).from(operationalEntries)
    .leftJoin(users, eq(operationalEntries.paidBy, users.id))
    .leftJoin(classSessions, eq(operationalEntries.classSessionId, classSessions.id))
    .where(eq(operationalEntries.kind, kind))
    .orderBy(desc(operationalEntries.date), desc(operationalEntries.id));
  return rows.map(({ entry, paidByName, classTitle, classAt }) => ({
    id: entry.id, date: entry.date, amountMinor: entry.amountMinor, category: entry.category,
    description: entry.description, paidBy: entry.paidBy, paidByName, reimbursedAt: entry.reimbursedAt,
    payee: entry.payee, paymentMethod: entry.paymentMethod, referenceNo: entry.referenceNo,
    receiptKey: entry.receiptKey, product: entry.product, batch: entry.batch,
    classSessionId: entry.classSessionId, classLabel: classTitle && classAt ? classLabel(classTitle, classAt) : null,
    location: entry.location, tags: entry.tags ? entry.tags.split(',') : [],
    updatedAt: entry.updatedAt.toISOString(),
  }));
}

export async function listExpenseEntries() {
  return listEntries('expense');
}

export async function deleteOperationalRecord(section: OperationalSection, id: number) {
  if (section === 'instructors') throw new ApiException('Instructor report is read-only', 405);
  const [deleted] = section === 'extra-classes'
    ? await db.delete(operationalExtraClasses).where(eq(operationalExtraClasses.id, id)).returning()
    : await db.delete(operationalEntries).where(and(
      eq(operationalEntries.id, id), eq(operationalEntries.kind, section === 'expenses' ? 'expense' : 'income'),
    )).returning();
  if (!deleted) throw new ApiException('Record not found', 404);
  return { deleted: true };
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
  const kind = section === 'expenses' ? 'expense' : 'income';
  const base = { kind, ...(kind === 'expense' ? {} : { paidBy: null, reimbursedAt: null }) } as const;
  let values;
  if (kind === 'expense') {
    const input = parseInput(expenseEntryInput, body);
    if (input.paidBy !== null) {
      const payer = await db.select({ role: users.role }).from(users).where(eq(users.id, input.paidBy)).get();
      if (!payer || !isOperationalAdmin(payer.role)) throw new ApiException('Select an admin as the payer', 400);
    }
    if (input.classSessionId !== null) {
      const linked = await db.select({ id: classSessions.id }).from(classSessions)
        .where(eq(classSessions.id, input.classSessionId)).get();
      if (!linked) throw new ApiException('Linked class not found', 400);
    }
    const { amount, ...rest } = input;
    values = { ...base, ...rest, amountMinor: amount, updatedBy: adminId };
  } else {
    const input = parseInput(financialEntryInput, body);
    values = { ...base, date: input.date, amountMinor: input.amount, category: input.category, description: input.description };
  }
  const [saved] = id === undefined
    ? await db.insert(operationalEntries).values({ ...values, createdBy: adminId }).returning()
    : await db.update(operationalEntries).set({ ...values, updatedAt: new Date() })
      .where(and(eq(operationalEntries.id, id), eq(operationalEntries.kind, kind))).returning();
  if (!saved) throw new ApiException('Entry not found', 404);
  return { id: saved.id };
}
