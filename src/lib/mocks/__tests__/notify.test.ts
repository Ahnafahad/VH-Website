/** The "your final rank is published" emails, against a local temp libSQL file (never Turso, never Resend). */
import os from 'os';
import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const holder = vi.hoisted(() => ({ db: null as unknown, sent: [] as { to: string; mail: { subject: string; html: string; text: string } }[] }));
vi.mock('@/lib/db', () => ({ get db() { return holder.db; } }));
vi.mock('@/lib/email', () => ({
  sendHtmlEmailBatch: vi.fn(async (items: typeof holder.sent) => { holder.sent.push(...items); return { sent: items.length, failed: 0 }; }),
}));

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '@/lib/db/schema';
import { notifyMockPublished } from '../notify';

const DDL = [
  'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT, batch TEXT)',
  `CREATE TABLE tests (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT, title TEXT, bucket TEXT, description TEXT, status TEXT DEFAULT 'published',
    allowed_products TEXT, is_diagnostic INTEGER DEFAULT 0, total_questions INTEGER DEFAULT 0, total_marks REAL DEFAULT 0, results_published_at INTEGER,
    source_file TEXT, syllabus TEXT, category TEXT, is_mock INTEGER NOT NULL DEFAULT 0, mock_batch TEXT, elective_count INTEGER, exam_code TEXT, essay_series_id INTEGER, solution_pdf_key TEXT,
    created_by INTEGER, created_at INTEGER DEFAULT (unixepoch()), updated_at INTEGER DEFAULT (unixepoch()))`,
  `CREATE TABLE test_attempts (id INTEGER PRIMARY KEY AUTOINCREMENT, test_id INTEGER, user_id INTEGER, window_id INTEGER, mode TEXT, status TEXT DEFAULT 'in_progress',
    started_at INTEGER DEFAULT (unixepoch()), submitted_at INTEGER, banned_at INTEGER, tab_leave_count INTEGER DEFAULT 0, reset_count INTEGER DEFAULT 0, total_score REAL,
    total_correct INTEGER, total_wrong INTEGER, total_unattempted INTEGER, section_scores TEXT, chosen_sections TEXT, best_snapshot TEXT,
    result_source TEXT NOT NULL DEFAULT 'self', UNIQUE(test_id, user_id))`,
  'CREATE TABLE lms_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL DEFAULT (unixepoch()))',
];

beforeEach(async () => {
  holder.sent.length = 0;
  const client = createClient({ url: `file:${path.join(os.tmpdir(), `notify-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.db`)}` });
  for (const s of DDL) await client.execute(s);
  holder.db = drizzle(client, { schema });
  await client.execute("INSERT INTO users (id, name, email, batch) VALUES (1,'Ann','ann@gmail.com','2026-27'),(2,'Bo','bo@gmail.com',NULL),(3,'Cy','cy@gmail.com','2026-27')");
  await client.execute("INSERT INTO tests (id, slug, title, bucket, is_mock, total_marks, results_published_at) VALUES (1,'bth-mock-1','BTH Mock 1','iba',1,70,unixepoch())");
  // Ann 50, Bo 61.5 (no batch: still ranked with everyone), Cy did not submit
  await client.execute("INSERT INTO test_attempts (test_id, user_id, mode, status, total_score) VALUES (1,1,'online','submitted',50),(1,2,'offline','submitted',61.5),(1,3,'online','in_progress',NULL)");
});

describe('notifyMockPublished', () => {
  it('emails everyone who sat the mock their combined rank, whatever their batch', async () => {
    const res = await notifyMockPublished(1);
    expect(res.sent).toBe(2);
    const bo = holder.sent.find(s => s.to === 'bo@gmail.com')!;
    const ann = holder.sent.find(s => s.to === 'ann@gmail.com')!;
    expect(bo.mail.subject).toContain('BTH Mock 1');
    expect(bo.mail.text).toContain('Your rank: 1 of 2');
    expect(ann.mail.text).toContain('Your rank: 2 of 2');
    expect(holder.sent.find(s => s.to === 'cy@gmail.com')).toBeUndefined();
  });

  it('sends only once per mock, even if results are unpublished and republished', async () => {
    await notifyMockPublished(1);
    const again = await notifyMockPublished(1);
    expect(again.skipped).toBe(true);
    expect(holder.sent).toHaveLength(2);
  });

  it('sends nothing for a mock that is not published', async () => {
    const client = (holder.db as { $client: { execute: (s: string) => Promise<unknown> } }).$client;
    await client.execute('UPDATE tests SET results_published_at = NULL WHERE id = 1');
    expect((await notifyMockPublished(1)).skipped).toBe(true);
    expect(holder.sent).toHaveLength(0);
  });
});
