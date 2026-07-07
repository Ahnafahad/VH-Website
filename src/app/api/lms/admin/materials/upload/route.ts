/**
 * POST /api/lms/admin/materials/upload
 * Returns a presigned R2 PUT URL for a PDF file upload.
 * The client uploads directly to R2, then POSTs the key to /api/lms/admin/materials.
 *
 * Body: { fileName: string; contentType: string }
 * Response: { key: string; uploadUrl: string }
 */

import { NextRequest } from 'next/server';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';
import { r2PresignPut } from '@/lib/storage/r2';

export async function POST(req: NextRequest) {
  return safeApiHandler(async () => {
    await requireStaff();

    const body = (await req.json()) as { fileName?: string; contentType?: string };
    const { fileName, contentType } = body;

    if (!fileName || typeof fileName !== 'string') {
      throw new ApiException('fileName is required', 400);
    }
    if (contentType !== 'application/pdf') {
      throw new ApiException('Only PDF files are allowed for materials', 400);
    }

    // Sanitise filename: keep extension, strip path separators and unusual chars
    const sanitized = fileName.replace(/[^\w.\-]/g, '_').slice(0, 200);
    const key = `materials/${Date.now()}-${sanitized}`;

    const uploadUrl = await r2PresignPut(key, contentType, 3600);

    return { key, uploadUrl };
  });
}
