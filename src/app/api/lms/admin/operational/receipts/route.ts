/**
 * Expense receipts in R2 (admin and super_admin only).
 *   POST { fileName, contentType } -> { key, uploadUrl }   presigned PUT; the client then PUTs the file
 *   GET  ?key=expense-receipts/... -> { url }              short-lived presigned GET to view it
 */
import { NextRequest } from 'next/server';
import { ApiException, safeApiHandler } from '@/lib/api-utils';
import { requireOperationalAdmin } from '@/lib/lms/operations-auth';
import { RECEIPT_PREFIX } from '@/lib/lms/operations';
import { r2PresignGet, r2PresignPut } from '@/lib/storage/r2';

const RECEIPT_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

export async function POST(req: NextRequest) {
  return safeApiHandler(async () => {
    await requireOperationalAdmin();
    const body = await req.json().catch(() => { throw new ApiException('Invalid JSON', 400); }) as
      { fileName?: unknown; contentType?: unknown };
    if (typeof body.fileName !== 'string' || !body.fileName) throw new ApiException('fileName is required', 400);
    if (typeof body.contentType !== 'string' || !RECEIPT_TYPES.includes(body.contentType)) {
      throw new ApiException('Receipts must be a PDF, JPG, PNG or WebP file', 400);
    }
    const key = `${RECEIPT_PREFIX}${Date.now()}-${body.fileName.replace(/[^\w.\-]/g, '_').slice(0, 120)}`;
    return { key, uploadUrl: await r2PresignPut(key, body.contentType, 900) };
  });
}

export async function GET(req: NextRequest) {
  return safeApiHandler(async () => {
    await requireOperationalAdmin();
    const key = req.nextUrl.searchParams.get('key') ?? '';
    if (!key.startsWith(RECEIPT_PREFIX) || key.includes('..')) throw new ApiException('Invalid receipt key', 400);
    return { url: await r2PresignGet(key, 300) };
  });
}
