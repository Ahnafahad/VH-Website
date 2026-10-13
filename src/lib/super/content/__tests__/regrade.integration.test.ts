/** Regrade + void + version restore against a local temp libSQL file (never Turso). */
import os from 'os';
import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('@/lib/db', () => ({ get db() { return holder.db; } }));
vi.mock('@/lib/audit-log', () => ({ recordAudit: vi.fn(async () => {}) }));
vi.mock('@/lib/db-access-control', () => ({ getUserById: vi.fn() }));

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import * as schema from '@/lib/db/schema';
import { previewRegrade, applyRegrade } from '../regrade';
import { voidAttempt, unvoidAttempt } from '../void';
import { listVersions, restoreVersion } from '../versions';

const DDL = [
  'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)',
  `CREATE TABLE tests (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT, title TEXT, bucket TEXT, description TEXT, status TEXT DEFAULT 'published',
    allowed_products TEXT, category TEXT, is_diagnostic INTEGER DEFAULT 0, total_questions INTEGER DEFAULT 0, total_marks REAL DEFAULT 0, results_published_at INTEGER,
    source_file TEXT, syllabus TEXT, created_by INTEGER, created_at INTEGER DEFAULT (unixepoch()), updated_at INTEGER DEFAULT (unixepoch()))`,
  `CREATE TABLE test_sections (id INTEGER PRIMARY KEY AUTOINCREMENT, test_id INTEGER, "order" INTEGER, title TEXT, total_questions INTEGER DEFAULT 0,
    total_marks REAL DEFAULT 0, marks_per_correct REAL DEFAULT 1, penalty_per_wrong REAL DEFAULT 0.25, threshold_percent REAL)`,
  `CREATE TABLE test_question_groups (id INTEGER PRIMARY KEY AUTOINCREMENT, section_id INTEGER, "order" INTEGER, kind TEXT, title TEXT, content TEXT, shared_options TEXT)`,
  `CREATE TABLE test_questions (id INTEGER PRIMARY KEY AUTOINCREMENT, section_id INTEGER, group_id INTEGER, "order" INTEGER, number INTEGER, type TEXT DEFAULT 'mcq',
    stem TEXT, options TEXT, correct_key TEXT, image_url TEXT, explanation TEXT)`,
  `CREATE TABLE test_windows (id INTEGER PRIMARY KEY AUTOINCREMENT, test_id INTEGER, mode TEXT, opens_at INTEGER, closes_at INTEGER, duration_minutes INTEGER,
    class_session_id INTEGER, status TEXT DEFAULT 'scheduled', created_by INTEGER, created_at INTEGER DEFAULT (unixepoch()))`,
  `CREATE TABLE test_attempts (id INTEGER PRIMARY KEY AUTOINCREMENT, test_id INTEGER, user_id INTEGER, window_id INTEGER, mode TEXT, status TEXT DEFAULT 'in_progress',
    started_at INTEGER DEFAULT (unixepoch()), submitted_at INTEGER, banned_at INTEGER, tab_leave_count INTEGER DEFAULT 0, reset_count INTEGER DEFAULT 0, total_score REAL,
    total_correct INTEGER, total_wrong INTEGER, total_unattempted INTEGER, section_scores TEXT, chosen_sections TEXT, best_snapshot TEXT)`,
  'CREATE TABLE test_answers (id INTEGER PRIMARY KEY AUTOINCREMENT, attempt_id INTEGER, question_id INTEGER, selected_key TEXT, flagged INTEGER DEFAULT 0, answered_at INTEGER DEFAULT (unixepoch()))',
  `CREATE TABLE test_versions (id INTEGER PRIMARY KEY AUTOINCREMENT, test_id INTEGER, snapshot TEXT, reason TEXT, created_by INTEGER, created_at INTEGER DEFAULT (unixepoch()))`,
];

type D = ReturnType<typeof drizzle<typeof schema>>;
const d = () => holder.db as D;

