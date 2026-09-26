/**
 * Integration test for the Redline service against a local in-memory libSQL database (never Turso):
 * level locking, grading, idempotency, transfer reclassification, replay handling and cohort scoping.
 * Table DDL comes from scripts/redline/schema.sql — the same file the importer runs on production.
 */

import fs from 'fs';
import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-utils', () => ({
  ApiException: class ApiException extends Error {
    status: number; code?: string;
    constructor(message: string, status = 500, code?: string) { super(message); this.status = status; this.code = code; }
  },
}));

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('@/lib/db', () => ({ get db() { return holder.db; } }));

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '@/lib/db/schema';
import { users, userAccess, redlineQuestions, redlineResponses } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import * as svc from '../service';

const SCHEMA_SQL = fs.readFileSync(path.resolve(__dirname, '../../../../scripts/redline/schema.sql'), 'utf8');

const content = (correct: string) => ({
  sentence: 'She walk to school every day.', span: 'walk',
  options: { A: 'walk', B: 'walks', C: 'walking', D: 'to walk', E: 'walked' },
  meaning: 'A daily walk.', xray: [{ label: 'subject', text: 'She' }], decision: 'Agreement?',
  hint1: 'Check the subject.', hint2: 'Singular subject, present tense.',
  correct, proof: 'Singular subject needs a singular verb.', closestCompetitor: 'A', whyCompetitorFails: 'Plural form.',
  distractors: {
    A: { status: 'incorrect', issue: 'Plural verb.', attraction: 'Repeats the original.', misconception: 'plural-verb', family: 'sv-agreement', trap: 'keeps-original' },
    B: { status: 'correct', reason: 'Agrees.' },
    C: { status: 'incorrect', issue: 'Fragment.', attraction: 'Sounds natural.', misconception: 'gerund', family: 'fragment-runon', trap: 'sounds-natural' },
    D: { status: 'incorrect', issue: 'Infinitive.', attraction: 'Formal.', misconception: 'inf', family: 'idiom-error', trap: 'sounds-sophisticated' },
    E: { status: 'incorrect', issue: 'Tense.', attraction: 'Fixes number.', misconception: 'tense', family: 'tense-error', trap: 'partial-fix' },
  },
  explanation: 'Agreement.', deeper: 'Deeper.', whyMiss: 'Distance.', howCatch: 'Find the subject.',
  transfer: { prompt: 'He ___ home.', options: { A: 'go', B: 'goes', C: 'going' }, answer: 'B', explanation: 'goes.' },
  skills: { primary: 'Subject-Verb Agreement', secondary: [] }, relatedItems: [], reviewFamily: null, masterySkillId: null, sourcePdfPage: 1,
});

let seq = 0;
async function addQuestion(level: number, position: number) {
  seq++;
  await (holder.db as ReturnType<typeof drizzle>).insert(redlineQuestions).values({
    number: seq, sourceId: `sc-${seq}`, level, position, status: 'live', skillId: 'sv-agreement',
    secondarySkills: '[]', difficultyLabel: 'standard', difficultyScore: 2, correctKey: 'B',
    content: JSON.stringify(content('B')), staff: '{}',
  });
}

let student: { id: number; role: string };
let other: { id: number; role: string };
let staff: { id: number; role: string };

