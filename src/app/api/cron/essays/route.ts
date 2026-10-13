/**
 * GET|POST /api/cron/essays — daily (vercel.json).
 *   1. Auto-publishes any series whose deadline passed with nothing left to mark
 *      (marking actions also publish immediately; this catches deadlines that
 *      pass after the last script was already marked).
 *   2. Reminds students who haven't submitted, once per series, when its
 *      deadline is less than 24 hours away.
 *
 * Protected by CRON_SECRET (same as the other cron routes).
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendDeadlineReminders, sweepAutoPublish } from '@/lib/essays/service';
import { withCronLog } from '@/lib/super/ops/cron-log';

async function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const published = await sweepAutoPublish();
  const reminders = await sendDeadlineReminders();
  return NextResponse.json({ published, reminders });
}

export const GET = withCronLog('essays', run);
export const POST = withCronLog('essays', run);
