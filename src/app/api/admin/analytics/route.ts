import { NextRequest, NextResponse } from 'next/server';
import { validateAuth, ApiException, createErrorResponse } from '@/lib/api-utils';
import { getUserByEmail } from '@/lib/db-access-control';
import { type Range, getOverview, getBehavior, getVocab, getMath, getFunnel, getRetention, getLms, getLexicore, getGames, getLastWordDeepDive } from '@/lib/analytics/queries';
import { isStaffRole } from '@/lib/auth/roles';
import { sanitisePeriod } from '@/lib/analytics/games';

const VALID_SECTIONS = ['overview', 'behavior', 'lms', 'vocab', 'lexicore', 'math', 'funnel', 'retention', 'games'] as const;
type Section = typeof VALID_SECTIONS[number];

const VALID_RANGES: Range[] = ['7d', '30d', '90d', 'all'];

export async function GET(req: NextRequest) {
  try {
    const auth = await validateAuth();
    const user = await getUserByEmail(auth.email);
    if (!user || !isStaffRole(user.role)) {
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
      case 'lexicore':  data = await getLexicore(range);  break;
      case 'math':      data = await getMath(range);      break;
      case 'funnel':    data = await getFunnel(range);    break;
      case 'retention': data = await getRetention(range); break;
      case 'games': {
        // Games has its own 7/30/90-day period (?days=), not the dashboard range.
        const period = sanitisePeriod(searchParams.get('days'));
        const [games, lastWord] = await Promise.all([getGames(period), getLastWordDeepDive(period)]);
        data = { period, games: games.games, lastWord };
        break;
      }
    }

    return NextResponse.json(data);
  } catch (error) {
    return createErrorResponse(error);
  }
}