beforeEach(async () => {
  seq = 0;
  const client = createClient({ url: ':memory:' });
  const db = drizzle(client, { schema });
  holder.db = db;
  await client.executeMultiple(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, role TEXT NOT NULL,
      status TEXT NOT NULL, student_id TEXT UNIQUE, batch TEXT, class TEXT, notes TEXT, whatsapp TEXT,
      is_teaching INTEGER, avatar_character_id INTEGER, avatar_custom_request TEXT, avatar_request_status TEXT,
      onboarding_skips INTEGER NOT NULL, onboarded_at INTEGER, push_subscription TEXT,
      notify_materials INTEGER NOT NULL, notify_announcements INTEGER NOT NULL, notify_comment_reply INTEGER NOT NULL,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE user_access (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, product TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1, granted_at INTEGER NOT NULL DEFAULT (unixepoch()), granted_by INTEGER,
      UNIQUE (user_id, product));
  `);
  await client.executeMultiple(SCHEMA_SQL);

  const mk = async (email: string, role: string, batch: string | null) => {
    const [u] = await db.insert(users).values({
      email, name: email.split('@')[0], role, status: 'active', batch,
      onboardingSkips: 0, notifyMaterials: true, notifyAnnouncements: true, notifyCommentReply: true,
      createdAt: new Date(), updatedAt: new Date(),
    }).returning();
    if (role === 'student') await db.insert(userAccess).values({ userId: u.id, product: 'iba', active: true });
    return { id: u.id, role };
  };
  student = await mk('ana@t.com', 'student', '2026-27');
  other = await mk('bob@t.com', 'student', '2026-27');
  staff = await mk('teach@t.com', 'instructor', null);

  for (const level of [1, 2]) for (const pos of [1, 2, 3]) await addQuestion(level, pos);
});

const submit = (attemptId: number, q: { id: number }, selectedKey: string | null, confidence: 'sure' | 'unsure' | 'guess' | null = 'sure') =>
  svc.recordResponse(student.id, attemptId, {
    questionId: q.id, selectedKey, confidence, firstClickMs: 2000, totalTimeMs: 30000,
    changes: selectedKey ? [{ key: selectedKey, t: 2000 }] : [], hint1Ms: null, hint2Ms: null,
  });

async function playLevel(level: number, picks: (string | null)[]) {
  const start = await svc.startLevel(student, level, false);
  for (let i = 0; i < start.questions.length; i++) await submit(start.attemptId, start.questions[i], picks[i]);
  const summary = await svc.finishAttempt(student.id, start.attemptId);
  return { start, summary };
}

describe('level gating', () => {
  it('locks level 2 for a student until level 1 is finished; staff bypass', async () => {
    await expect(svc.startLevel(student, 2, false)).rejects.toMatchObject({ code: 'LEVEL_LOCKED' });
    await expect(svc.startLevel(staff, 2, false)).resolves.toBeTruthy();
    await playLevel(1, ['B', 'B', 'B']);
    await expect(svc.startLevel(student, 2, false)).resolves.toBeTruthy();
  });

  it('reports tile status: done, open, locked', async () => {
    await playLevel(1, ['B', 'A', 'B']);
    const { levels } = await svc.getOverview(student.id);
    expect(levels.map(l => l.status)).toEqual(['done', 'open']);
    expect(levels[0].firstScore).toEqual({ correct: 2, total: 3 });
  });

  it('unknown level is 404', async () => {
    await expect(svc.startLevel(student, 99, false)).rejects.toMatchObject({ status: 404 });
  });
});

describe('taking a level', () => {
  it('never sends keys or explanations with the questions', async () => {
    const start = await svc.startLevel(student, 1, false);
    const blob = JSON.stringify(start.questions);
    expect(blob).not.toContain('proof');
    expect(blob).not.toContain('correctKey');
    expect(blob).not.toContain('explanation');
    expect(start.questions).toHaveLength(3);
  });

  it('grades server-side, classifies, and is idempotent per question', async () => {
    const { attemptId, questions } = await svc.startLevel(student, 1, false);
    const right = await submit(attemptId, questions[0], 'B', 'sure');
    expect(right).toMatchObject({ correctKey: 'B', isCorrect: true, klass: 'mastered', transfer: null });
    const wrong = await submit(attemptId, questions[1], 'A', 'sure');
    expect(wrong).toMatchObject({ isCorrect: false, klass: 'misconception' });
    expect(wrong.transfer?.prompt).toContain('___');
    expect(JSON.stringify(wrong.transfer)).not.toContain('"answer"');
    const again = await submit(attemptId, questions[1], 'B', 'sure'); // replayed request must not re-grade
    expect(again.isCorrect).toBe(false);
    const rows = await (holder.db as ReturnType<typeof drizzle>).select().from(redlineResponses);
    expect(rows).toHaveLength(2);
    expect(rows.find(r => r.selectedKey === 'A')).toMatchObject({ errorFamily: 'sv-agreement', trapType: 'keeps-original' });
  });

  it('rejects invalid options and questions from another level', async () => {
    const { attemptId, questions } = await svc.startLevel(student, 1, false);
    await expect(submit(attemptId, questions[0], 'Z')).rejects.toMatchObject({ code: 'BAD_OPTION' });
    const other2 = (await (holder.db as ReturnType<typeof drizzle>).select().from(redlineQuestions).where(eq(redlineQuestions.level, 2)))[0];
    await expect(submit(attemptId, { id: other2.id }, 'B')).rejects.toMatchObject({ code: 'BAD_QUESTION' });
  });

  it("won't let another student write into your attempt", async () => {
    const { attemptId, questions } = await svc.startLevel(student, 1, false);
    await expect(svc.recordResponse(other.id, attemptId, {
      questionId: questions[0].id, selectedKey: 'B', confidence: 'sure', firstClickMs: 1, totalTimeMs: 1, changes: [], hint1Ms: null, hint2Ms: null,
    })).rejects.toMatchObject({ status: 404 });
  });

  it('refuses to finish until every question is answered, then resumes where it left off', async () => {
    const { attemptId, questions } = await svc.startLevel(student, 1, false);
    await submit(attemptId, questions[0], 'B');
    await expect(svc.finishAttempt(student.id, attemptId)).rejects.toMatchObject({ code: 'INCOMPLETE' });
    const resumed = await svc.startLevel(student, 1, false);
    expect(resumed.attemptId).toBe(attemptId);
    expect(resumed.answeredQuestionIds).toEqual([questions[0].id]);
  });

  it('turns a confident miss into a slip when the transfer item is solved', async () => {
    const { attemptId, questions } = await svc.startLevel(student, 1, false);
    await submit(attemptId, questions[0], 'A', 'sure');
    const r = await svc.patchResponse(student.id, attemptId, questions[0].id, { transferKey: 'B', transferMs: 9000, dwellMs: 5000 });
    expect(r).toMatchObject({ transferCorrect: true, klass: 'slip' });
    const again = await svc.patchResponse(student.id, attemptId, questions[0].id, { transferKey: 'C', transferMs: 1 });
    expect(again.transferCorrect).toBe(true); // a second attempt can't overwrite the first
  });

  it('keeps a confident miss a misconception when the transfer item is failed', async () => {
    const { attemptId, questions } = await svc.startLevel(student, 1, false);
    await submit(attemptId, questions[0], 'A', 'sure');
    const r = await svc.patchResponse(student.id, attemptId, questions[0].id, { transferKey: 'A', transferMs: 9000 });
    expect(r).toMatchObject({ transferCorrect: false, klass: 'misconception' });
  });
});

describe('replays and analysis scope', () => {
  it('needs replay=true to redo a finished level, and replays never feed the analysis', async () => {
    await playLevel(1, ['A', 'A', 'A']);
    await expect(svc.startLevel(student, 1, false)).rejects.toMatchObject({ code: 'ALREADY_DONE' });
    const replay = await svc.startLevel(student, 1, true);
    expect(replay.isFirst).toBe(false);
    for (const q of replay.questions) await submit(replay.attemptId, q, 'B');
    const fin = await svc.finishAttempt(student.id, replay.attemptId);
    expect(fin.correct).toBe(3);
    const { analysis, levels } = await svc.getOverview(student.id);
    expect(analysis.answered).toBe(3);   // first attempt only
    expect(analysis.correct).toBe(0);
    expect(levels[0]).toMatchObject({ firstScore: { correct: 0, total: 3 }, bestScore: { correct: 3, total: 3 }, attempts: 2 });
  });

  it('attaches authored teaching text to weaknesses', async () => {
    await playLevel(1, ['A', 'A', 'A']);
    const a = await svc.getUserAnalysis(student.id);
    const skill = a.weaknesses.find(w => w.kind === 'skill');
    // three answers in one skill: enough to be flagged, and teaching text pulled from a missed question
    expect(a.skills.find(s => s.id === 'sv-agreement')!.answered).toBe(3);
    if (skill) expect(skill.howCatch).toBe('Find the subject.');
  });
});

describe('config and cohort', () => {
  it('starts switched off and toggles', async () => {
    expect((await svc.getConfig()).active).toBe(false);
    await svc.setActive(true);
    expect((await svc.getConfig()).active).toBe(true);
    await svc.setActive(false);
    expect((await svc.getConfig()).active).toBe(false);
  });

  it('cohort counts eligible students, excludes staff, and flags a dominant wrong option', async () => {
    await playLevel(1, ['A', 'A', 'A']);
    // staff attempt must not appear in cohort analytics
    const s = await svc.startLevel(staff, 1, false);
    for (const q of s.questions) await svc.recordResponse(staff.id, s.attemptId, {
      questionId: q.id, selectedKey: 'B', confidence: 'sure', firstClickMs: 1, totalTimeMs: 1, changes: [], hint1Ms: null, hint2Ms: null,
    });
    const c = await svc.getCohort();
    expect(c.eligible).toBe(2);
    expect(c.started).toBe(1);
    expect(c.students[0]).toMatchObject({ name: 'ana', levelsDone: 1, answered: 3 });
    expect(c.levels[0]).toMatchObject({ level: 1, started: 1, finished: 1 });
    expect(c.questions.every(q => q.n === 1)).toBe(true);
  });
});
