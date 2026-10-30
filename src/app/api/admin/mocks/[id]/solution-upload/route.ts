/**
 * POST /api/admin/mocks/[id]/solution-upload
 * Body: { fileName, contentType: 'application/pdf' } → { key, uploadUrl } (presigned R2 PUT).
 * The client uploads, then PATCHes /api/admin/mocks/[id] with { solutionPdfKey: key }. Students only
 * ever get the file through the official result payload.
 */

import { NextRequest } from 'next/server';
import { safeApiHandler, ApiException } from '@/lib/api-utils';
import { requireStaff } from '@/lib/tests/route-helpers';
import { r2PresignPut } from '@/lib/storage/r2';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return safeApiHandler(async () => {
    await requireStaff();
    const id = parseInt((await params).id, 10);
    const { fileName, contentType } = (await req.json()) as { fileName?: string; contentType?: string };
    if (!fileName || typeof fileName !== 'string') throw new ApiException('fileName is required', 400);
    if (contentType !== 'application/pdf') throw new ApiException('Only a PDF can be uploaded', 400);

    const key = `mocks/${id}/${Date.now()}-${fileName.replace(/[^\w.\-]/g, '_').slice(0, 200)}`;
    return { key, uploadUrl: await r2PresignPut(key, contentType, 3600) };
  });
}
