/**
 * Server-side data service for Redline. Grading, classification and reveal all happen here — the
 * client never receives a correct key, proof or explanation before it has locked in an answer.
 */

import { db } from '@/lib/db';
import {
  redlineConfig, redlineQuestions, redlineAttempts, redlineResponses, users, userAccess,
  type RedlineQuestion, type RedlineAttempt, type RedlineResponse,
} from '@/lib/db/schema';
import { and, asc, eq, inArray, isNotNull, sql, type SQL } from 'drizzle-orm';
import { ApiException } from '@/lib/api-utils';
import { lmsStudentAudienceConditions } from '@/lib/lms/access';
import { classifyResponse, countSwitches } from './classify';
import { buildAnalysis, type AnalysisResponse } from './analysis';
import { familyLabel, skillLabel, trapLabel } from './taxonomy';
import { REDLINE_BATCH, REDLINE_PRODUCT } from './access';
import type {
  Confidence, RedlineAnalysis, RedlineContent, RedlineLevelTile, RedlineReveal,
  RedlineSubmitResponse, RedlineTakingQuestion, ResponseClass,
} from './types';

const CONFIDENCES: Confidence[] = ['sure', 'unsure', 'guess'];
const MAX_TIME_MS = 30 * 60 * 1000;

const clampMs = (v: unknown, max = MAX_TIME_MS) => Math.min(max, Math.max(0, Math.round(Number(v) || 0)));
const nullableMs = (v: unknown) => (v === null || v === undefined ? null : clampMs(v));

// ─── Config ──────────────────────────────────────────────────────────────────

export async function getConfig(): Promise<{ active: boolean }> {
  const row = await db.select().from(redlineConfig).where(eq(redlineConfig.id, 1)).get();
  return { active: row?.active ?? false };
}

export async function setActive(active: boolean): Promise<void> {
  await db.insert(redlineConfig).values({ id: 1, active })
    .onConflictDoUpdate({ target: redlineConfig.id, set: { active, updatedAt: new Date() } });
}

// ─── Level structure ─────────────────────────────────────────────────────────────

async function levelCounts(): Promise<Map<number, number>> {
  const rows = await db.select({ level: redlineQuestions.level, count: sql<number>`count(*)` })
    .from(redlineQuestions).where(isNotNull(redlineQuestions.level)).groupBy(redlineQuestions.level);
  return new Map(rows.map(r => [r.level as number, r.count]));
}

async function userAttempts(userId: number): Promise<RedlineAttempt[]> {
  return db.select().from(redlineAttempts).where(eq(redlineAttempts.userId, userId));
}

const isDone = (a: RedlineAttempt) => a.finishedAt !== null;

async function hasFinishedLevel(userId: number, level: number): Promise<boolean> {
  const row = await db.select({ id: redlineAttempts.id }).from(redlineAttempts)
    .where(and(eq(redlineAttempts.userId, userId), eq(redlineAttempts.level, level), isNotNull(redlineAttempts.finishedAt))).get();
  return !!row;
}

function buildTiles(counts: Map<number, number>, attempts: RedlineAttempt[]): RedlineLevelTile[] {
  const levels = [...counts.keys()].sort((a, b) => a - b);
  const doneLevels = new Set(attempts.filter(isDone).map(a => a.level));
  return levels.map(level => {
    const mine = attempts.filter(a => a.level === level);
    const finished = mine.filter(isDone);
    const first = mine.find(a => a.attemptNo === 1 && isDone(a)) ?? null;
    const best = finished.length ? finished.reduce((b, a) => (a.totalCorrect > b.totalCorrect ? a : b)) : null;
    const status = doneLevels.has(level) ? 'done' : level === 1 || doneLevels.has(level - 1) ? 'open' : 'locked';
    return {
      level, questionCount: counts.get(level) ?? 0, status,
      inProgress: mine.some(a => !isDone(a)),
      firstScore: first && { correct: first.totalCorrect, total: first.totalQuestions },
      bestScore: best && { correct: best.totalCorrect, total: best.totalQuestions },
      attempts: mine.length,
    };
  });
}

// ─── Analysis loading ────────────────────────────────────────────────────────────

