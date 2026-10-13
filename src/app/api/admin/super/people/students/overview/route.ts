import { NextRequest } from 'next/server';
import { handle, intParam } from '@/lib/super/people/route';
import { getStudentOverview } from '@/lib/super/people/overrides';
import { getStudentPoints } from '@/lib/super/people/points';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return handle(async () => {
    const userId = intParam(req.url, 'userId');
    const [overview, points] = await Promise.all([getStudentOverview(userId), getStudentPoints(userId)]);
    return { ...overview, points };
  });
}
