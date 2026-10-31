/**
 * GET  /api/mock-registration → the signed-in user's registration + the payment details to show.
 * POST /api/mock-registration  { phone } → step 1 (creates the registration, or updates the phone).
 */

import { NextRequest } from 'next/server';
import { safeApiHandler, validateAuth } from '@/lib/api-utils';
import { getMyRegistration, savePhone } from '@/lib/mocks/registration';

export async function GET() {
  return safeApiHandler(async () => {
    const { email } = await validateAuth();
    return getMyRegistration(email);
  });
}

export async function POST(req: NextRequest) {
  return safeApiHandler(async () => {
    const { email } = await validateAuth();
    const { phone } = (await req.json()) as { phone?: string };
    await savePhone(email, typeof phone === 'string' ? phone : '');
    return getMyRegistration(email);
  });
}