const analysisColumns = {
  questionId: redlineResponses.questionId, userId: redlineResponses.userId, position: redlineResponses.position,
  selectedKey: redlineResponses.selectedKey, isCorrect: redlineResponses.isCorrect, klass: redlineResponses.klass,
  confidence: redlineResponses.confidence, totalTimeMs: redlineResponses.totalTimeMs, changes: redlineResponses.changes,
  hint1Ms: redlineResponses.hint1Ms, hint2Ms: redlineResponses.hint2Ms, transferKey: redlineResponses.transferKey,
  transferCorrect: redlineResponses.transferCorrect, errorFamily: redlineResponses.errorFamily,
  trapType: redlineResponses.trapType, createdAt: redlineResponses.createdAt,
  skillId: redlineResponses.skillId,
  number: redlineQuestions.number, level: redlineQuestions.level, secondary: redlineQuestions.secondarySkills,
  difficultyScore: redlineQuestions.difficultyScore, correctKey: redlineQuestions.correctKey,
};

type LoadedRow = AnalysisResponse & { userId: number };

async function loadFirstAttemptResponses(where: SQL | undefined): Promise<LoadedRow[]> {
  const rows = await db.select(analysisColumns).from(redlineResponses)
    .innerJoin(redlineQuestions, eq(redlineQuestions.id, redlineResponses.questionId))
    .where(where);
  return rows.map(r => ({
    questionId: r.questionId, userId: r.userId, number: r.number, level: r.level ?? 0, position: r.position,
    skillId: r.skillId, secondarySkills: JSON.parse(r.secondary) as string[],
    difficultyScore: r.difficultyScore, correctKey: r.correctKey,
    selectedKey: r.selectedKey, isCorrect: r.isCorrect, klass: r.klass as ResponseClass,
    confidence: r.confidence as Confidence | null, totalTimeMs: r.totalTimeMs,
    changes: JSON.parse(r.changes) as { key: string; t: number }[],
    hint1Ms: r.hint1Ms, hint2Ms: r.hint2Ms, transferKey: r.transferKey, transferCorrect: r.transferCorrect,
    errorFamily: r.errorFamily, trapType: r.trapType, createdAt: r.createdAt.getTime() / 1000,
  }));
}

/** Fills each weakness's authored "why students miss it / how to catch it" from a question they missed. */
async function attachTeaching(analysis: RedlineAnalysis): Promise<RedlineAnalysis> {
  const ids = [...new Set(analysis.weaknesses.map(w => w.teachQuestionId).filter((x): x is number => x !== null))];
  if (ids.length === 0) return analysis;
  const rows = await db.select({ id: redlineQuestions.id, content: redlineQuestions.content })
    .from(redlineQuestions).where(inArray(redlineQuestions.id, ids));
  const teach = new Map(rows.map(r => {
    const c = JSON.parse(r.content) as RedlineContent;
    return [r.id, { whyMiss: c.whyMiss, howCatch: c.howCatch }];
  }));
  for (const w of analysis.weaknesses) {
    const t = w.teachQuestionId !== null ? teach.get(w.teachQuestionId) : undefined;
    if (t) { w.whyMiss = t.whyMiss; w.howCatch = t.howCatch; }
  }
  return analysis;
}

export async function getUserAnalysis(userId: number, levelsDone?: number): Promise<RedlineAnalysis> {
  const rows = await loadFirstAttemptResponses(and(eq(redlineResponses.userId, userId), eq(redlineResponses.isFirst, true)));
  const done = levelsDone ?? new Set((await userAttempts(userId)).filter(isDone).map(a => a.level)).size;
  return attachTeaching(buildAnalysis(rows, done));
}

export async function getOverview(userId: number): Promise<{ levels: RedlineLevelTile[]; analysis: RedlineAnalysis }> {
  const [counts, attempts] = await Promise.all([levelCounts(), userAttempts(userId)]);
  const levelsDone = new Set(attempts.filter(isDone).map(a => a.level)).size;
  return { levels: buildTiles(counts, attempts), analysis: await getUserAnalysis(userId, levelsDone) };
}

// ─── Taking a level ───────────────────────────────────────────────────────────────

