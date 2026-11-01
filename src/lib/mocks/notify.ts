/**
 * When staff publish a mock's results, everyone who sat it gets one email with their final rank.
 * Idempotent per mock (a flag in lms_settings), so unpublishing and republishing never re-sends.
 */

import { eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tests, users } from '@/lib/db/schema';
import { getLmsSetting, setLmsSetting } from '@/lib/lms/settings';
import { sendHtmlEmailBatch } from '@/lib/email';
import { getMockRanking } from './service';
import { rankPublishedEmail } from './registration-emails';

const SITE = 'https://www.vh-beyondthehorizons.org';

export async function notifyMockPublished(testId: number): Promise<{ sent: number; failed: number; skipped?: boolean }> {
  const flag = `mock_rank_emailed:${testId}`;
  if (await getLmsSetting(flag)) return { sent: 0, failed: 0, skipped: true };

  const test = await db.select().from(tests).where(eq(tests.id, testId)).get();
  if (!test?.isMock || test.resultsPublishedAt == null) return { sent: 0, failed: 0, skipped: true };

  const ranking = await getMockRanking(test);
  const ids = [...ranking.byUser.keys()];
  if (ids.length === 0) return { sent: 0, failed: 0 };
  const people = await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(inArray(users.id, ids));

  const result = await sendHtmlEmailBatch(people.map(p => {
    const r = ranking.byUser.get(p.id)!;
    return {
      to: p.email,
      mail: rankPublishedEmail({
        name: p.name, mockTitle: test.title, rank: r.rank, outOf: ranking.outOf,
        mcq: r.mcq, essay: r.essay, total: r.total, maxTotal: ranking.maxTotal,
        resultsUrl: `${SITE}/mocks/${test.slug}/results`,
      }),
    };
  }));
  if (result.failed === 0) await setLmsSetting(flag, new Date().toISOString());
  return result;
}
