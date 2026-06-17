/**
 * GET /api/vocab/cron/decay
 *
 * Runs daily (configured in vercel.json). Applies one day of mastery decay
 * (-2%) to every word record that is past the 7-day grace period since the
 * user last interacted with it. Mastery level is recomputed from the decayed
 * score in the same statement.
 *
 * The cron applies exactly one decay step per run — running it daily yields
 * the documented -2%/day curve (see applyDecay in lib/vocab/mastery-score.ts,
 * which is the reference implementation used by tests).
 *
 * Protected by CRON_SECRET header.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { vocabUserWordRecords } from '@/lib/db/schema';

const CRON_SECRET = process.env.CRON_SECRET;

const GRACE_SECONDS = 7 * 86_400;
const DECAY_FACTOR  = 0.98;

export async function GET(req: NextRequest) {
  if (!CRON_SECRET) {
    console.error('[vocab-decay] CRON_SECRET is not configured');
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await db
      .update(vocabUserWordRecords)
      .set({
        masteryScore: sql`mastery_score * ${DECAY_FACTOR}`,
        // Same thresholds as masteryLevel() in lib/vocab/mastery-score.ts
        masteryLevel: sql`CASE
          WHEN mastery_score * ${DECAY_FACTOR} <= 20  THEN 'new'
          WHEN mastery_score * ${DECAY_FACTOR} <= 60  THEN 'learning'
          WHEN mastery_score * ${DECAY_FACTOR} <= 120 THEN 'familiar'
          WHEN mastery_score * ${DECAY_FACTOR} <= 200 THEN 'strong'
          ELSE 'mastered'
        END`,
        updatedAt: new Date(),
      })
      .where(sql`mastery_score > 0
        AND last_interaction_at IS NOT NULL
        AND last_interaction_at < unixepoch() - ${GRACE_SECONDS}`);

    const decayed = result.rowsAffected ?? 0;
    console.log(`[vocab-decay] Decayed ${decayed} word records`);
    return NextResponse.json({ decayed });
  } catch (err) {
    console.error('[vocab-decay]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