function toTakingQuestion(q: RedlineQuestion): RedlineTakingQuestion {
  const c = JSON.parse(q.content) as RedlineContent;
  return {
    id: q.id, position: q.position ?? 0, sentence: c.sentence, span: c.span,
    options: c.options, hint1: c.hint1, hint2: c.hint2,
  };
}

export async function startLevel(
  user: { id: number; role: string }, level: number, replay: boolean,
): Promise<{
  attemptId: number; level: number; isFirst: boolean; questions: RedlineTakingQuestion[];
  answeredQuestionIds: number[]; hasNextLevel: boolean;
}> {
  const qs = await db.select().from(redlineQuestions)
    .where(eq(redlineQuestions.level, level)).orderBy(asc(redlineQuestions.position));
  if (qs.length === 0) throw new ApiException('Level not found', 404, 'LEVEL_NOT_FOUND');

  const staff = user.role !== 'student';
  if (level > 1 && !staff && !(await hasFinishedLevel(user.id, level - 1))) {
    throw new ApiException('Finish the previous level to unlock this one', 403, 'LEVEL_LOCKED');
  }

  const load = async () => (await userAttempts(user.id)).filter(a => a.level === level);
  let mine = await load();
  let attempt = mine.find(a => !isDone(a)) ?? null;

  if (!attempt) {
    if (mine.some(isDone) && !replay) throw new ApiException('You have already finished this level', 409, 'ALREADY_DONE');
    const attemptNo = mine.reduce((m, a) => Math.max(m, a.attemptNo), 0) + 1;
    try {
      [attempt] = await db.insert(redlineAttempts).values({
        userId: user.id, level, attemptNo, isFirst: attemptNo === 1, totalQuestions: qs.length,
      }).returning();
    } catch (e) {
      if (!/UNIQUE constraint failed/i.test(e instanceof Error ? e.message : String(e))) throw e;
      mine = await load(); // double-click race: another request created it
      attempt = mine.find(a => !isDone(a)) ?? null;
      if (!attempt) throw e;
    }
  }

  const answered = await db.select({ questionId: redlineResponses.questionId }).from(redlineResponses)
    .where(eq(redlineResponses.attemptId, attempt.id));
  const counts = await levelCounts();
  return {
    attemptId: attempt.id, level, isFirst: attempt.isFirst,
    questions: qs.map(toTakingQuestion),
    answeredQuestionIds: answered.map(a => a.questionId),
    hasNextLevel: counts.has(level + 1),
  };
}

async function ownedAttempt(userId: number, attemptId: number): Promise<RedlineAttempt> {
  const a = await db.select().from(redlineAttempts).where(eq(redlineAttempts.id, attemptId)).get();
  if (!a || a.userId !== userId) throw new ApiException('Attempt not found', 404, 'ATTEMPT_NOT_FOUND');
  return a;
}

function buildReveal(q: RedlineQuestion, c: RedlineContent, r: Pick<RedlineResponse, 'selectedKey' | 'isCorrect' | 'klass'>): RedlineReveal {
  const distractors: RedlineReveal['distractors'] = {};
  for (const [k, d] of Object.entries(c.distractors)) {
    distractors[k] = d.status === 'correct'
      ? { status: 'correct', reason: d.reason }
      : {
        status: 'incorrect', issue: d.issue, attraction: d.attraction,
        familyLabel: d.family ? familyLabel(d.family) : undefined, trapLabel: d.trap ? trapLabel(d.trap) : undefined,
      };
  }
  return {
    questionId: q.id, correctKey: q.correctKey, selectedKey: r.selectedKey, isCorrect: r.isCorrect,
    klass: r.klass as ResponseClass, skillId: q.skillId, skillLabel: skillLabel(q.skillId),
    proof: c.proof, explanation: c.explanation, deeper: c.deeper, whyMiss: c.whyMiss, howCatch: c.howCatch,
    meaning: c.meaning, xray: c.xray, closestCompetitor: c.closestCompetitor, distractors,
    transfer: r.isCorrect ? null : { prompt: c.transfer.prompt, options: c.transfer.options },
  };
}

