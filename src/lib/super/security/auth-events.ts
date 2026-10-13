import { db, authEvents } from '@/lib/db';

export type AuthEventType = 'signin' | 'signin_denied' | 'signout' | 'force_signout' | 'impersonate_start' | 'impersonate_end';

/** Best-effort write to auth_events; never throws, so it can never block a login. */
export async function logAuthEvent(type: AuthEventType, who: { userId?: number | null; email?: string | null }): Promise<void> {
  try {
    let ip: string | null = null;
    let userAgent: string | null = null;
    try {
      const { headers } = await import('next/headers');
      const h = await headers();
      ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip');
      userAgent = h.get('user-agent')?.slice(0, 300) ?? null;
    } catch { /* no request context (e.g. scripts/tests) */ }
    await db.insert(authEvents).values({
      type,
      userId: who.userId ?? null,
      email: who.email?.toLowerCase() ?? null,
      ip,
      userAgent,
    });
  } catch (e) {
    console.error('auth_events write failed:', e);
  }
}
