/**
 * POST /api/mock-registration/screenshot  { fileName, contentType } → { key, uploadUrl } (presigned R2 PUT).
 * Images only. The key is then sent to /payment; the file is deleted when staff approve.
 */

import { NextRequest } from 'next/server';
import { safeApiHandler, validateAuth, ApiException } from '@/lib/api-utils';
import { r2PresignPut } from '@/lib/storage/r2';
import { screenshotKeyFor, userIdByEmail } from '@/lib/mocks/registration';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function POST(req: NextRequest) {
  return safeApiHandler(async () => {
    const { email } = await validateAuth();
    const { fileName, contentType } = (await req.json()) as { fileName?: string; contentType?: string };
    if (!fileName || typeof fileName !== 'string') throw new ApiException('fileName is required', 400);
    if (!contentType || !IMAGE_TYPES.has(contentType)) throw new ApiException('Upload a JPG, PNG or WebP image', 400);

    const key = screenshotKeyFor(await userIdByEmail(email), fileName);
    return { key, uploadUrl: await r2PresignPut(key, contentType, 900) };
  });
}
