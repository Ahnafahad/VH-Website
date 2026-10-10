/**
 * Essays service — every DB read/write for the Essays module.
 *
 * Lifecycle of one script (essay_submissions row):
 *   submitted ──grade──▶ graded   (marks editable afterwards; changes audited)
 *       │
 *       └──reject──▶ rejected ──student resubmits (even after the deadline)──▶ submitted
 *
 * A series auto-publishes (published_at set, students notified) the first time
 * its deadline has passed and no script is left in 'submitted'. After that,
 * a newly graded script (a resubmission) is visible to its student as soon as
 * it is graded.
 *
 * Grading writes require the caller to hold the script's lock (10 idle
 * minutes, renewed by every write and by the marking page's heartbeat).
 */

import { after } from 'next/server';
import { and, asc, desc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  auditLog,
  essayCommentBank,
  essayPages,
  essaySeries,
  essaySubmissions,
  users,
  type EssaySeries,
  type EssaySubmission,
  type UserProduct,
  type UserWithProducts,
} from '@/lib/db/schema';
import { ApiException } from '@/lib/api-utils';
import { recordAudit } from '@/lib/audit-log';
import { resolveAudience, isAudienceProduct } from '@/lib/audience/resolve';
import { lmsScopeConditions } from '@/lib/lms/access';
import { parseAnnotations, parseStoredAnnotations, type EssayAnnotation } from './annotations';
import { canSeeSeries, isEssayAdmin } from './access';
import { notifyStudents } from '@/lib/notifications/notify-students';
import {
  LOCK_MINUTES,
  cleanMarks,
  completeTotal,
  computeStats,
  isReadyToPublish,
  normalizeSections,
  parseSections,
  sectionsTotal,
  type MarksMap,
} from './stats';
import type { EssayPageDTO, EssaySection, EssaySeriesStudentEntry, EssaySlotStatus } from './types';

const ENTITY = 'essay_submission';
const MAX_PAGES = 30;

// ─── Small helpers ───────────────────────────────────────────────────────────

function parseJsonObject<T>(json: string, fallback: T): T {
  try {
    const v = JSON.parse(json);
    return v && typeof v === 'object' ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

function pageImageUrl(pageId: number, updatedAt: Date | null): string {
  return `/api/essays/pages/${pageId}/image?v=${updatedAt ? updatedAt.getTime() : 0}`;
}

function lockExpiry(now = new Date()): Date {
  return new Date(now.getTime() + LOCK_MINUTES * 60_000);
}

function isLockLive(sub: Pick<EssaySubmission, 'lockedBy' | 'lockExpiresAt'>, now = new Date()): boolean {
  return sub.lockedBy !== null && !!sub.lockExpiresAt && sub.lockExpiresAt.getTime() > now.getTime();
}

async function userNames(ids: (number | null | undefined)[]): Promise<Map<number, string>> {
  const unique = [...new Set(ids.filter((v): v is number => typeof v === 'number'))];
  if (unique.length === 0) return new Map();
  const rows = await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, unique));
  return new Map(rows.map(r => [r.id, r.name]));
}

export async function getSeriesOr404(id: number): Promise<EssaySeries> {
  const row = await db.select().from(essaySeries).where(eq(essaySeries.id, id)).get();
  if (!row) throw new ApiException('Essay series not found', 404, 'NOT_FOUND');
  return row;
}

async function getSubmissionOr404(id: number): Promise<EssaySubmission> {
  const row = await db.select().from(essaySubmissions).where(eq(essaySubmissions.id, id)).get();
  if (!row) throw new ApiException('Script not found', 404, 'NOT_FOUND');
  return row;
}

function seriesMax(series: Pick<EssaySeries, 'totalMarks' | 'essayCount'>): number {
  return series.totalMarks * series.essayCount;
}

// ─── Series (staff) ──────────────────────────────────────────────────────────

export interface SeriesInput {
  title: string;
  prompt: string;
  essayDate: string | null;
  essayCount: number;
  sections: EssaySection[];
  product: UserProduct;
  batch: string | null;
  deadline: Date;
}

export function parseSeriesInput(raw: unknown): SeriesInput {
  const o = (raw ?? {}) as Record<string, unknown>;
  const title = typeof o.title === 'string' ? o.title.trim() : '';
  if (!title || title.length > 120) throw new ApiException('Series name is required (max 120 characters)', 400);
  const prompt = typeof o.prompt === 'string' ? o.prompt.slice(0, 5000) : '';
  const essayDate = typeof o.essayDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.essayDate) ? o.essayDate : null;
  const essayCount = typeof o.essayCount === 'number' && Number.isInteger(o.essayCount) && o.essayCount >= 1 && o.essayCount <= 10 ? o.essayCount : null;
  if (!essayCount) throw new ApiException('Number of essays must be between 1 and 10', 400);
  const sections = normalizeSections(o.sections);
  if (!sections) throw new ApiException('Add at least one section, each with a name and a maximum mark (half marks allowed)', 400);
  if (!isAudienceProduct(o.product)) throw new ApiException('Choose a programme (IBA / FBS / FBS Detailed)', 400);
  const batch = typeof o.batch === 'string' && o.batch.trim() ? o.batch.trim() : null;
  const deadline = typeof o.deadline === 'string' ? new Date(o.deadline) : null;
  if (!deadline || Number.isNaN(deadline.getTime())) throw new ApiException('A valid submission deadline is required', 400);
  return { title, prompt, essayDate, essayCount, sections, product: o.product, batch, deadline };
}

export async function listSeriesForStaff() {
  await sweepAutoPublish();
  const series = await db.select().from(essaySeries).orderBy(desc(essaySeries.createdAt));
  const counts = await db
    .select({
      seriesId: essaySubmissions.seriesId,
      status: essaySubmissions.status,
      n: sql<number>`count(*)`,
    })
    .from(essaySubmissions)
    .groupBy(essaySubmissions.seriesId, essaySubmissions.status);

  return series.map(s => {
    const c = { submitted: 0, graded: 0, rejected: 0 };
    for (const row of counts) if (row.seriesId === s.id && row.status in c) c[row.status as keyof typeof c] = Number(row.n);
    return {
      id: s.id,
      title: s.title,
      essayDate: s.essayDate,
      essayCount: s.essayCount,
      totalMarks: s.totalMarks,
      product: s.product,
      batch: s.batch,
      deadline: s.deadline.toISOString(),
      status: s.status,
      publishedAt: s.publishedAt?.toISOString() ?? null,
      counts: { ...c, total: c.submitted + c.graded + c.rejected },
    };
  });
}

export async function createSeries(input: SeriesInput, actorId: number) {
  const [row] = await db
    .insert(essaySeries)
    .values({
      title: input.title,
      prompt: input.prompt,
      essayDate: input.essayDate,
      essayCount: input.essayCount,
      sections: JSON.stringify(input.sections),
      totalMarks: sectionsTotal(input.sections),
      product: input.product,
      batch: input.batch,
      deadline: input.deadline,
      createdBy: actorId,
    })
    .returning();
  return row;
}

