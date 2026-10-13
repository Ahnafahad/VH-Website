import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getUserByEmail } from '@/lib/db-access-control';
import { getFlag } from '@/lib/super/flags';

export const dynamic = 'force-dynamic';

/** Public: is the signed-in viewer currently locked out by maintenance mode? Only students ever are. */
export async function GET() {
  try {
    if (!(await getFlag('maintenance', false))) return NextResponse.json({ blocked: false });
    const session = await getServerSession(authOptions);
    const user = session?.user?.email ? await getUserByEmail(session.user.email) : null;
    return NextResponse.json({ blocked: user?.role === 'student' });
  } catch {
    return NextResponse.json({ blocked: false });
  }
}
