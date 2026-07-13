import { NextRequest, NextResponse } from 'next/server';
import { validateAuth, ApiException, createErrorResponse } from '@/lib/api-utils';
import { getUserByEmail } from '@/lib/db-access-control';
import { type Range, getOverview, getBehavior, getVocab, getMath, getFunnel, getRetention, getLms } from '@/lib/analytics/queries';

const VALID_SECTIONS = ['overview', 'behavior', 'lms', 'vocab', 'math', 'funnel', 'retention'] as const;
type Section = typeof VALID_SECTIONS[number];

const VALID_RANGES: Range[] = ['7d', '30d', '90d', 'all'];

export async function GET(req: NextRequest) {
  try {
    const auth = await validateAuth();
    const user = await getUserByEmail(auth.email);
    if (!user || !['admin', 'super_admin', 'instructor'].includes(user.role)) {
      throw new ApiException('Unauthorized', 403);
    }

    const { searchParams } = new URL(req.url);
    const sectionParam = (searchParams.get('section') ?? 'overview') as Section;
    const rangeParam   = (searchParams.get('range')   ?? '7d') as Range;

    if (!VALID_SECTIONS.includes(sectionParam)) {
      throw new ApiException(`Invalid section: ${sectionParam}`, 400);
    }
    if (!VALID_RANGES.includes(rangeParam)) {
      throw new ApiException(`Invalid range: ${rangeParam}`, 400);
    }

    const range = rangeParam;

    let data: unknown;
    switch (sectionParam) {
      case 'overview':  data = await getOverview(range);  break;
      case 'behavior':  data = await getBehavior(range);  break;
      case 'lms':       data = await getLms(range);       break;
      case 'vocab':     data = await getVocab(range);     break;
      case 'math':      data = await getMath(range);      break;
      case 'funnel':    data = await getFunnel(range);    break;
      case 'retention': data = await getRetention(range); break;
    }

    return NextResponse.json(data);
  } catch (error) {
    return createErrorResponse(error);
  }
}
