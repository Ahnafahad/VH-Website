/**
 * GET /api/cron/lms-generate-sessions
 * POST /api/cron/lms-generate-sessions
 *
 * Daily cron to materialise class_sessions from active schedules 14 days ahead.
 * Protected by CRON_SECRET (same pattern as /api/cron/check-streaks).
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateSessionsFromSchedules } from '@/lib/lms/schedule-generator';

const CRON_SECRET = process.env.CRON_SECRET;

async function handler(req: NextRequest): Promise<NextResponse> {
  if (!CRON_SECRET) {
    console.error('[lms-generate-sessions] CRON_SECRET is not configured');
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const created = await generateSessionsFromSchedules();
    console.log(`[lms-generate-sessions] Created ${created} session(s)`);
    return NextResponse.json({ created });
  } catch (err) {
    console.error('[lms-generate-sessions]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export const GET = handler;
export const POST = handler;
