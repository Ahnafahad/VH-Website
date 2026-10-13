/**
 * Test version history on top of `test_versions`. A snapshot is the test's sections, groups,
 * questions (with answer keys) and windows config as JSON. Restore only rewrites question
 * content/keys that still exist (matched by id) — it never recreates or deletes rows.
 */
import { desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  testVersions, testSections, testQuestionGroups, testQuestions, testWindows, users,
} from '@/lib/db/schema';
import { ApiException } from '@/lib/api-utils';
import { recordAudit } from '@/lib/audit-log';

export interface TestSnapshot {
  sections: Record<string, unknown>[];
  groups: Record<string, unknown>[];
  questions: { id: number; number: number; stem: string; options: string; correctKey: string | null; imageUrl: string | null; explanation: string | null }[];
  windows: Record<string, unknown>[];
}

export interface SnapshotDiff { questionsChanged: number; keysChanged: number; added: number; removed: number }

export async function buildSnapshot(testId: number): Promise<TestSnapshot> {
  const sections = await db.select().from(testSections).where(eq(testSections.testId, testId));
  const ids = sections.map(s => s.id);
  const [groups, questions, windows] = await Promise.all([
    ids.length ? db.select().from(testQuestionGroups).where(inArray(testQuestionGroups.sectionId, ids)) : [],
    ids.length ? db.select().from(testQuestions).where(inArray(testQuestions.sectionId, ids)) : [],
    db.select().from(testWindows).where(eq(testWindows.testId, testId)),
  ]);
  return {
    sections, groups, windows,
    questions: questions.map(q => ({
      id: q.id, number: q.number, stem: q.stem, options: q.options,
      correctKey: q.correctKey, imageUrl: q.imageUrl, explanation: q.explanation,
    })),
  };
}

export async function snapshotTest(testId: number, reason: string, actorId: number | null): Promise<number> {
  const snap = await buildSnapshot(testId);
  const [row] = await db.insert(testVersions)
    .values({ testId, snapshot: JSON.stringify(snap), reason, createdBy: actorId })
    .returning({ id: testVersions.id });
  return row.id;
}

/** Pure: what would change if `current` were replaced by `old` (the version being restored). */
export function diffSnapshots(old: TestSnapshot, current: TestSnapshot): SnapshotDiff {
  const cur = new Map(current.questions.map(q => [q.id, q]));
  const oldIds = new Set(old.questions.map(q => q.id));
  let questionsChanged = 0, keysChanged = 0;
  for (const q of old.questions) {
    const c = cur.get(q.id);
    if (!c) continue;
    if (c.correctKey !== q.correctKey) keysChanged++;
    if (c.stem !== q.stem || c.options !== q.options || c.imageUrl !== q.imageUrl || c.explanation !== q.explanation) questionsChanged++;
  }
  return {
    questionsChanged, keysChanged,
    added: current.questions.filter(q => !oldIds.has(q.id)).length,
    removed: old.questions.filter(q => !cur.has(q.id)).length,
  };
}

export async function listVersions(testId: number) {
  const current = await buildSnapshot(testId);
  const rows = await db.select({ v: testVersions, by: users.name })
    .from(testVersions).leftJoin(users, eq(users.id, testVersions.createdBy))
    .where(eq(testVersions.testId, testId)).orderBy(desc(testVersions.createdAt), desc(testVersions.id));
  return rows.map(({ v, by }) => ({
    id: v.id, reason: v.reason, createdBy: by, createdAt: v.createdAt.getTime(),
    diff: diffSnapshots(JSON.parse(v.snapshot) as TestSnapshot, current),
  }));
}

export async function restoreVersion(testId: number, versionId: number, actorId: number): Promise<SnapshotDiff> {
  const v = await db.select().from(testVersions).where(eq(testVersions.id, versionId)).get();
  if (!v || v.testId !== testId) throw new ApiException('Version not found', 404);
  const old = JSON.parse(v.snapshot) as TestSnapshot;
  const diff = diffSnapshots(old, await buildSnapshot(testId));
  await snapshotTest(testId, `Before restore of version #${versionId}`, actorId);
  const cur = new Set((await buildSnapshot(testId)).questions.map(q => q.id));
  await db.transaction(async (tx) => {
    for (const q of old.questions) {
      if (!cur.has(q.id)) continue;
      await tx.update(testQuestions).set({
        stem: q.stem, options: q.options, correctKey: q.correctKey, imageUrl: q.imageUrl, explanation: q.explanation,
      }).where(eq(testQuestions.id, q.id));
    }
  });
  await recordAudit({
    actorUserId: actorId, action: 'test.restore', entityType: 'test', entityId: testId,
    before: null, after: { versionId, ...diff },
  });
  return diff;
}
