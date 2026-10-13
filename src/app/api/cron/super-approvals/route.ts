/**
 * GET /api/cron/super-approvals — every 5 minutes. Runs super-admin actions whose delay has elapsed.
 * Rows are claimed atomically (UPDATE ... WHERE status='pending'), so overlapping runs cannot double-execute.
 * Protected by CRON_SECRET (same pattern as lms-reminders).
 */
import { NextRequest, NextResponse } from 'next/server';
import { runDueActions } from '@/lib/super/approvals';
import '@/lib/super/data/danger-actions'; // registers executors

export const maxDuration = 300;
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  if (!CRON_SECRET) {
    console.error('[super-approvals] CRON_SECRET is not configured');
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }
  if (req.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    return NextResponse.json(await runDueActions());
  } catch (err) {
    console.error('[super-approvals]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