export async function updateSeries(id: number, input: SeriesInput) {
  const existing = await getSeriesOr404(id);
  const graded = await db
    .select({ n: sql<number>`count(*)` })
    .from(essaySubmissions)
    .where(and(eq(essaySubmissions.seriesId, id), eq(essaySubmissions.status, 'graded')))
    .get();
  const prevSections = parseSections(existing.sections);
  const sectionsChanged = JSON.stringify(prevSections) !== JSON.stringify(input.sections);
  if (Number(graded?.n ?? 0) > 0 && sectionsChanged) {
    throw new ApiException('Sections cannot change once scripts have been graded', 409, 'SECTIONS_LOCKED');
  }
  const submitted = await db
    .select({ maxIdx: sql<number>`max(${essaySubmissions.essayIndex})` })
    .from(essaySubmissions)
    .where(eq(essaySubmissions.seriesId, id))
    .get();
  if (Number(submitted?.maxIdx ?? 0) > input.essayCount) {
    throw new ApiException('Students have already submitted more essays than that', 409);
  }
  await db
    .update(essaySeries)
    .set({
      title: input.title,
      prompt: input.prompt,
      essayDate: input.essayDate,
      essayCount: input.essayCount,
      sections: JSON.stringify(input.sections),
      totalMarks: sectionsTotal(input.sections),
      product: input.product,
      batch: input.batch,
      deadline: input.deadline,
      // A moved-out deadline re-arms the reminder.
      reminderSentAt: input.deadline.getTime() !== existing.deadline.getTime() ? null : existing.reminderSentAt,
      updatedAt: new Date(),
    })
    .where(eq(essaySeries.id, id));
  await tryAutoPublish(id);
}

export async function setSeriesStatus(id: number, status: 'active' | 'archived') {
  await getSeriesOr404(id);
  await db.update(essaySeries).set({ status, updatedAt: new Date() }).where(eq(essaySeries.id, id));
}

export async function deleteSeries(id: number) {
  await getSeriesOr404(id);
  const any = await db.select({ id: essaySubmissions.id }).from(essaySubmissions).where(eq(essaySubmissions.seriesId, id)).get();
  if (any) throw new ApiException('This series has submissions — archive it instead', 409, 'HAS_SUBMISSIONS');
  await db.delete(essaySeries).where(eq(essaySeries.id, id));
}

export async function duplicateSeries(id: number, actorId: number) {
  const s = await getSeriesOr404(id);
  const nextNumber = s.title.match(/(\d+)\s*$/);
  const title = nextNumber ? s.title.replace(/(\d+)\s*$/, String(Number(nextNumber[1]) + 1)) : `${s.title} (copy)`;
  const [row] = await db
    .insert(essaySeries)
    .values({
      title,
      prompt: '',
      essayDate: null,
      essayCount: s.essayCount,
      sections: s.sections,
      totalMarks: s.totalMarks,
      product: s.product,
      batch: s.batch,
      deadline: new Date(Date.now() + 7 * 86_400_000),
      createdBy: actorId,
    })
    .returning();
  return row;
}

export function seriesDetailDTO(s: EssaySeries) {
  return {
    id: s.id,
    title: s.title,
    prompt: s.prompt,
    essayDate: s.essayDate,
    essayCount: s.essayCount,
    sections: parseSections(s.sections),
    totalMarks: s.totalMarks,
    product: s.product,
    batch: s.batch,
    deadline: s.deadline.toISOString(),
    status: s.status,
    publishedAt: s.publishedAt?.toISOString() ?? null,
  };
}

// ─── Auto-publish ────────────────────────────────────────────────────────────

/** Publishes the series if it is ready. Returns true when this call published it. */
export async function tryAutoPublish(seriesId: number): Promise<boolean> {
  const s = await db.select().from(essaySeries).where(eq(essaySeries.id, seriesId)).get();
  if (!s || s.status !== 'active') return false;
  const subs = await db
    .select({ userId: essaySubmissions.userId, status: essaySubmissions.status })
    .from(essaySubmissions)
    .where(eq(essaySubmissions.seriesId, seriesId));
  const now = new Date();
  if (!isReadyToPublish({ deadline: s.deadline, now, publishedAt: s.publishedAt, statuses: subs.map(x => x.status) })) return false;

  // Conditional update so two concurrent graders can't both publish (and double-notify).
  const won = await db
    .update(essaySeries)
    .set({ publishedAt: now, updatedAt: now })
    .where(and(eq(essaySeries.id, seriesId), isNull(essaySeries.publishedAt)))
    .returning({ id: essaySeries.id });
  if (won.length === 0) return false;

  const recipients = subs.filter(x => x.status === 'graded').map(x => x.userId);
  after(() =>
    notifyStudents(recipients, {
      kicker: 'VH Essays',
      subject: `Your ${s.title} results are out`,
      heading: `${s.title} — results published`,
      message: `Your marked script and marks for ${s.title} are ready. Open them to see your teacher's markings and comments.`,
      path: `/essays/${s.id}`,
      ctaLabel: 'View my results',
    }).catch(err => console.error('[essays] publish notify failed', err)),
  );
  return true;
}

/** Publishes every series whose deadline passed with nothing left to mark. */
export async function sweepAutoPublish(): Promise<number> {
  const candidates = await db
    .select({ id: essaySeries.id })
    .from(essaySeries)
    .where(and(isNull(essaySeries.publishedAt), eq(essaySeries.status, 'active'), lt(essaySeries.deadline, new Date())));
  let n = 0;
  for (const c of candidates) if (await tryAutoPublish(c.id)) n += 1;
  return n;
}

// ─── Student side ────────────────────────────────────────────────────────────

function slotStatus(sub: EssaySubmission | undefined, s: EssaySeries, now: Date): EssaySlotStatus {
  if (!sub) return s.deadline.getTime() > now.getTime() ? 'open' : 'missed';
  if (sub.status === 'rejected') return 'rejected';
  if (sub.status === 'graded' && s.publishedAt) return 'graded';
  return 'submitted';
}

