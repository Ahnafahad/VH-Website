/**
 * GET /api/reading-speed-test/start
 * Returns one randomly-picked passage, sanitized (no correct answers). Any
 * logged-in user may call this — access to this feature has no product/role gate.
 */

import { safeApiHandler } from '@/lib/api-utils';
import { requireUser } from '@/lib/reading-speed-test/route-helpers';
import { pickRandomPassage, sanitizePassage, createStartToken } from '@/lib/reading-speed-test/service';

export async function GET() {
  return safeApiHandler(async () => {
    const user = await requireUser();
    const passage = pickRandomPassage();
    return { passage: sanitizePassage(passage), token: createStartToken(user.id, passage.id) };
  });
}
