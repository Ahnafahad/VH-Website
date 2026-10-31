/** OMR import against a local temp libSQL file (never Turso). */
import os from 'os';
import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('@/lib/db', () => ({ get db() { return holder.db; } }));

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import * as schema from '@/lib/db/schema';
import { importOmr, parseOmrFile, cleanAnswer, OmrImportError } from '../omr-import';

const DDL = [
  'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, student_id TEXT UNIQUE)',
  `CREATE TABLE tests (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT, title TEXT, bucket TEXT, description TEXT, status TEXT DEFAULT 'published',
    allowed_products TEXT, is_diagnostic INTEGER DEFAULT 0, total_questions INTEGER DEFAULT 0, total_marks REAL DEFAULT 0, results_published_at INTEGER,
    source_file TEXT, syllabus TEXT, category TEXT, is_mock INTEGER NOT NULL DEFAULT 0, mock_batch TEXT, exam_code TEXT, essay_series_id INTEGER, solution_pdf_key TEXT,
    created_by INTEGER, created_at INTEGER DEFAULT (unixepoch()), updated_at INTEGER DEFAULT (unixepoch()))`,
  `CREATE TABLE test_sections (id INTEGER PRIMARY KEY AUTOINCREMENT, test_id INTEGER, "order" INTEGER, title TEXT, total_questions INTEGER DEFAULT 0,
    total_marks REAL DEFAULT 0, marks_per_correct REAL DEFAULT 1, penalty_per_wrong REAL DEFAULT 0.25, threshold_percent REAL)`,
  `CREATE TABLE test_questions (id INTEGER PRIMARY KEY AUTOINCREMENT, section_id INTEGER, group_id INTEGER, "order" INTEGER, number INTEGER, type TEXT DEFAULT 'mcq',
    stem TEXT, options TEXT, correct_key TEXT, image_url TEXT, explanation TEXT)`,
  `CREATE TABLE test_windows (id INTEGER PRIMARY KEY AUTOINCREMENT, test_id INTEGER, mode TEXT, opens_at INTEGER, closes_at INTEGER, duration_minutes INTEGER,
    class_session_id INTEGER, status TEXT DEFAULT 'scheduled', created_by INTEGER, created_at INTEGER DEFAULT (unixepoch()))`,
  `CREATE TABLE test_attempts (id INTEGER PRIMARY KEY AUTOINCREMENT, test_id INTEGER, user_id INTEGER, window_id INTEGER, mode TEXT, status TEXT DEFAULT 'in_progress',
    started_at INTEGER DEFAULT (unixepoch()), submitted_at INTEGER, banned_at INTEGER, tab_leave_count INTEGER DEFAULT 0, reset_count INTEGER DEFAULT 0, total_score REAL,
    total_correct INTEGER, total_wrong INTEGER, total_unattempted INTEGER, section_scores TEXT, chosen_sections TEXT, best_snapshot TEXT,
    result_source TEXT NOT NULL DEFAULT 'self', UNIQUE(test_id, user_id))`,
  'CREATE TABLE test_answers (id INTEGER PRIMARY KEY AUTOINCREMENT, attempt_id INTEGER, question_id INTEGER, selected_key TEXT, flagged INTEGER DEFAULT 0, answered_at INTEGER DEFAULT (unixepoch()), UNIQUE(attempt_id, question_id))',
];

type D = ReturnType<typeof drizzle<typeof schema>>;
const d = () => holder.db as D;

// 2 sections: English (q1,q2 → keys A,B), Math (q3 → key C). Students: 111 (typed answers), 222 (none), 333 (banned).
beforeEach(async () => {
  const client = createClient({ url: `file:${path.join(os.tmpdir(), `omr-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.db`)}` });
  for (const s of DDL) await client.execute(s);
  holder.db = drizzle(client, { schema });
  const db = d();
  await client.execute("INSERT INTO users (id, name, student_id) VALUES (1,'Ann','111'),(2,'Bo','222'),(3,'Cy','333')");
  await db.insert(schema.tests).values({ slug: 'm1', title: 'Mock 1', bucket: 'iba', isMock: true, examCode: '9001' } as never);
  await db.insert(schema.testSections).values([
    { testId: 1, order: 1, title: 'English', totalQuestions: 2, totalMarks: 2, marksPerCorrect: 1, penaltyPerWrong: 0.25 },
    { testId: 1, order: 2, title: 'Math', totalQuestions: 1, totalMarks: 1, marksPerCorrect: 1, penaltyPerWrong: 0.25 },
  ]);
  await db.insert(schema.testQuestions).values([
    { sectionId: 1, order: 1, number: 1, stem: 'q1', options: '[]', correctKey: 'A' },
    { sectionId: 1, order: 2, number: 2, stem: 'q2', options: '[]', correctKey: 'B' },
    { sectionId: 2, order: 1, number: 1, stem: 'q3', options: '[]', correctKey: 'C' },
  ]);
  await db.insert(schema.testWindows).values({ testId: 1, mode: 'offline', opensAt: new Date(1000), closesAt: new Date(5000) } as never);
  // Ann typed A, A, (blank) online-style; Cy is banned.
  await db.insert(schema.testAttempts).values([
    { testId: 1, userId: 1, windowId: 1, mode: 'offline', status: 'submitted', totalScore: 0.75 },
    { testId: 1, userId: 3, windowId: 1, mode: 'online', status: 'banned' },
  ] as never);
  await db.insert(schema.testAnswers).values([
    { attemptId: 1, questionId: 1, selectedKey: 'A' }, { attemptId: 1, questionId: 2, selectedKey: 'A' },
  ]);
});

