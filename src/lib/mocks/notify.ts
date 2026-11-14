/**
 * When staff publish a mock's results, everyone who sat it gets one results email (rank, scores, per-section marks,
 * missed chances, top 10). Externals (users with no batch) are sent first, then the batch's own students, each group
 * behind its own done-flag in lms_settings so a failure or a re-publish never re-sends a group that already went out.
 * Mock 4 only: the top 5 externals (combined MCQ + essay) are granted Mock Access and told about Mock 5 onwards.
 */

import { eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tests, users, userAccess, type Test } from '@/lib/db/schema';
import { getLmsSetting, setLmsSetting } from '@/lib/lms/settings';
import { getUserById } from '@/lib/db-access-control';
import { sendHtmlEmailBatch, sendHtmlEmailScheduled } from '@/lib/email';
import { getMockRanking, getMockResult } from './service';
import { MOCK_TRIAL } from './trial';
import { MOCK_SCHEDULE, formatSlotTime, slotDay } from './registration-pure';
import { mockResultsEmail, type ResultsEmailInput } from './results-email';
import type { MockEmail } from './registration-emails';

const SITE = 'https://www.vh-beyondthehorizons.org';
/** Reward for the Mock 4 open trial: the top `topN` external students get Mock Access, from mock `fromMock` onwards. */
export const MOCK_REWARD = { testId: MOCK_TRIAL.testId, topN: 5, fromMock: 5 };

export type MailGroup = 'external' | 'internal';
export interface BuiltMail { userId: number; name: string; to: string; group: MailGroup; reward: boolean; mail: MockEmail }

const mockNumberOf = (test: Pick<Test, 'examCode' | 'slug'>): number | null => {
  const m = /^bth-mock-(\d+)$/.exec(test.slug);
  return m ? Number(m[1]) : null;
};

function rewardSchedule() {
  return MOCK_SCHEDULE.filter(s => s.n >= MOCK_REWARD.fromMock).map(s => {
    const d = slotDay(s.date);
    return { n: s.n, day: d.weekday, date: `${d.day} ${d.month}`, time: formatSlotTime(s.time) };
  });
}

/** Builds every student's email without sending (needs the results to be published). Skipped = could not be built. */
export async function buildMockResultEmails(test: Test): Promise<{ mails: BuiltMail[]; skipped: { userId: number; name: string; why: string }[] }> {
  const ranking = await getMockRanking(test);
  const ids = [...ranking.byUser.keys()];
  const people = ids.length ? await db.select({ id: users.id, name: users.name, email: users.email, batch: users.batch }).from(users).where(inArray(users.id, ids)) : [];
  const totals = [...ranking.byUser.values()].map(r => r.total);
  const avgCombined = totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : null;

  // Externals: no batch. Ranked among themselves by combined score (ties share a place).
  const externals = people.filter(p => !p.batch).sort((a, b) => ranking.byUser.get(b.id)!.total - ranking.byUser.get(a.id)!.total);
  const extRank = new Map<number, number>();
  externals.forEach((p, idx) => {
    const prev = externals[idx - 1];
    extRank.set(p.id, prev && ranking.byUser.get(prev.id)!.total === ranking.byUser.get(p.id)!.total ? extRank.get(prev.id)! : idx + 1);
  });
  const rewardOn = test.id === MOCK_REWARD.testId;

  const mails: BuiltMail[] = [];
  const skipped: { userId: number; name: string; why: string }[] = [];
  const ordered = [...externals, ...people.filter(p => p.batch)];
  for (const p of ordered) {
    const user = await getUserById(p.id);
    const result = user ? await getMockResult(user, test.slug) : null;
    if (!result || result.phase !== 'official' || !result.me || !result.mcq || result.combined == null) { skipped.push({ userId: p.id, name: p.name, why: 'no official result' }); continue; }
    if (!p.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.email)) { skipped.push({ userId: p.id, name: p.name, why: `bad email ${p.email}` }); continue; }

    const group: MailGroup = p.batch ? 'internal' : 'external';
    const reward = rewardOn && group === 'external' && (extRank.get(p.id) ?? 99) <= MOCK_REWARD.topN;
    const penaltyOf = (title: string) => result.missed?.find(m => m.title === title)?.penaltyLost ?? 0;
    const input: ResultsEmailInput = {
      name: p.name, mockTitle: test.title, mockNumber: mockNumberOf(test),
      rank: result.me.rank, outOf: result.me.outOf, percentile: result.me.percentile,
      combined: result.combined, combinedMax: result.maxTotal ?? ranking.maxTotal,
      mcq: result.mcq.score, mcqMax: result.mcq.maxScore, essay: result.essayTotal ?? 0, essayMax: result.essayMax ?? 0,
      avgCombined,
      externalRank: group === 'external' ? { rank: extRank.get(p.id)!, outOf: externals.length } : null,
      sections: result.mcq.sections.map(s => ({ title: s.title, score: s.score, max: s.maxScore, correct: s.correct, wrong: s.wrong, skipped: s.unattempted, penalty: penaltyOf(s.title) })),
      missed: (result.missed ?? []).flatMap(s => s.chances.map(c => ({ number: c.number, section: s.title, pct: c.cohortCorrectPct, mine: c.mine, yourAnswer: c.yourAnswer, correctAnswer: c.correctAnswer })))
        .sort((a, b) => b.pct - a.pct || a.number - b.number).slice(0, 3),
      board: (result.leaderboard ?? []).map(r => ({ rank: r.rank, name: r.name, mcq: r.mcq, essay: r.essay, total: r.total, me: r.name === p.name && r.total === result.combined })),
      reward: reward ? { fromMock: MOCK_REWARD.fromMock, schedule: rewardSchedule() } : null,
      resultsUrl: `${SITE}/mocks/${test.slug}/results`, mockUrl: `${SITE}/mocks`,
    };
    mails.push({ userId: p.id, name: p.name, to: p.email, group, reward, mail: mockResultsEmail(input) });
  }
  return { mails, skipped };
}