export async function recordResponse(userId: number, attemptId: number, body: RedlineSubmitResponse): Promise<RedlineReveal> {
  const attempt = await ownedAttempt(userId, attemptId);
  if (isDone(attempt)) throw new ApiException('This attempt is already finished', 409, 'ATTEMPT_FINISHED');

  const q = await db.select().from(redlineQuestions).where(eq(redlineQuestions.id, body.questionId)).get();
  if (!q || q.level !== attempt.level) throw new ApiException('Question does not belong to this level', 400, 'BAD_QUESTION');
  const content = JSON.parse(q.content) as RedlineContent;

  const existing = await db.select().from(redlineResponses)
    .where(and(eq(redlineResponses.attemptId, attemptId), eq(redlineResponses.questionId, q.id))).get();
  if (existing) return buildReveal(q, content, existing); // idempotent retry

  const selectedKey = body.selectedKey ?? null;
  if (selectedKey !== null && !(selectedKey in content.options)) throw new ApiException('Invalid option', 400, 'BAD_OPTION');
  const confidence = selectedKey === null ? null
    : CONFIDENCES.includes(body.confidence as Confidence) ? (body.confidence as Confidence) : 'unsure';
  const changes = (Array.isArray(body.changes) ? body.changes : []).slice(0, 40)
    .filter(c => c && typeof c.key === 'string' && c.key in content.options)
    .map(c => ({ key: c.key, t: clampMs(c.t) }));
  const hint1Ms = nullableMs(body.hint1Ms);
  const hint2Ms = hint1Ms === null ? null : nullableMs(body.hint2Ms);

  const isCorrect = selectedKey !== null && selectedKey === q.correctKey;
  const klass = classifyResponse({
    selectedKey, isCorrect, confidence, hint1Ms, hint2Ms, switches: countSwitches(changes), transferCorrect: null,
  });
  const picked = selectedKey && !isCorrect ? content.distractors[selectedKey] : null;

  const values = {
    attemptId, userId, questionId: q.id, position: q.position ?? 0, isFirst: attempt.isFirst,
    selectedKey, isCorrect, confidence,
    firstClickMs: clampMs(body.firstClickMs), totalTimeMs: clampMs(body.totalTimeMs),
    changes: JSON.stringify(changes), hint1Ms, hint2Ms,
    klass, skillId: q.skillId, errorFamily: picked?.family ?? null, trapType: picked?.trap ?? null,
  };
  try {
    await db.insert(redlineResponses).values(values);
  } catch (e) {
    if (!/UNIQUE constraint failed/i.test(e instanceof Error ? e.message : String(e))) throw e;
  }
  return buildReveal(q, content, { selectedKey, isCorrect, klass });
}

export async function patchResponse(
  userId: number, attemptId: number, questionId: number,
  body: { transferKey?: string | null; transferMs?: number; dwellMs?: number },
): Promise<{ transferCorrect: boolean | null; transferAnswer: string | null; transferExplanation: string | null; klass: ResponseClass }> {
  await ownedAttempt(userId, attemptId);
  const r = await db.select().from(redlineResponses)
    .where(and(eq(redlineResponses.attemptId, attemptId), eq(redlineResponses.questionId, questionId))).get();
  if (!r) throw new ApiException('Response not found', 404, 'RESPONSE_NOT_FOUND');

  const updates: Partial<typeof redlineResponses.$inferInsert> = {};
  if (body.dwellMs !== undefined) updates.dwellMs = Math.max(r.dwellMs, clampMs(body.dwellMs, 10 * 60 * 1000));

  let klass = r.klass as ResponseClass;
  let transferCorrect = r.transferCorrect;
  let transferAnswer: string | null = null;
  let transferExplanation: string | null = null;

  if (body.transferKey && !r.isCorrect && r.transferKey === null) {
    const q = await db.select().from(redlineQuestions).where(eq(redlineQuestions.id, questionId)).get();
    if (!q) throw new ApiException('Question not found', 404);
    const t = (JSON.parse(q.content) as RedlineContent).transfer;
    if (!(body.transferKey in t.options)) throw new ApiException('Invalid option', 400, 'BAD_OPTION');
    transferCorrect = body.transferKey === t.answer;
    transferAnswer = t.answer; transferExplanation = t.explanation;
    updates.transferKey = body.transferKey;
    updates.transferCorrect = transferCorrect;
    updates.transferMs = clampMs(body.transferMs);
    klass = classifyResponse({
      selectedKey: r.selectedKey, isCorrect: r.isCorrect, confidence: r.confidence as Confidence | null,
      hint1Ms: r.hint1Ms, hint2Ms: r.hint2Ms, switches: countSwitches(JSON.parse(r.changes)), transferCorrect,
    });
    updates.klass = klass;
  }
  if (Object.keys(updates).length) {
    await db.update(redlineResponses).set(updates).where(eq(redlineResponses.id, r.id));
  }
  return { transferCorrect, transferAnswer, transferExplanation, klass };
}