export async function listSeriesForStudent(user: UserWithProducts): Promise<EssaySeriesStudentEntry[]> {
  await sweepAutoPublish();
  const seriesRows = await db
    .select()
    .from(essaySeries)
    .where(and(eq(essaySeries.status, 'active'), ...lmsScopeConditions(user, essaySeries)))
    .orderBy(desc(essaySeries.deadline));
  if (seriesRows.length === 0) return [];
  const subs = await db
    .select()
    .from(essaySubmissions)
    .where(and(eq(essaySubmissions.userId, user.id), inArray(essaySubmissions.seriesId, seriesRows.map(s => s.id))));
  const now = new Date();

  return seriesRows.map(s => {
    const mine = subs.filter(x => x.seriesId === s.id);
    const slots = Array.from({ length: s.essayCount }, (_, i) => {
      const sub = mine.find(x => x.essayIndex === i + 1);
      const status = slotStatus(sub, s, now);
      return { essayIndex: i + 1, status, total: status === 'graded' ? sub!.total : null };
    });
    const graded = slots.filter(x => x.status === 'graded');
    return {
      id: s.id,
      title: s.title,
      essayDate: s.essayDate,
      deadline: s.deadline.toISOString(),
      essayCount: s.essayCount,
      totalMarks: s.totalMarks,
      published: !!s.publishedAt,
      slots,
      seriesTotal: graded.length ? graded.reduce((a, b) => a + (b.total ?? 0), 0) : null,
      seriesMax: seriesMax(s),
    };
  });
}

async function requireVisibleSeries(user: UserWithProducts, seriesId: number): Promise<EssaySeries> {
  const s = await getSeriesOr404(seriesId);
  if (!canSeeSeries(user, s)) throw new ApiException('Essay series not found', 404, 'NOT_FOUND');
  return s;
}

async function pagesFor(submissionIds: number[], withAnnotations: boolean): Promise<Map<number, EssayPageDTO[]>> {
  const map = new Map<number, EssayPageDTO[]>();
  if (submissionIds.length === 0) return map;
  const rows = await db
    .select()
    .from(essayPages)
    .where(inArray(essayPages.submissionId, submissionIds))
    .orderBy(asc(essayPages.submissionId), asc(essayPages.pageIndex));
  for (const p of rows) {
    const list = map.get(p.submissionId) ?? [];
    list.push({
      id: p.id,
      pageIndex: p.pageIndex,
      width: p.width,
      height: p.height,
      rotation: p.rotation,
      imageUrl: pageImageUrl(p.id, p.updatedAt),
      annotations: withAnnotations ? parseStoredAnnotations(p.annotations) : [],
    });
    map.set(p.submissionId, list);
  }
  return map;
}

/** Series totals per student over graded scripts — the class pool for student-facing stats. */
async function classSeriesTotals(seriesId: number): Promise<Map<number, number>> {
  const rows = await db
    .select({ userId: essaySubmissions.userId, total: essaySubmissions.total })
    .from(essaySubmissions)
    .where(and(eq(essaySubmissions.seriesId, seriesId), eq(essaySubmissions.status, 'graded')));
  const totals = new Map<number, number>();
  for (const r of rows) totals.set(r.userId, (totals.get(r.userId) ?? 0) + (r.total ?? 0));
  return totals;
}

export async function getStudentSeriesDetail(user: UserWithProducts, seriesId: number) {
  await tryAutoPublish(seriesId);
  const s = await requireVisibleSeries(user, seriesId);
  const now = new Date();
  const sections = parseSections(s.sections);
  const mine = await db
    .select()
    .from(essaySubmissions)
    .where(and(eq(essaySubmissions.seriesId, seriesId), eq(essaySubmissions.userId, user.id)));
  const visibleGraded = mine.filter(x => x.status === 'graded' && s.publishedAt);
  const pageMap = await pagesFor(mine.map(x => x.id), true);
  const graders = await userNames(visibleGraded.map(x => x.gradedBy));

  const essays = Array.from({ length: s.essayCount }, (_, i) => {
    const sub = mine.find(x => x.essayIndex === i + 1);
    const status = slotStatus(sub, s, now);
    const result = status === 'graded' && sub
      ? {
          marks: parseJsonObject<MarksMap>(sub.marks, {}),
          sectionComments: parseJsonObject<Record<string, string>>(sub.sectionComments, {}),
          total: sub.total,
          overallFeedback: sub.overallFeedback,
          gradedBy: sub.gradedBy ? graders.get(sub.gradedBy) ?? null : null,
          gradedAt: sub.gradedAt?.toISOString() ?? null,
        }
      : null;
    return {
      essayIndex: i + 1,
      status,
      submittedAt: sub?.submittedAt.toISOString() ?? null,
      attempt: sub?.attempt ?? 0,
      rejectReason: sub?.status === 'rejected' ? sub.rejectReason : null,
      // Pages: always the student's own photos; markup only once the result is visible.
      pages: (sub ? pageMap.get(sub.id) ?? [] : []).map(p => (result ? p : { ...p, annotations: [] })),
      result,
    };
  });

  let stats = null;
  if (visibleGraded.length > 0) {
    const pool = await classSeriesTotals(seriesId);
    const max = seriesMax(s);
    const st = computeStats([...pool.values()], max);
    stats = {
      myTotal: visibleGraded.reduce((a, b) => a + (b.total ?? 0), 0),
      max,
      classAverage: st.average,
      highest: st.highest,
      count: st.count,
      histogram: st.histogram,
    };
  }

  return {
    series: {
      id: s.id,
      title: s.title,
      prompt: s.prompt,
      essayDate: s.essayDate,
      essayCount: s.essayCount,
      sections,
      totalMarks: s.totalMarks,
      deadline: s.deadline.toISOString(),
      published: !!s.publishedAt,
      deadlinePassed: s.deadline.getTime() <= now.getTime(),
    },
    essays,
    stats,
  };
}

export interface SubmittedPage {
  key: string;
  width: number;
  height: number;
}

export function uploadKeyPrefix(seriesId: number, userId: number): string {
  return `essays/${seriesId}/${userId}/`;
}

export async function assertCanUpload(user: UserWithProducts, seriesId: number, essayIndex: number) {
  const s = await requireVisibleSeries(user, seriesId);
  if (!Number.isInteger(essayIndex) || essayIndex < 1 || essayIndex > s.essayCount) {
    throw new ApiException('Invalid essay number', 400);
  }
  const existing = await db
    .select()
    .from(essaySubmissions)
    .where(and(eq(essaySubmissions.seriesId, seriesId), eq(essaySubmissions.userId, user.id), eq(essaySubmissions.essayIndex, essayIndex)))
    .get();
  if (existing && existing.status !== 'rejected') {
    throw new ApiException('This essay has already been submitted — submissions are final', 409, 'ALREADY_SUBMITTED');
  }
  if (!existing && s.deadline.getTime() <= Date.now()) {
    throw new ApiException('The submission window for this series has closed', 409, 'DEADLINE_PASSED');
  }
  return { series: s, existing };
}

