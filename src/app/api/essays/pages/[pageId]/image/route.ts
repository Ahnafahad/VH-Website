/**
 * GET /api/essays/pages/[pageId]/image — streams a page photo from private R2
 * storage. Only the student who wrote it, or staff, can fetch it.
 */

import { NextResponse } from 'next/server';
import { createErrorResponse } from '@/lib/api-utils';
import { isEssayStaff } from '@/lib/essays/access';
import { parseId, requireUser } from '@/lib/essays/route-helpers';
import { getPageForViewer } from '@/lib/essays/service';
import { r2GetBytes } from '@/lib/storage/r2';

export async function GET(_req: Request, { params }: { params: Promise<{ pageId: string }> }) {
  try {
    const user = await requireUser();
    const page = await getPageForViewer(user, parseId((await params).pageId), isEssayStaff(user));
    const { body, contentType } = await r2GetBytes(page.r2Key);
    return new NextResponse(Buffer.from(body), {
      headers: {
        'Content-Type': contentType,
        // Keys are immutable (a resubmission writes new keys), so the browser may cache privately.
        'Cache-Control': 'private, max-age=86400, immutable',
      },
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}
