import { NextResponse } from 'next/server';
import { createErrorResponse } from '@/lib/api-utils';
import { requireSuperAdmin } from '@/lib/super/guard';
import { fetchResendEvents, warmupStatus } from '@/lib/super/comms/deliverability';
import { listBroadcasts } from '@/lib/super/comms/send';

export async function GET() {
  try {
    await requireSuperAdmin();
    const [resend, all] = await Promise.all([fetchResendEvents(), listBroadcasts(30)]);
    const recentBlasts = all.filter(b => b.channels.includes('email')).slice(0, 10)
      .map(b => ({ id: b.id, title: b.title, status: b.status, sentAt: b.sentAt, email: b.result?.email ?? null }));
    return NextResponse.json({ warmup: warmupStatus(), resend, recentBlasts });
  } catch (error) {
    return createErrorResponse(error);
  }
}