export async function submitEssay(user: UserWithProducts, seriesId: number, essayIndex: number, rawPages: unknown) {
  const { series, existing } = await assertCanUpload(user, seriesId, essayIndex);
  if (!Array.isArray(rawPages) || rawPages.length === 0 || rawPages.length > MAX_PAGES) {
    throw new ApiException(`Submit between 1 and ${MAX_PAGES} pages`, 400);
  }
  const prefix = uploadKeyPrefix(seriesId, user.id);
  const pages: SubmittedPage[] = rawPages.map((p: unknown) => {
    const o = (p ?? {}) as Record<string, unknown>;
    const ok =
      typeof o.key === 'string' && o.key.startsWith(prefix) && !o.key.includes('..') && o.key.length < 300 &&
      Number.isInteger(o.width) && Number.isInteger(o.height) &&
      (o.width as number) > 0 && (o.height as number) > 0 && (o.width as number) <= 10000 && (o.height as number) <= 10000;
    if (!ok) throw new ApiException('Invalid page upload', 400);
    return { key: o.key as string, width: o.width as number, height: o.height as number };
  });

  const now = new Date();
  const subId = await db.transaction(async tx => {
    let id: number;
    if (existing) {
      // Resubmission after a rejection: reset to a fresh script.
      const updated = await tx
        .update(essaySubmissions)
        .set({
          status: 'submitted',
          attempt: existing.attempt + 1,
          submittedAt: now,
          marks: '{}',
          sectionComments: '{}',
          total: null,
          overallFeedback: '',
          gradedBy: null,
          gradedAt: null,
          lockedBy: null,
          lockExpiresAt: null,
          updatedAt: now,
        })
        .where(and(eq(essaySubmissions.id, existing.id), eq(essaySubmissions.status, 'rejected')))
        .returning({ id: essaySubmissions.id });
      if (updated.length === 0) throw new ApiException('This essay has already been resubmitted', 409, 'ALREADY_SUBMITTED');
      id = existing.id;
      await tx.delete(essayPages).where(eq(essayPages.submissionId, id));
    } else {
      const inserted = await tx
        .insert(essaySubmissions)
        .values({ seriesId, userId: user.id, essayIndex, submittedAt: now })
        .onConflictDoNothing()
        .returning({ id: essaySubmissions.id });
      if (inserted.length === 0) throw new ApiException('This essay has already been submitted', 409, 'ALREADY_SUBMITTED');
      id = inserted[0].id;
    }
    await tx.insert(essayPages).values(
      pages.map((p, i) => ({ submissionId: id, pageIndex: i, r2Key: p.key, width: p.width, height: p.height })),
    );
    return id;
  });

  await recordAudit({
    actorUserId: user.id,
    action: existing ? 'essay.resubmitted' : 'essay.submitted',
    entityType: ENTITY,
    entityId: subId,
    after: { pages: pages.length, seriesId: series.id, essayIndex },
  });
  return { submissionId: subId, submittedAt: now.toISOString(), pages: pages.length };
}

export async function getStudentOverview(user: UserWithProducts) {
  await sweepAutoPublish();
  const seriesRows = await db
    .select()
    .from(essaySeries)
    .where(and(eq(essaySeries.status, 'active'), ...lmsScopeConditions(user, essaySeries)))
    .orderBy(asc(essaySeries.deadline));
  const published = seriesRows.filter(s => s.publishedAt);
  if (published.length === 0) return { series: [] };
  const ids = published.map(s => s.id);
  const all = await db
    .select({
      seriesId: essaySubmissions.seriesId,
      userId: essaySubmissions.userId,
      total: essaySubmissions.total,
      marks: essaySubmissions.marks,
    })
    .from(essaySubmissions)
    .where(and(inArray(essaySubmissions.seriesId, ids), eq(essaySubmissions.status, 'graded')));

  return {
    series: published.map(s => {
      const rows = all.filter(r => r.seriesId === s.id);
      const perUser = new Map<number, number>();
      for (const r of rows) perUser.set(r.userId, (perUser.get(r.userId) ?? 0) + (r.total ?? 0));
      const mineRows = rows.filter(r => r.userId === user.id);
      const max = seriesMax(s);
      const st = computeStats([...perUser.values()], max);
      const sections = parseSections(s.sections);
      // Section score as % of that section's max, averaged across the student's essays.
      const sectionPct: Record<string, number> = {};
      for (const sec of sections) {
        const vals = mineRows.map(r => parseJsonObject<MarksMap>(r.marks, {})[sec.key]).filter((v): v is number => typeof v === 'number');
        if (vals.length) sectionPct[sec.name] = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length / sec.max) * 1000) / 10;
      }
      const myTotal = mineRows.length ? mineRows.reduce((a, b) => a + (b.total ?? 0), 0) : null;
      return {
        id: s.id,
        title: s.title,
        essayDate: s.essayDate,
        max,
        myTotal,
        myPct: myTotal === null ? null : Math.round((myTotal / max) * 1000) / 10,
        classAvgPct: st.average === null ? null : Math.round((st.average / max) * 1000) / 10,
        highestPct: st.highest === null ? null : Math.round((st.highest / max) * 1000) / 10,
        sectionPct,
      };
    }),
  };
}

/** Page bytes, for the owner or staff only. */
export async function getPageForViewer(user: UserWithProducts, pageId: number, staff: boolean) {
  const row = await db
    .select({ page: essayPages, sub: essaySubmissions })
    .from(essayPages)
    .innerJoin(essaySubmissions, eq(essaySubmissions.id, essayPages.submissionId))
    .where(eq(essayPages.id, pageId))
    .get();
  if (!row) throw new ApiException('Page not found', 404, 'NOT_FOUND');
  if (!staff && row.sub.userId !== user.id) throw new ApiException('Page not found', 404, 'NOT_FOUND');
  return row.page;
}

// ─── Staff: series scripts ───────────────────────────────────────────────────