const sheet = (answers: (string | null)[]) => ({ examCode: '9001', results: [{ studentId: '111', answers }] });

describe('cleanAnswer', () => {
  it('keeps single letters A-E and treats everything else as blank', () => {
    expect(['a', ' B ', 'E'].map(cleanAnswer)).toEqual(['A', 'B', 'E']);
    expect(['', 'AB', '*', 'F', null, 3].map(cleanAnswer)).toEqual([null, null, null, null, null, null]);
  });
});

describe('parseOmrFile', () => {
  it('rejects malformed files', () => {
    expect(() => parseOmrFile({})).toThrow(OmrImportError);
    expect(() => parseOmrFile({ results: [{ studentId: '1' }] })).toThrow(/answers/);
  });
});

describe('importOmr', () => {
  it('dry run reports but writes nothing', async () => {
    const r = await importOmr(1, sheet(['A', 'B', 'C']), false);
    expect(r).toMatchObject({ applied: false, matched: 1, overwritten: 1, created: 0, expectedLength: 3 });
    const a = await d().select().from(schema.testAttempts).where(eq(schema.testAttempts.id, 1)).get();
    expect(a!.totalScore).toBe(0.75);
    expect(a!.resultSource).toBe('self');
  });

  it('overwrites typed answers, rescoring from the scan and marking the attempt official', async () => {
    const r = await importOmr(1, sheet(['A', 'B', 'D']), true); // 2 right, 1 wrong → 2 - 0.25
    expect(r).toMatchObject({ applied: true, overwritten: 1 });
    const a = await d().select().from(schema.testAttempts).where(eq(schema.testAttempts.id, 1)).get();
    expect(a).toMatchObject({ totalScore: 1.75, totalCorrect: 2, totalWrong: 1, totalUnattempted: 0, resultSource: 'omr', status: 'submitted' });
    const answers = await d().select().from(schema.testAnswers).where(eq(schema.testAnswers.attemptId, 1));
    expect(answers.map(x => x.selectedKey).sort()).toEqual(['A', 'B', 'D']);
  });

  it('creates an offline attempt for a student who typed nothing, storing only non-blank answers', async () => {
    const r = await importOmr(1, { results: [{ studentId: '222', answers: ['A', null, '*'] }] }, true);
    expect(r).toMatchObject({ created: 1, overwritten: 0 });
    const a = await d().select().from(schema.testAttempts).where(eq(schema.testAttempts.userId, 2)).get();
    expect(a).toMatchObject({ mode: 'offline', windowId: 1, totalScore: 1, totalUnattempted: 2, resultSource: 'omr' });
    expect(a!.submittedAt!.getTime()).toBe(5000);
    const answers = await d().select().from(schema.testAnswers).where(eq(schema.testAnswers.attemptId, a!.id));
    expect(answers).toHaveLength(1);
  });

  it('flags unknown ids, wrong-length sheets, duplicates and banned students without touching them', async () => {
    const r = await importOmr(1, { results: [
      { studentId: '999', answers: ['A', 'B', 'C'] },
      { studentId: '222', answers: ['A'] },
      { studentId: '333', answers: ['A', 'B', 'C'] },
      { studentId: '111', answers: ['A', 'B', 'C'] },
      { studentId: '111', answers: ['B', 'B', 'B'] },
    ] }, true);
    expect(r).toMatchObject({
      unknownStudents: ['999'], badLength: ['222'], skippedBanned: ['333'], duplicates: ['111'], matched: 1,
    });
    const banned = await d().select().from(schema.testAttempts).where(eq(schema.testAttempts.userId, 3)).get();
    expect(banned!.status).toBe('banned');
  });

  it('refuses a sheet for a different exam code, and a mock with no offline window', async () => {
    await expect(importOmr(1, { examCode: '9002', results: [] }, true)).rejects.toThrow(/mismatch/);
    await d().delete(schema.testWindows);
    await expect(importOmr(1, sheet(['A', 'B', 'C']), true)).rejects.toThrow(/offline window/);
  });
});