export interface LevelSummary {
  level: number;
  correct: number;
  total: number;
  totalTimeMs: number;
  isFirst: boolean;
  hasNextLevel: boolean;
  classes: Record<ResponseClass, number>;
  items: { position: number; isCorrect: boolean; klass: ResponseClass; skillLabel: string }[];
  topMisses: { label: string; count: number }[];
}

export async function finishAttempt(userId: number, attemptId: number): Promise<LevelSummary> {
  const attempt = await ownedAttempt(userId, attemptId);
  const responses = await db.select().from(redlineResponses).where(eq(redlineResponses.attemptId, attemptId))
    .orderBy(asc(redlineResponses.position));
  if (responses.length < attempt.totalQuestions) {
    throw new ApiException('Answer every question before finishing', 409, 'INCOMPLETE');
  }
  const correct = responses.filter(r => r.isCorrect).length;
  const totalTimeMs = responses.reduce((s, r) => s + r.totalTimeMs, 0);
  if (!isDone(attempt)) {
    await db.update(redlineAttempts)
      .set({ finishedAt: new Date(), totalCorrect: correct, totalTimeMs })
      .where(eq(redlineAttempts.id, attemptId));
  }
  const classes: Record<ResponseClass, number> = { mastered: 0, fragile: 0, lucky: 0, slip: 0, gap: 0, misconception: 0 };
  const misses = new Map<string, number>();
  for (const r of responses) {
    classes[r.klass as ResponseClass]++;
    if (!r.isCorrect) misses.set(r.skillId, (misses.get(r.skillId) ?? 0) + 1);
  }
  const counts = await levelCounts();
  return {
    level: attempt.level, correct, total: responses.length, totalTimeMs, isFirst: attempt.isFirst,
    hasNextLevel: counts.has(attempt.level + 1), classes,
    items: responses.map(r => ({ position: r.position, isCorrect: r.isCorrect, klass: r.klass as ResponseClass, skillLabel: skillLabel(r.skillId) })),
    topMisses: [...misses].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, count]) => ({ label: skillLabel(id), count })),
  };
}

// ─── Admin / cohort ───────────────────────────────────────────────────────────────

export interface CohortStudentRow {
  userId: number; name: string; email: string;
  levelsDone: number; answered: number; accuracy: number | null; mastery: number | null;
  topWeakness: string | null; inProgress: boolean;
}
export interface CohortSkillRow { id: string; label: string; meanMastery: number | null; students: number; weakStudents: number }
export interface CohortQuestionRow {
  questionId: number; number: number; level: number; skillLabel: string; n: number; correctRate: number;
  avgTimeMs: number; correctKey: string; picks: Record<string, number>; flag: string | null;
}
export interface Cohort {
  eligible: number; started: number; active: boolean;
  levels: { level: number; started: number; finished: number }[];
  skills: CohortSkillRow[];
  students: CohortStudentRow[];
  questions: CohortQuestionRow[];
}

