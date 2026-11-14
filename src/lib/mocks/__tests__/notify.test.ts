/** The mock results emails, against a local temp libSQL file (never Turso, never Resend). Names are fake. */
import os from 'os';
import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const holder = vi.hoisted(() => ({
  db: null as unknown,
  calls: [] as { to: string; mail: { subject: string; html: string; text: string } }[][],
  failNext: false,
  scheduled: [] as { n: number; at: string }[],
  totals: new Map<number, number>(),
}));
vi.mock('@/lib/db', () => ({ get db() { return holder.db; } }));
vi.mock('@/lib/email', () => ({
  sendHtmlEmailBatch: vi.fn(async (items: typeof holder.calls[number]) => {
    holder.calls.push(items);
    if (holder.failNext) { holder.failNext = false; return { sent: 0, failed: items.length }; }
    return { sent: items.length, failed: 0 };
  }),
  sendHtmlEmailScheduled: vi.fn(async (items: unknown[], at: Date) => {
    holder.scheduled.push({ n: items.length, at: at.toISOString() });
    return { scheduled: items.length, failed: 0, ids: items.map((_, i) => `id${i}`) };
  }),
}));
vi.mock('@/lib/db-access-control', () => ({ getUserById: vi.fn(async (id: number) => ({ id })) }));
vi.mock('../service', () => ({
  getMockRanking: vi.fn(async () => {
    const sorted = [...holder.totals.entries()].sort((a, b) => b[1] - a[1]);
    return {
      outOf: sorted.length, maxTotal: 100,
      byUser: new Map(sorted.map(([id, total], i) => [id, { rank: i + 1, percentile: 50, mcq: total, essay: 0, total, online: true }])),
    };
  }),
  getMockResult: vi.fn(async (user: { id: number }) => {
    const total = holder.totals.get(user.id)!;
    const rank = [...holder.totals.values()].filter(t => t > total).length + 1;
    return {
      phase: 'official', title: 'BTH Mock 4',
      mcq: { score: total, maxScore: 70, correct: 10, wrong: 4, unattempted: 2, sections: [{ title: 'English', score: total, maxScore: 30, correct: 10, wrong: 4, unattempted: 2 }] },
      essayTotal: 0, essayMax: 30, combined: total, maxTotal: 100,
      me: { rank, percentile: 50, outOf: holder.totals.size, online: true },
      missed: [{ sectionId: 1, title: 'English', wrong: 4, skipped: 2, penaltyLost: 1, chances: [{ questionId: 1, number: 7, cohortCorrectPct: 80, mine: 'wrong', yourAnswer: 'B', correctAnswer: 'D' }] }],
      leaderboard: [], essays: null, omrStatus: null, hasOmrImage: false, solutionUrl: null, solutionsHref: null, reviewHref: '',
    };
  }),
}));

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '@/lib/db/schema';
import { notifyMockPublished } from '../notify';

const DDL = [
  'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT, batch TEXT, student_id TEXT)',
  `CREATE TABLE tests (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT, title TEXT, bucket TEXT, description TEXT, status TEXT DEFAULT 'published',
    allowed_products TEXT, is_diagnostic INTEGER DEFAULT 0, total_questions INTEGER DEFAULT 0, total_marks REAL DEFAULT 0, results_published_at INTEGER,
    source_file TEXT, syllabus TEXT, category TEXT, is_mock INTEGER NOT NULL DEFAULT 0, mock_batch TEXT, elective_count INTEGER, exam_code TEXT, essay_series_id INTEGER, solution_pdf_key TEXT,
    created_by INTEGER, created_at INTEGER DEFAULT (unixepoch()), updated_at INTEGER DEFAULT (unixepoch()))`,
  'CREATE TABLE lms_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL DEFAULT (unixepoch()))',
  'CREATE TABLE user_access (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, product TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, granted_at INTEGER NOT NULL DEFAULT (unixepoch()), granted_by INTEGER, UNIQUE(user_id, product))',
];

type Raw = { execute: (s: string) => Promise<{ rows: Record<string, unknown>[] }> };
const raw = () => (holder.db as { $client: Raw }).$client;

