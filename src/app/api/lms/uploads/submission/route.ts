/**
 * POST /api/lms/uploads/submission
 * Returns a presigned R2 PUT URL for a homework submission file.
 * Allows authenticated LMS users (or staff) to upload PDFs / images up to 20 MB.
 *
 * Body: { fileName: string; contentType: string }
 * Response: { key: string; uploadUrl: string }
 */

import { NextRequest } from 'next/server';
import { safeApiHandler, ApiException, validateAuth } from '@/lib/api-utils';
import { getUserByEmail } from '@/lib/db-access-control';
import { r2PresignPut } from '@/lib/storage/r2';

const ALLOWED_CONTENT_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

function isStaffRole(role: string) {
  return role === 'admin' || role === 'super_admin' || role === 'instructor';
}

export async function POST(req: NextRequest) {
  return safeApiHandler(async () => {
    const { email } = await validateAuth();
    const user = await getUserByEmail(email);
    if (!user) throw new ApiException('User not found', 404, 'USER_NOT_FOUND');

    const isStaff = isStaffRole(user.role);
    const hasLmsProduct =
      user.products.includes('iba') ||
      user.products.includes('fbs') ||
      user.products.includes('fbs_detailed');

    if (!isStaff && !hasLmsProduct) {
      throw new ApiException('LMS access required', 403, 'FORBIDDEN');
    }

    const body = (await req.json()) as { fileName?: string; contentType?: string };
    const { fileName, contentType } = body;

    if (!fileName || typeof fileName !== 'string') {
      throw new ApiException('fileName is required', 400);
    }
    if (!contentType || !ALLOWED_CONTENT_TYPES.has(contentType)) {
      throw new ApiException(
        'contentType must be one of: application/pdf, image/jpeg, image/png, image/webp',
        400,
      );
    }

    const sanitized = fileName.replace(/[^\w.\-]/g, '_').slice(0, 200);
    const key = `submissions/${user.id}/${Date.now()}-${sanitized}`;

    const uploadUrl = await r2PresignPut(key, contentType, 3600);

    return { key, uploadUrl };
  });
}