export async function getCohort(): Promise<Cohort> {
  const [{ active }, counts, eligibleRows, attemptRows, studentRows] = await Promise.all([
    getConfig(),
    levelCounts(),
    db.selectDistinct({ id: users.id }).from(users).innerJoin(userAccess, eq(userAccess.userId, users.id))
      .where(and(...lmsStudentAudienceConditions({ product: REDLINE_PRODUCT, batch: REDLINE_BATCH }))),
    db.select().from(redlineAttempts),
    db.select({ id: users.id, name: users.name, email: users.email, role: users.role }).from(users),
  ]);
  const student = new Map(studentRows.filter(u => u.role === 'student').map(u => [u.id, u]));
  const attempts = attemptRows.filter(a => student.has(a.userId));

  const responses = (await loadFirstAttemptResponses(eq(redlineResponses.isFirst, true))).filter(r => student.has(r.userId));
  const byUser = new Map<number, LoadedRow[]>();
  for (const r of responses) (byUser.get(r.userId) ?? byUser.set(r.userId, []).get(r.userId)!).push(r);

  const analyses = new Map<number, RedlineAnalysis>();
  const students: CohortStudentRow[] = [];
  for (const [uid, rows] of byUser) {
    const mine = attempts.filter(a => a.userId === uid);
    const levelsDone = new Set(mine.filter(isDone).map(a => a.level)).size;
    const a = buildAnalysis(rows, levelsDone);
    analyses.set(uid, a);
    students.push({
      userId: uid, name: student.get(uid)!.name, email: student.get(uid)!.email,
      levelsDone, answered: a.answered, accuracy: a.accuracy, mastery: a.mastery,
      topWeakness: a.weaknesses[0]?.label ?? null, inProgress: mine.some(x => !isDone(x)),
    });
  }
  students.sort((x, y) => y.levelsDone - x.levelsDone || (y.mastery ?? 0) - (x.mastery ?? 0));

  const skills: CohortSkillRow[] = [];
  const allSkillIds = new Set([...analyses.values()].flatMap(a => a.skills.map(s => s.id)));
  for (const id of allSkillIds) {
    const stats = [...analyses.values()].map(a => a.skills.find(s => s.id === id)!).filter(s => s.state !== 'insufficient');
    skills.push({
      id, label: skillLabel(id), students: stats.length,
      meanMastery: stats.length ? Math.round(stats.reduce((s, x) => s + x.mastery, 0) / stats.length) : null,
      weakStudents: stats.filter(s => s.state === 'weak').length,
    });
  }
  skills.sort((a, b) => (a.meanMastery ?? 101) - (b.meanMastery ?? 101));

  const levels = [...counts.keys()].sort((a, b) => a - b).map(level => {
    const at = attempts.filter(a => a.level === level);
    return {
      level,
      started: new Set(at.map(a => a.userId)).size,
      finished: new Set(at.filter(isDone).map(a => a.userId)).size,
    };
  });

  const byQ = new Map<number, LoadedRow[]>();
  for (const r of responses) (byQ.get(r.questionId) ?? byQ.set(r.questionId, []).get(r.questionId)!).push(r);
  const questions: CohortQuestionRow[] = [...byQ].map(([questionId, rows]) => {
    const picks: Record<string, number> = {};
    for (const r of rows) { const k = r.selectedKey ?? '—'; picks[k] = (picks[k] ?? 0) + 1; }
    const n = rows.length;
    const correctRate = rows.filter(r => r.isCorrect).length / n;
    const correctKey = rows[0].correctKey;
    const topWrong = Object.entries(picks).filter(([k]) => k !== correctKey && k !== '—').sort((a, b) => b[1] - a[1])[0];
    let flag: string | null = null;
    if (n >= 6 && correctRate <= 0.25) flag = 'Very low pass rate';
    if (n >= 6 && topWrong && topWrong[1] >= 2 * (picks[correctKey] ?? 0) && topWrong[1] / n >= 0.5) flag = 'One wrong option dominates: check the key';
    return {
      questionId, number: rows[0].number, level: rows[0].level, skillLabel: skillLabel(rows[0].skillId), n, correctRate,
      avgTimeMs: Math.round(rows.reduce((s, r) => s + r.totalTimeMs, 0) / n), correctKey, picks, flag,
    };
  }).sort((a, b) => a.correctRate - b.correctRate);

  return { eligible: eligibleRows.length, started: students.length, active, levels, skills, students, questions };
}

export async function getStudentForAdmin(userId: number): Promise<{ name: string; email: string; levels: RedlineLevelTile[]; analysis: RedlineAnalysis }> {
  const u = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, userId)).get();
  if (!u) throw new ApiException('Student not found', 404, 'USER_NOT_FOUND');
  return { ...u, ...(await getOverview(userId)) };
}