export async function getSeriesScripts(seriesId: number, viewer: UserWithProducts) {
  await tryAutoPublish(seriesId);
  const s = await getSeriesOr404(seriesId);
  const sections = parseSections(s.sections);
  const subs = await db
    .select({
      sub: essaySubmissions,
      name: users.name,
      email: users.email,
      studentId: users.studentId,
      batch: users.batch,
    })
    .from(essaySubmissions)
    .innerJoin(users, eq(users.id, essaySubmissions.userId))
    .where(eq(essaySubmissions.seriesId, seriesId))
    .orderBy(asc(users.name), asc(essaySubmissions.essayIndex));

  const pageCounts = subs.length
    ? await db
        .select({ submissionId: essayPages.submissionId, n: sql<number>`count(*)`, marked: sql<number>`sum(case when ${essayPages.annotations} != '[]' then 1 else 0 end)` })
        .from(essayPages)
        .where(inArray(essayPages.submissionId, subs.map(x => x.sub.id)))
        .groupBy(essayPages.submissionId)
    : [];
  const names = await userNames(subs.flatMap(x => [x.sub.gradedBy, x.sub.lockedBy, x.sub.assignedTo, x.sub.rejectedBy]));
  const now = new Date();

  const scripts = subs.map(({ sub, name, email, studentId }) => {
    const pc = pageCounts.find(p => p.submissionId === sub.id);
    const live = isLockLive(sub, now);
    return {
      id: sub.id,
      userId: sub.userId,
      studentName: name,
      studentEmail: email,
      studentId,
      essayIndex: sub.essayIndex,
      status: sub.status,
      attempt: sub.attempt,
      submittedAt: sub.submittedAt.toISOString(),
      total: sub.total,
      pageCount: Number(pc?.n ?? 0),
      markedPages: Number(pc?.marked ?? 0),
      gradedBy: sub.gradedBy ? names.get(sub.gradedBy) ?? null : null,
      gradedAt: sub.gradedAt?.toISOString() ?? null,
      rejectReason: sub.rejectReason,
      lockedBy: live && sub.lockedBy ? { id: sub.lockedBy, name: names.get(sub.lockedBy) ?? 'Someone' } : null,
      assignedTo: sub.assignedTo ? { id: sub.assignedTo, name: names.get(sub.assignedTo) ?? '—' } : null,
      isReference: sub.isReference,
      referenceLabel: sub.referenceLabel,
    };
  });

  // Students in the audience with a missing essay.
  const audience = isAudienceProduct(s.product)
    ? await resolveAudience(db, { mode: 'batchProduct', product: s.product, batch: s.batch })
    : [];
  const seen = new Map<number, Set<number>>();
  for (const x of subs) {
    const set = seen.get(x.sub.userId) ?? new Set<number>();
    set.add(x.sub.essayIndex);
    seen.set(x.sub.userId, set);
  }
  const uniqueAudience = new Map(audience.map(a => [a.id, a]));
  const missing = [...uniqueAudience.values()]
    .map(a => ({
      userId: a.id,
      name: a.name,
      email: a.email,
      missingEssays: Array.from({ length: s.essayCount }, (_, i) => i + 1).filter(i => !seen.get(a.id)?.has(i)),
    }))
    .filter(m => m.missingEssays.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  const gradedSubs = subs.filter(x => x.sub.status === 'graded');
  const essayStats = computeStats(gradedSubs.map(x => x.sub.total ?? 0), s.totalMarks);
  const sectionAverages = sections.map(sec => {
    const vals = gradedSubs.map(x => parseJsonObject<MarksMap>(x.sub.marks, {})[sec.key]).filter((v): v is number => typeof v === 'number');
    return { key: sec.key, name: sec.name, max: sec.max, average: vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100 : null };
  });

  return {
    series: seriesDetailDTO(s),
    scripts,
    missing,
    audienceSize: uniqueAudience.size,
    stats: { ...essayStats, sectionAverages },
    viewer: { id: viewer.id, isAdmin: isEssayAdmin(viewer) },
  };
}

export async function getScriptForStaff(submissionId: number) {
  const sub = await getSubmissionOr404(submissionId);
  const s = await getSeriesOr404(sub.seriesId);
  const student = await db
    .select({ id: users.id, name: users.name, email: users.email, studentId: users.studentId, batch: users.batch })
    .from(users)
    .where(eq(users.id, sub.userId))
    .get();
  const pages = (await pagesFor([sub.id], true)).get(sub.id) ?? [];
  const history = await db
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.entityType, ENTITY), eq(auditLog.entityId, sub.id)))
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
    .limit(50);
  const names = await userNames([sub.gradedBy, sub.lockedBy, sub.rejectedBy, sub.assignedTo, ...history.map(h => h.actorUserId)]);
  const live = isLockLive(sub);

  return {
    id: sub.id,
    seriesId: s.id,
    essayIndex: sub.essayIndex,
    status: sub.status,
    attempt: sub.attempt,
    submittedAt: sub.submittedAt.toISOString(),
    student,
    marks: parseJsonObject<MarksMap>(sub.marks, {}),
    sectionComments: parseJsonObject<Record<string, string>>(sub.sectionComments, {}),
    total: sub.total,
    overallFeedback: sub.overallFeedback,
    privateNote: sub.privateNote,
    rejectReason: sub.rejectReason,
    gradedBy: sub.gradedBy ? { id: sub.gradedBy, name: names.get(sub.gradedBy) ?? '—' } : null,
    gradedAt: sub.gradedAt?.toISOString() ?? null,
    lockedBy: live && sub.lockedBy ? { id: sub.lockedBy, name: names.get(sub.lockedBy) ?? 'Someone' } : null,
    lockExpiresAt: live ? sub.lockExpiresAt?.toISOString() ?? null : null,
    isReference: sub.isReference,
    referenceLabel: sub.referenceLabel,
    pages,
    history: history.map(h => ({
      id: h.id,
      action: h.action,
      actor: h.actorUserId ? names.get(h.actorUserId) ?? '—' : null,
      at: h.createdAt.toISOString(),
      before: h.before ? parseJsonObject<unknown>(h.before, null) : null,
      after: h.after ? parseJsonObject<unknown>(h.after, null) : null,
    })),
  };
}

// ─── Staff: locking ──────────────────────────────────────────────────────────

/**
 * Takes (or renews) the script's lock for `user`. Throws 409 naming the
 * holder when someone else has a live lock — unless `force` (admins only).
 */
export async function acquireLock(submissionId: number, user: UserWithProducts, force = false) {
  const now = new Date();
  const exp = lockExpiry(now);
  if (force) {
    if (!isEssayAdmin(user)) throw new ApiException('Only admins can take over a locked script', 403);
    const before = await getSubmissionOr404(submissionId);
    await db.update(essaySubmissions).set({ lockedBy: user.id, lockExpiresAt: exp }).where(eq(essaySubmissions.id, submissionId));
    if (before.lockedBy && before.lockedBy !== user.id && isLockLive(before, now)) {
      await recordAudit({ actorUserId: user.id, action: 'essay.unlocked', entityType: ENTITY, entityId: submissionId, before: { lockedBy: before.lockedBy } });
    }
    return { lockExpiresAt: exp.toISOString() };
  }
  const updated = await db
    .update(essaySubmissions)
    .set({ lockedBy: user.id, lockExpiresAt: exp })
    .where(
      and(
        eq(essaySubmissions.id, submissionId),
        or(isNull(essaySubmissions.lockedBy), eq(essaySubmissions.lockedBy, user.id), lt(essaySubmissions.lockExpiresAt, now)),
      ),
    )
    .returning({ id: essaySubmissions.id });
  if (updated.length === 0) {
    const sub = await getSubmissionOr404(submissionId);
    const names = await userNames([sub.lockedBy]);
    throw new ApiException(`Being marked by ${names.get(sub.lockedBy ?? -1) ?? 'another grader'}`, 409, 'LOCKED');
  }
  return { lockExpiresAt: exp.toISOString() };
}

export async function releaseLock(submissionId: number, user: UserWithProducts) {
  await db
    .update(essaySubmissions)
    .set({ lockedBy: null, lockExpiresAt: null })
    .where(and(eq(essaySubmissions.id, submissionId), eq(essaySubmissions.lockedBy, user.id)));
}

// ─── Staff: marking ──────────────────────────────────────────────────────────

