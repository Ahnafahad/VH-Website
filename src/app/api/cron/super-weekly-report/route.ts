/**
 * GET /api/cron/super-weekly-report — Sundays 03:00 UTC. Emails the weekly report to the root super admin only.
 * Protected by CRON_SECRET (same pattern as lms-reminders).
 */
import { NextRequest, NextResponse } from 'next/server';
import { sendWeeklyReport } from '@/lib/super/comms/report-data';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  if (!CRON_SECRET) {
    console.error('[super-weekly-report] CRON_SECRET is not configured');
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }
  if (req.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await sendWeeklyReport();
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (err) {
    console.error('[super-weekly-report]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
