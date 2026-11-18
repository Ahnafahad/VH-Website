/** POST /api/vocab/plan/screenshot  { fileName, contentType } → { key, uploadUrl } (presigned R2 PUT, images only). */

import { NextRequest } from 'next/server';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { r2PresignPut } from '@/lib/storage/r2';
import { requireUser } from '@/lib/tests/route-helpers';
import { screenshotKeyFor } from '@/lib/vocab/plan-claims';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function POST(req: NextRequest) {
  return safeApiHandler(async () => {
    const user = await requireUser();
    const { fileName, contentType } = (await req.json()) as { fileName?: string; contentType?: string };
    if (!fileName || typeof fileName !== 'string') throw new ApiException('fileName is required', 400);
    if (!contentType || !IMAGE_TYPES.has(contentType)) throw new ApiException('Upload a JPG, PNG or WebP image', 400);
    const key = screenshotKeyFor(user.id, fileName);
    return { key, uploadUrl: await r2PresignPut(key, contentType, 900) };
  });
}