export async function saveAnnotations(pageId: number, user: UserWithProducts, rawItems: unknown, rawRotation: unknown) {
  const page = await db.select().from(essayPages).where(eq(essayPages.id, pageId)).get();
  if (!page) throw new ApiException('Page not found', 404, 'NOT_FOUND');
  const items: EssayAnnotation[] | null = parseAnnotations(rawItems);
  if (!items) throw new ApiException('Invalid markings', 400);
  let rotation = page.rotation;
  if (rawRotation !== undefined) {
    if (![0, 90, 180, 270].includes(rawRotation as number)) throw new ApiException('Invalid rotation', 400);
    rotation = rawRotation as number;
  }
  await acquireLock(page.submissionId, user);
  const now = new Date();
  await db
    .update(essayPages)
    .set({ annotations: JSON.stringify(items), rotation, updatedAt: rotation !== page.rotation ? now : page.updatedAt })
    .where(eq(essayPages.id, pageId));
  return { savedAt: now.toISOString(), rotation };
}

export async function saveMarks(
  submissionId: number,
  user: UserWithProducts,
  body: {
    marks?: unknown;
    sectionComments?: unknown;
    overallFeedback?: unknown;
    privateNote?: unknown;
    action?: unknown;
    notify?: unknown;
  },
) {
  const sub = await getSubmissionOr404(submissionId);
  const s = await getSeriesOr404(sub.seriesId);
  if (sub.status === 'rejected') throw new ApiException('This script was rejected — wait for the student to resubmit', 409);
  const sections = parseSections(s.sections);
  const action = body.action === 'grade' ? 'grade' : 'save';

  const marks = body.marks === undefined ? parseJsonObject<MarksMap>(sub.marks, {}) : cleanMarks(body.marks, sections);
  if (!marks) throw new ApiException('A mark is out of range (half marks allowed)', 400);
  const sectionComments: Record<string, string> = {};
  const rawSc = (body.sectionComments ?? parseJsonObject<Record<string, unknown>>(sub.sectionComments, {})) as Record<string, unknown>;
  for (const sec of sections) {
    const v = rawSc?.[sec.key];
    if (typeof v === 'string' && v.trim()) sectionComments[sec.key] = v.slice(0, 1000);
  }
  const overallFeedback = typeof body.overallFeedback === 'string' ? body.overallFeedback.slice(0, 5000) : sub.overallFeedback;
  const privateNote = typeof body.privateNote === 'string' ? body.privateNote.slice(0, 5000) : sub.privateNote;
  const total = completeTotal(marks, sections);

  const becomingGraded = action === 'grade' && sub.status !== 'graded';
  if ((action === 'grade' || sub.status === 'graded') && total === null) {
    throw new ApiException('Enter a mark for every section first', 400, 'INCOMPLETE');
  }

  await acquireLock(submissionId, user);
  const now = new Date();
  await db
    .update(essaySubmissions)
    .set({
      marks: JSON.stringify(marks),
      sectionComments: JSON.stringify(sectionComments),
      overallFeedback,
      privateNote,
      total,
      ...(becomingGraded ? { status: 'graded', gradedBy: user.id, gradedAt: now } : {}),
      updatedAt: now,
    })
    .where(eq(essaySubmissions.id, submissionId));

  const prevMarks = parseJsonObject<MarksMap>(sub.marks, {});
  const marksChanged = JSON.stringify(prevMarks) !== JSON.stringify(marks);
  if (becomingGraded) {
    await recordAudit({ actorUserId: user.id, action: 'essay.graded', entityType: ENTITY, entityId: submissionId, after: { marks, total } });
  } else if (sub.status === 'graded' && marksChanged) {
    await recordAudit({ actorUserId: user.id, action: 'essay.marks_changed', entityType: ENTITY, entityId: submissionId, before: { marks: prevMarks, total: sub.total }, after: { marks, total } });
  }

  let published = false;
  if (becomingGraded) published = await tryAutoPublish(s.id);

  // Students hear about a single script when the series is already out:
  // a resubmission graded after publishing (always), or an edit (if asked).
  const seriesOut = !!s.publishedAt;
  if (seriesOut && becomingGraded) {
    after(() =>
      notifyStudents([sub.userId], {
        kicker: 'VH Essays',
        subject: `Your ${s.title} script has been marked`,
        heading: `${s.title} — marked`,
        message: `Your resubmitted essay for ${s.title} has been marked. Open it to see your marks and your teacher's comments.`,
        path: `/essays/${s.id}`,
        ctaLabel: 'View my results',
      }).catch(err => console.error('[essays] notify failed', err)),
    );
  } else if (seriesOut && sub.status === 'graded' && body.notify === true) {
    after(() =>
      notifyStudents([sub.userId], {
        kicker: 'VH Essays',
        subject: `Your ${s.title} marks were updated`,
        heading: `${s.title} — marks updated`,
        message: `Your teacher updated the marking on your ${s.title} essay. Your total is now ${total} / ${s.totalMarks}.`,
        path: `/essays/${s.id}`,
        ctaLabel: 'View my results',
      }).catch(err => console.error('[essays] notify failed', err)),
    );
  }

  return { status: becomingGraded ? 'graded' : sub.status, total, published };
}

export async function rejectScript(submissionId: number, user: UserWithProducts, rawReason: unknown) {
  const reason = typeof rawReason === 'string' ? rawReason.trim().slice(0, 1000) : '';
  if (!reason) throw new ApiException('Give the student a reason', 400);
  const sub = await getSubmissionOr404(submissionId);
  const s = await getSeriesOr404(sub.seriesId);
  await acquireLock(submissionId, user);
  const now = new Date();
  await db
    .update(essaySubmissions)
    .set({
      status: 'rejected',
      rejectReason: reason,
      rejectedBy: user.id,
      rejectedAt: now,
      lockedBy: null,
      lockExpiresAt: null,
      updatedAt: now,
    })
    .where(eq(essaySubmissions.id, submissionId));
  await recordAudit({ actorUserId: user.id, action: 'essay.rejected', entityType: ENTITY, entityId: submissionId, before: { status: sub.status }, after: { reason } });

  after(() =>
    notifyStudents([sub.userId], {
      kicker: 'VH Essays',
      subject: `Please resubmit your ${s.title} essay`,
      heading: `${s.title} — please resubmit`,
      message: `Your essay ${s.essayCount > 1 ? `${sub.essayIndex} ` : ''}for ${s.title} was sent back.\nReason: ${reason}\nYou can upload it again from your portal.`,
      path: `/essays/${s.id}`,
      ctaLabel: 'Resubmit',
    }).catch(err => console.error('[essays] notify failed', err)),
  );
  const published = await tryAutoPublish(s.id);
  return { status: 'rejected', published };
}

