/**
 * POST /api/essays/[seriesId]/upload — presigned R2 PUT URL for one page photo.
 * Body: { essayIndex: number; contentType: 'image/jpeg' }
 * Keys are namespaced essays/{seriesId}/{userId}/ so submit can verify ownership.
 */

import { NextRequest } from 'next/server';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { parseId, requireUser } from '@/lib/essays/route-helpers';
import { assertCanUpload, uploadKeyPrefix } from '@/lib/essays/service';
import { r2PresignPut } from '@/lib/storage/r2';

export async function POST(req: NextRequest, { params }: { params: Promise<{ seriesId: string }> }) {
  return safeApiHandler(async () => {
    const user = await requireUser();
    const seriesId = parseId((await params).seriesId);
    const body = (await req.json()) as { essayIndex?: number; contentType?: string };
    if (body.contentType !== 'image/jpeg') throw new ApiException('Pages are uploaded as JPEG images', 400);
    await assertCanUpload(user, seriesId, Number(body.essayIndex));
    const key = `${uploadKeyPrefix(seriesId, user.id)}${body.essayIndex}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const uploadUrl = await r2PresignPut(key, 'image/jpeg', 1800);
    return { key, uploadUrl };
  });
}