/** Gap between the external group's send time and the batch's, so the externals always go first. */
const GROUP_GAP_MS = 10 * 60_000;

/** `opts.at`: schedule instead of sending now (externals at `at`, the batch `GROUP_GAP_MS` later). */
export async function notifyMockPublished(testId: number, opts: { at?: Date } = {}): Promise<{ sent: number; failed: number; skipped?: boolean; groups?: Record<string, string>; ids?: string[] }> {
  if (await getLmsSetting(`mock_rank_emailed:${testId}`)) return { sent: 0, failed: 0, skipped: true }; // legacy one-shot flag

  const test = await db.select().from(tests).where(eq(tests.id, testId)).get();
  if (!test?.isMock || test.resultsPublishedAt == null) return { sent: 0, failed: 0, skipped: true };

  const { mails, skipped } = await buildMockResultEmails(test);
  if (skipped.length) console.warn('[mocks] results email skipped', skipped);

  // The email says the reward is already switched on, so grant it before anything is sent. A revoked row stays revoked.
  for (const m of mails.filter(x => x.reward)) {
    await db.insert(userAccess).values({ userId: m.userId, product: 'mock', active: true }).onConflictDoNothing();
  }

  let sent = 0, failed = 0;
  const groups: Record<string, string> = {};
  const ids: string[] = [];
  for (const group of ['external', 'internal'] as const) {
    const flag = `mock_rank_emailed:${testId}:${group}`;
    if (await getLmsSetting(flag)) { groups[group] = 'already sent'; continue; }
    const items = mails.filter(m => m.group === group);
    if (items.length === 0) { groups[group] = 'nobody'; continue; }
    const payload = items.map(m => ({ to: m.to, mail: m.mail }));
    let r: { sent: number; failed: number }, label: string;
    if (opts.at) {
      const when = new Date(opts.at.getTime() + (group === 'internal' ? GROUP_GAP_MS : 0));
      const s = await sendHtmlEmailScheduled(payload, when);
      ids.push(...s.ids);
      r = { sent: s.scheduled, failed: s.failed };
      label = `scheduled ${s.scheduled} for ${when.toISOString()}${s.error ? ` (${s.error})` : ''}`;
    } else {
      r = await sendHtmlEmailBatch(payload);
      label = `sent ${r.sent}`;
    }
    sent += r.sent; failed += r.failed;
    if (r.failed > 0) { groups[group] = `FAILED (${r.failed}): ${label}`; break; } // never send the next group after a failure
    await setLmsSetting(flag, new Date().toISOString());
    groups[group] = label;
  }
  return { sent, failed, groups, ids };
}