export async function setReference(submissionId: number, isReference: boolean, rawLabel: unknown) {
  const sub = await getSubmissionOr404(submissionId);
  if (isReference && sub.status !== 'graded') throw new ApiException('Only graded scripts can be reference scripts', 409);
  const label = typeof rawLabel === 'string' ? rawLabel.trim().slice(0, 80) : '';
  await db
    .update(essaySubmissions)
    .set({ isReference, referenceLabel: isReference ? label || null : null })
    .where(eq(essaySubmissions.id, submissionId));
}

export async function listReferenceScripts(seriesId: number) {
  const rows = await db
    .select({ id: essaySubmissions.id, label: essaySubmissions.referenceLabel, total: essaySubmissions.total, essayIndex: essaySubmissions.essayIndex, name: users.name })
    .from(essaySubmissions)
    .innerJoin(users, eq(users.id, essaySubmissions.userId))
    .where(and(eq(essaySubmissions.seriesId, seriesId), eq(essaySubmissions.isReference, true)));
  return rows;
}

// ─── Staff: grader assignment ────────────────────────────────────────────────

export async function listGraders() {
  return db
    .select({ id: users.id, name: users.name, role: users.role })
    .from(users)
    .where(and(inArray(users.role, ['admin', 'super_admin', 'instructor']), eq(users.status, 'active')))
    .orderBy(asc(users.name));
}

export async function assignGraders(seriesId: number, body: { mode?: unknown; graderIds?: unknown; submissionId?: unknown; graderId?: unknown }) {
  await getSeriesOr404(seriesId);
  const graders = await listGraders();
  const validIds = new Set(graders.map(g => g.id));

  if (body.mode === 'set') {
    const submissionId = Number(body.submissionId);
    const graderId = body.graderId === null ? null : Number(body.graderId);
    if (graderId !== null && !validIds.has(graderId)) throw new ApiException('Unknown grader', 400);
    await db
      .update(essaySubmissions)
      .set({ assignedTo: graderId })
      .where(and(eq(essaySubmissions.id, submissionId), eq(essaySubmissions.seriesId, seriesId)));
    return { assigned: 1 };
  }

  if (body.mode === 'split') {
    const ids = Array.isArray(body.graderIds) ? body.graderIds.map(Number).filter(id => validIds.has(id)) : [];
    if (ids.length === 0) throw new ApiException('Pick at least one grader', 400);
    // Split the scripts still waiting to be marked, in student-name order, into contiguous blocks.
    const pending = await db
      .select({ id: essaySubmissions.id })
      .from(essaySubmissions)
      .innerJoin(users, eq(users.id, essaySubmissions.userId))
      .where(and(eq(essaySubmissions.seriesId, seriesId), eq(essaySubmissions.status, 'submitted')))
      .orderBy(asc(users.name), asc(essaySubmissions.essayIndex));
    const per = Math.ceil(pending.length / ids.length);
    for (let g = 0; g < ids.length; g++) {
      const block = pending.slice(g * per, (g + 1) * per).map(p => p.id);
      if (block.length) await db.update(essaySubmissions).set({ assignedTo: ids[g] }).where(inArray(essaySubmissions.id, block));
    }
    return { assigned: pending.length };
  }

  if (body.mode === 'clear') {
    await db.update(essaySubmissions).set({ assignedTo: null }).where(eq(essaySubmissions.seriesId, seriesId));
    return { assigned: 0 };
  }
  throw new ApiException('Unknown assignment mode', 400);
}

// ─── Staff: export ───────────────────────────────────────────────────────────

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s; // neutralise spreadsheet formulas
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export async function exportSeriesCsv(seriesId: number): Promise<{ filename: string; csv: string }> {
  const s = await getSeriesOr404(seriesId);
  const sections = parseSections(s.sections);
  const rows = await db
    .select({ sub: essaySubmissions, name: users.name, email: users.email, studentId: users.studentId })
    .from(essaySubmissions)
    .innerJoin(users, eq(users.id, essaySubmissions.userId))
    .where(eq(essaySubmissions.seriesId, seriesId))
    .orderBy(asc(users.name), asc(essaySubmissions.essayIndex));
  const names = await userNames(rows.map(r => r.sub.gradedBy));
  const header = ['Student', 'Email', 'Student ID', 'Essay', 'Status', ...sections.map(x => `${x.name} (/${x.max})`), `Total (/${s.totalMarks})`, 'Graded by', 'Graded at', 'Reject reason'];
  const lines = [header.map(csvCell).join(',')];
  for (const { sub, name, email, studentId } of rows) {
    const marks = parseJsonObject<MarksMap>(sub.marks, {});
    lines.push([
      name, email, studentId ?? '', sub.essayIndex, sub.status,
      ...sections.map(x => marks[x.key] ?? ''),
      sub.total ?? '',
      sub.gradedBy ? names.get(sub.gradedBy) ?? '' : '',
      sub.gradedAt?.toISOString() ?? '',
      sub.status === 'rejected' ? sub.rejectReason ?? '' : '',
    ].map(csvCell).join(','));
  }
  const filename = `${s.title.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'essay-series'}-marks.csv`;
  return { filename, csv: lines.join('\n') };
}

/** Everything the "download all marked scripts" export needs, in one call. */
export async function getSeriesExportBundle(seriesId: number) {
  const s = await getSeriesOr404(seriesId);
  const rows = await db
    .select({ sub: essaySubmissions, name: users.name })
    .from(essaySubmissions)
    .innerJoin(users, eq(users.id, essaySubmissions.userId))
    .where(and(eq(essaySubmissions.seriesId, seriesId), eq(essaySubmissions.status, 'graded')))
    .orderBy(asc(users.name), asc(essaySubmissions.essayIndex));
  const pageMap = await pagesFor(rows.map(r => r.sub.id), true);
  const names = await userNames(rows.map(r => r.sub.gradedBy));
  return {
    series: seriesDetailDTO(s),
    scripts: rows.map(({ sub, name }) => ({
      id: sub.id,
      studentName: name,
      essayIndex: sub.essayIndex,
      marks: parseJsonObject<MarksMap>(sub.marks, {}),
      sectionComments: parseJsonObject<Record<string, string>>(sub.sectionComments, {}),
      total: sub.total,
      overallFeedback: sub.overallFeedback,
      gradedBy: sub.gradedBy ? names.get(sub.gradedBy) ?? null : null,
      pages: pageMap.get(sub.id) ?? [],
    })),
  };
}

// ─── Staff: analytics ────────────────────────────────────────────────────────

