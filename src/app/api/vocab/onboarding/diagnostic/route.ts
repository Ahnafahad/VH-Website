/**
 * GET /api/vocab/onboarding/diagnostic
 *
 * Public — onboarding runs before sign-in, by design. Returns the whole
 * adaptive pool at once (the diagnostic is 20 seconds long; it cannot spend
 * any of them waiting on a network round trip).
 */

import { NextRequest } from 'next/server';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { rateLimit } from '@/lib/rate-limit';
import { getDiagnosticPool } from '@/lib/vocab/onboarding/diagnostic';

export async function GET(req: NextRequest) {
  return safeApiHandler(async () => {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    if (!rateLimit(`${ip}:onboarding_diagnostic`, 60, 60 * 60_000)) {
      throw new ApiException('Too many requests', 429);
    }
    return { pool: await getDiagnosticPool() };
  }, 'onboarding_diagnostic');
}
