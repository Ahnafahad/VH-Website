/**
 * GET /api/cron/super-broadcasts — every 5 minutes. Sends due scheduled broadcasts.
 * Rows are claimed atomically (UPDATE ... WHERE status='scheduled'), so overlapping runs cannot double-send.
 * Protected by CRON_SECRET (same pattern as lms-reminders).
 */
import { NextRequest, NextResponse } from 'next/server';
import { runDueBroadcasts } from '@/lib/super/comms/send';

export const maxDuration = 300;
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  if (!CRON_SECRET) {
    console.error('[super-broadcasts] CRON_SECRET is not configured');
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }
  if (req.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const results = await runDueBroadcasts();
    return NextResponse.json({ processed: results.length, results });
  } catch (err) {
    console.error('[super-broadcasts]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