beforeEach(async () => {
  // file DB, not ':memory:': libsql opens a fresh (empty) connection for db.transaction() on :memory:
  const client = createClient({ url: `file:${path.join(os.tmpdir(), `regrade-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.db`)}` });
  for (const s of DDL) await client.execute(s);
  holder.db = drizzle(client, { schema });
  const db = d();
  await client.execute("INSERT INTO users (id, name) VALUES (1, 'Ann'), (2, 'Bo')");
  await db.insert(schema.tests).values({ slug: 't', title: 'T', bucket: 'iba' } as never);
  await db.insert(schema.testSections).values({ testId: 1, order: 1, title: 'S', totalQuestions: 2, totalMarks: 2, marksPerCorrect: 1, penaltyPerWrong: 0.25 });
  await db.insert(schema.testQuestions).values([
    { sectionId: 1, order: 1, number: 1, stem: 'q1', options: '[]', correctKey: 'A' },
    { sectionId: 1, order: 2, number: 2, stem: 'q2', options: '[]', correctKey: 'A' },
  ]);
  // Ann answers A,A ; Bo answers B,A. Stored scores reflect key (A,A): Ann 2, Bo 1 - 0.25 = 0.75
  await db.insert(schema.testAttempts).values([
    { testId: 1, userId: 1, windowId: 1, mode: 'online', status: 'submitted', submittedAt: new Date(), totalScore: 2, totalCorrect: 2, totalWrong: 0, totalUnattempted: 0, sectionScores: '[]' },
    { testId: 1, userId: 2, windowId: 1, mode: 'online', status: 'submitted', submittedAt: new Date(), totalScore: 0.75, totalCorrect: 1, totalWrong: 1, totalUnattempted: 0, sectionScores: '[]' },
  ]);
  await db.insert(schema.testAnswers).values([
    { attemptId: 1, questionId: 1, selectedKey: 'A' }, { attemptId: 1, questionId: 2, selectedKey: 'A' },
    { attemptId: 2, questionId: 1, selectedKey: 'B' }, { attemptId: 2, questionId: 2, selectedKey: 'A' },
  ]);
});

describe('regrade', () => {
  it('previews, applies, snapshots first, and versions can be restored', async () => {
    // Key correction: Q1 is really B. Bo gains, Ann loses.
    await d().update(schema.testQuestions).set({ correctKey: 'B' }).where(eq(schema.testQuestions.id, 1));

    const p = await previewRegrade(1);
    expect(p.changedCount).toBe(2);
    const bo = p.rows.find(r => r.name === 'Bo')!;
    expect(bo.newScore).toBe(2);
    expect([bo.oldRank, bo.newRank]).toEqual([2, 1]);
    // preview must not write
    expect((await d().select().from(schema.testAttempts).where(eq(schema.testAttempts.id, 2)).get())!.totalScore).toBe(0.75);

    const res = await applyRegrade(1, 1);
    expect(res.changed).toBe(2);
    expect((await d().select().from(schema.testAttempts).where(eq(schema.testAttempts.id, 2)).get())!.totalScore).toBe(2);

    const versions = await listVersions(1);
    expect(versions).toHaveLength(1);
    expect(versions[0].reason).toBe('Pre-regrade snapshot');
    expect(versions[0].diff.keysChanged).toBe(0); // snapshot taken after the key fix == current

    // restore a version that holds the OLD key by hand-crafting one
    await d().update(schema.testQuestions).set({ correctKey: 'A' }).where(eq(schema.testQuestions.id, 1));
    const diff = await restoreVersion(1, versions[0].id, 1);
    expect(diff.keysChanged).toBe(1);
    expect((await d().select().from(schema.testQuestions).where(eq(schema.testQuestions.id, 1)).get())!.correctKey).toBe('B');
    expect((await listVersions(1)).length).toBe(2); // pre-restore snapshot added
  });

  it('a voided attempt is excluded from regrade and can be restored', async () => {
    await expect(voidAttempt(2, 'x', 1)).rejects.toThrow('reason');
    await voidAttempt(2, 'cheating', 1);
    expect((await previewRegrade(1)).total).toBe(1);
    await expect(voidAttempt(2, 'again', 1)).rejects.toThrow('submitted');
    await unvoidAttempt(2, 1);
    expect((await previewRegrade(1)).total).toBe(2);
  });
});
