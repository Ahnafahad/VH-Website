/**
 * POST /api/mock-registration/payment  { trxId?, screenshotKey? } → step 2; moves the registration to
 * "submitted" (awaiting verification) and emails the student.
 */

import { NextRequest } from 'next/server';
import { safeApiHandler, validateAuth } from '@/lib/api-utils';
import { getMyRegistration, submitPayment } from '@/lib/mocks/registration';

export async function POST(req: NextRequest) {
  return safeApiHandler(async () => {
    const { email } = await validateAuth();
    const body = (await req.json()) as { trxId?: unknown; screenshotKey?: unknown };
    await submitPayment(email, {
      trxId: typeof body.trxId === 'string' ? body.trxId : undefined,
      screenshotKey: typeof body.screenshotKey === 'string' ? body.screenshotKey : undefined,
    });
    return getMyRegistration(email);
  });
}