export async function getAnalytics(viewer: UserWithProducts) {
  await sweepAutoPublish();
  const seriesRows = await db.select().from(essaySeries).orderBy(asc(essaySeries.deadline));
  const subs = await db
    .select({ sub: essaySubmissions, name: users.name, email: users.email })
    .from(essaySubmissions)
    .innerJoin(users, eq(users.id, essaySubmissions.userId));
  const graderNames = await userNames(subs.map(x => x.sub.gradedBy));

  const series = await Promise.all(seriesRows.map(async s => {
    const mine = subs.filter(x => x.sub.seriesId === s.id);
    const graded = mine.filter(x => x.sub.status === 'graded');
    const sections = parseSections(s.sections);
    const perUser = new Map<number, number>();
    for (const g of graded) perUser.set(g.sub.userId, (perUser.get(g.sub.userId) ?? 0) + (g.sub.total ?? 0));
    const max = seriesMax(s);
    const audience = isAudienceProduct(s.product)
      ? await resolveAudience(db, { mode: 'batchProduct', product: s.product, batch: s.batch })
      : [];
    const audienceIds = new Set(audience.map(a => a.id));
    const submittedIds = new Set(mine.map(x => x.sub.userId));
    const nonSubmitters = audience.filter(a => !submittedIds.has(a.id));
    const uniqueNon = [...new Map(nonSubmitters.map(a => [a.id, a])).values()];
    return {
      id: s.id,
      title: s.title,
      essayDate: s.essayDate,
      deadline: s.deadline.toISOString(),
      status: s.status,
      publishedAt: s.publishedAt?.toISOString() ?? null,
      product: s.product,
      batch: s.batch,
      max,
      audienceSize: audienceIds.size,
      counts: {
        submitted: mine.filter(x => x.sub.status === 'submitted').length,
        graded: graded.length,
        rejected: mine.filter(x => x.sub.status === 'rejected').length,
      },
      stats: computeStats([...perUser.values()], max),
      sectionAverages: sections.map(sec => {
        const vals = graded.map(g => parseJsonObject<MarksMap>(g.sub.marks, {})[sec.key]).filter((v): v is number => typeof v === 'number');
        return { name: sec.name, max: sec.max, average: vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100 : null };
      }),
      nonSubmitters: uniqueNon.map(a => ({ id: a.id, name: a.name, email: a.email })).sort((a, b) => a.name.localeCompare(b.name)),
      graders: isEssayAdmin(viewer)
        ? [...new Set(graded.map(g => g.sub.gradedBy).filter((v): v is number => v !== null))].map(gid => {
            const theirs = graded.filter(g => g.sub.gradedBy === gid).map(g => g.sub.total ?? 0);
            return {
              id: gid,
              name: graderNames.get(gid) ?? '—',
              count: theirs.length,
              averagePct: Math.round((theirs.reduce((a, b) => a + b, 0) / theirs.length / s.totalMarks) * 1000) / 10,
            };
          })
        : null,
    };
  }));

  // Per-student trend: % of series max, per series.
  const students = new Map<number, { id: number; name: string; email: string; scores: Record<number, number> }>();
  for (const s of seriesRows) {
    const max = seriesMax(s);
    const totals = new Map<number, number>();
    for (const x of subs) {
      if (x.sub.seriesId !== s.id || x.sub.status !== 'graded') continue;
      totals.set(x.sub.userId, (totals.get(x.sub.userId) ?? 0) + (x.sub.total ?? 0));
      if (!students.has(x.sub.userId)) students.set(x.sub.userId, { id: x.sub.userId, name: x.name, email: x.email, scores: {} });
    }
    for (const [uid, t] of totals) students.get(uid)!.scores[s.id] = Math.round((t / max) * 1000) / 10;
  }

  return {
    series,
    students: [...students.values()].sort((a, b) => a.name.localeCompare(b.name)),
    canSeeGraders: isEssayAdmin(viewer),
  };
}

// ─── Comment bank ────────────────────────────────────────────────────────────

export async function listCommentBank(user: UserWithProducts) {
  const rows = await db
    .select()
    .from(essayCommentBank)
    .where(or(isNull(essayCommentBank.userId), eq(essayCommentBank.userId, user.id)))
    .orderBy(asc(essayCommentBank.createdAt));
  return rows.map(r => ({ id: r.id, text: r.text, shared: r.userId === null }));
}

export async function addComment(user: UserWithProducts, rawText: unknown, shared: boolean) {
  const text = typeof rawText === 'string' ? rawText.trim().slice(0, 500) : '';
  if (!text) throw new ApiException('Comment text is required', 400);
  if (shared && !isEssayAdmin(user)) throw new ApiException('Only admins can edit the shared comment bank', 403);
  const [row] = await db.insert(essayCommentBank).values({ userId: shared ? null : user.id, text }).returning();
  return { id: row.id, text: row.text, shared };
}

export async function deleteComment(user: UserWithProducts, id: number) {
  const row = await db.select().from(essayCommentBank).where(eq(essayCommentBank.id, id)).get();
  if (!row) throw new ApiException('Not found', 404);
  if (row.userId === null ? !isEssayAdmin(user) : row.userId !== user.id) throw new ApiException('Not allowed', 403);
  await db.delete(essayCommentBank).where(eq(essayCommentBank.id, id));
}

// ─── Reminders (cron) ────────────────────────────────────────────────────────

/** One reminder per series, to audience students still missing an essay, once the deadline is < 24h away. */
export async function sendDeadlineReminders(): Promise<{ series: number; students: number }> {
  const now = new Date();
  const soon = new Date(now.getTime() + 24 * 3_600_000);
  const due = await db
    .select()
    .from(essaySeries)
    .where(and(eq(essaySeries.status, 'active'), isNull(essaySeries.reminderSentAt), lt(essaySeries.deadline, soon)));
  let students = 0;
  let count = 0;
  for (const s of due) {
    if (s.deadline.getTime() <= now.getTime()) {
      await db.update(essaySeries).set({ reminderSentAt: now }).where(eq(essaySeries.id, s.id));
      continue;
    }
    if (!isAudienceProduct(s.product)) continue;
    const audience = await resolveAudience(db, { mode: 'batchProduct', product: s.product, batch: s.batch });
    const subs = await db
      .select({ userId: essaySubmissions.userId })
      .from(essaySubmissions)
      .where(eq(essaySubmissions.seriesId, s.id));
    const perUser = new Map<number, number>();
    for (const x of subs) perUser.set(x.userId, (perUser.get(x.userId) ?? 0) + 1);
    const targets = [...new Set(audience.filter(a => (perUser.get(a.id) ?? 0) < s.essayCount).map(a => a.id))];
    const dhaka = new Intl.DateTimeFormat('en-BD', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Dhaka' }).format(s.deadline);
    await notifyStudents(targets, {
      kicker: 'VH Essays',
      subject: `Reminder: submit your ${s.title} essay`,
      heading: `${s.title} closes soon`,
      message: `You haven't submitted your essay for ${s.title} yet. Submissions close at ${dhaka} (Dhaka time) and late submissions are not accepted.`,
      path: `/essays/${s.id}`,
      ctaLabel: 'Submit now',
    });
    await db.update(essaySeries).set({ reminderSentAt: now }).where(eq(essaySeries.id, s.id));
    students += targets.length;
    count += 1;
  }
  return { series: count, students };
}
