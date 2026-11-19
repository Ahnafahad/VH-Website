/**
 * IBA "Exorcise the Past" — the caller's own curated set.
 *   GET   → { enabled, payload|null }
 *   POST  → build the set (once; needs the admin switch on, staff may always build)
 *   PATCH → save picks, active time and status (running | paused | done)
 */

import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireUser } from '@/lib/tests/route-helpers';
import { isStaffRole } from '@/lib/auth/roles';
import {
  canUseJourney, createJourney, getJourneyPayload, isJourneyEnabled, saveJourney,
} from '@/lib/journey/service';

async function requireJourneyUser() {
  const user = await requireUser();
  if (!canUseJourney(user)) throw new ApiException('Exorcise the Past is for IBA students', 403, 'FORBIDDEN');
  return user;
}

export async function GET() {
  return safeApiHandler(async () => {
    const user = await requireJourneyUser();
    return { enabled: await isJourneyEnabled(), payload: await getJourneyPayload(user.id) };
  });
}

export async function POST() {
  return safeApiHandler(async () => {
    const user = await requireJourneyUser();
    if (!(await isJourneyEnabled()) && !isStaffRole(user.role)) {
      throw new ApiException('Not open yet', 403, 'JOURNEY_LOCKED');
    }
    await createJourney(user.id);
    return { enabled: true, payload: await getJourneyPayload(user.id) };
  });
}

export async function PATCH(req: Request) {
  return safeApiHandler(async () => {
    const user = await requireJourneyUser();
    await saveJourney(user.id, await req.json());
    return { ok: true };
  });
}
