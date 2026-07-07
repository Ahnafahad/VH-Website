/**
 * GET  /api/lms/admin/settings — return current LMS settings
 * POST /api/lms/admin/settings — update LMS settings
 *
 * Currently exposes: meetAutoCreate (bool)
 */

import { NextRequest } from 'next/server';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';
import { isMeetAutoCreateEnabled, setMeetAutoCreate } from '@/lib/lms/settings';

export async function GET(_req: NextRequest) {
  return safeApiHandler(async () => {
    await requireStaff();
    const meetAutoCreate = await isMeetAutoCreateEnabled();
    return { meetAutoCreate };
  });
}

export async function POST(req: NextRequest) {
  return safeApiHandler(async () => {
    await requireStaff();
    const body = await req.json() as { meetAutoCreate?: unknown };

    if (body.meetAutoCreate === undefined) {
      throw new ApiException('meetAutoCreate is required', 400);
    }
    if (typeof body.meetAutoCreate !== 'boolean') {
      throw new ApiException('meetAutoCreate must be a boolean', 400);
    }

    await setMeetAutoCreate(body.meetAutoCreate);
    return { meetAutoCreate: body.meetAutoCreate };
  });
}
