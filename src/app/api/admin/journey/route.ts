/**
 * Staff view of "Exorcise the Past".
 *   GET   → { enabled, rows } (who has a set, who started, time used, score)
 *   PATCH → { enabled: boolean } opens or closes it for students
 */

import { safeApiHandler } from '@/lib/api-utils';
import { requireSprintStaff } from '@/lib/sprint/route-helpers';
import { isJourneyEnabled, listJourneysForAdmin, setJourneyEnabled } from '@/lib/journey/service';

export async function GET() {
  return safeApiHandler(async () => {
    await requireSprintStaff();
    return { enabled: await isJourneyEnabled(), rows: await listJourneysForAdmin() };
  });
}

export async function PATCH(req: Request) {
  return safeApiHandler(async () => {
    await requireSprintStaff();
    const { enabled } = await req.json();
    await setJourneyEnabled(enabled === true);
    return { enabled: enabled === true };
  });
}