// ids 1-2 are batch students; 3-9 are externals with totals 90..30 (so the top 5 externals are 3-7, the 6th is 8)
beforeEach(async () => {
  holder.calls.length = 0; holder.scheduled.length = 0; holder.failNext = false; holder.totals.clear();
  const client = createClient({ url: `file:${path.join(os.tmpdir(), `notify-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.db`)}` });
  for (const s of DDL) await client.execute(s);
  holder.db = drizzle(client, { schema });
  await client.execute("INSERT INTO users (id, name, email, batch) VALUES (1,'Ann Batch','ann@example.com','2026-27'),(2,'Ben Batch','ben@example.com','2026-27')");
  holder.totals.set(1, 95); holder.totals.set(2, 20);
  for (let id = 3; id <= 9; id++) {
    await client.execute(`INSERT INTO users (id, name, email, batch) VALUES (${id},'Guest ${id}','guest${id}@example.com',NULL)`);
    holder.totals.set(id, 90 - (id - 3) * 10);
  }
  await client.execute("INSERT INTO tests (id, slug, title, bucket, is_mock, total_marks, results_published_at) VALUES (33,'bth-mock-4','BTH Mock 4','iba',1,70,unixepoch()),(1,'bth-mock-1','BTH Mock 1','iba',1,70,unixepoch())");
});

describe('notifyMockPublished', () => {
  it('sends externals first, then the batch, as two separate sends', async () => {
    const res = await notifyMockPublished(33);
    expect(res.sent).toBe(9);
    expect(holder.calls).toHaveLength(2);
    expect(holder.calls[0].every(i => i.to.startsWith('guest'))).toBe(true);
    expect(holder.calls[1].map(i => i.to).sort()).toEqual(['ann@example.com', 'ben@example.com']);
  });

  it('rewards only the top 5 externals (by combined score) on Mock 4, and grants them Mock Access first', async () => {
    await notifyMockPublished(33);
    const rewarded = holder.calls[0].filter(i => i.mail.html.includes("You've unlocked Mock 5 onwards")).map(i => i.to).sort();
    expect(rewarded).toEqual(['guest3@example.com', 'guest4@example.com', 'guest5@example.com', 'guest6@example.com', 'guest7@example.com']);
    const granted = (await raw().execute("SELECT user_id FROM user_access WHERE product='mock' ORDER BY user_id")).rows.map(r => Number(r.user_id));
    expect(granted).toEqual([3, 4, 5, 6, 7]);
    // batch students never get the reward block, even with a top score
    expect(holder.calls[1].some(i => i.mail.html.includes('unlocked'))).toBe(false);
  });

  it('has no reward and no grants for other mocks', async () => {
    await notifyMockPublished(1);
    expect(holder.calls.flat().some(i => i.mail.html.includes('unlocked'))).toBe(false);
    expect((await raw().execute('SELECT COUNT(*) n FROM user_access')).rows[0].n).toBe(0);
  });

  it('never sends a group twice, and stops before the batch if the externals fail', async () => {
    holder.failNext = true;
    const first = await notifyMockPublished(33);
    expect(first.failed).toBe(7);
    expect(holder.calls).toHaveLength(1); // internals not attempted
    const retry = await notifyMockPublished(33);
    expect(retry.sent).toBe(9);
    const again = await notifyMockPublished(33);
    expect(again.sent).toBe(0);
    expect(holder.calls).toHaveLength(3); // failed externals, retried externals, internals; nothing on the third run
  });

  it('schedules instead of sending: externals at the time, the batch 10 minutes later, and only once', async () => {
    const at = new Date('2026-11-15T04:00:00Z');
    await notifyMockPublished(33, { at });
    expect(holder.calls).toHaveLength(0);
    expect(holder.scheduled).toEqual([{ n: 7, at: '2026-11-15T04:00:00.000Z' }, { n: 2, at: '2026-11-15T04:10:00.000Z' }]);
    await notifyMockPublished(33, { at });
    expect(holder.scheduled).toHaveLength(2);
  });

  it('writes no NaN/undefined into any email', async () => {
    await notifyMockPublished(33);
    for (const i of holder.calls.flat()) { expect(i.mail.html).not.toMatch(/NaN|undefined|null/); expect(i.mail.text).not.toMatch(/NaN|undefined/); }
  });

  it('sends nothing for a mock that is not published', async () => {
    await raw().execute('UPDATE tests SET results_published_at = NULL WHERE id = 33');
    expect((await notifyMockPublished(33)).skipped).toBe(true);
    expect(holder.calls).toHaveLength(0);
  });
});
