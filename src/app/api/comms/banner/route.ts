import { NextResponse } from 'next/server';
import { getActiveBanner } from '@/lib/super/comms/banner';

/** Public, read-only: the active in-app banner (text/level/expiry only). Cached briefly at the edge. */
export async function GET() {
  const banner = await getActiveBanner().catch(() => null);
  return NextResponse.json({ banner }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } });
}
