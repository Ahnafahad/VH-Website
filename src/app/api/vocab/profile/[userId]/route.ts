import { NextRequest } from 'next/server';
import { safeApiHandler, validateAuth, ApiException } from '@/lib/api-utils';
import { getPublicProfile } from '@/lib/vocab/public-profile';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  return safeApiHandler(async () => {
    await validateAuth();                 // any authenticated LexiCore user may view
    const { userId } = await params;      // Next 15: params is a Promise
    const id = Number(userId);
    if (!Number.isInteger(id) || id <= 0) throw new ApiException('Invalid user id', 400);
    const profile = await getPublicProfile(id);
    if (!profile) throw new ApiException('Profile not found', 404);
    return profile;                        // safeApiHandler returns NextResponse.json(result) — body IS the profile, no wrapper
  }, '/api/vocab/profile/[userId]');
}
