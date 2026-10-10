/**
 * GET  /api/admin/essays/comment-bank — the caller's saved comments + the shared bank.
 * POST /api/admin/essays/comment-bank — { text, shared? } (shared = admins only).
 */

import { NextRequest } from 'next/server';
import { safeApiHandler } from '@/lib/api-utils';
import { requireEssayStaff } from '@/lib/essays/route-helpers';
import { addComment, listCommentBank } from '@/lib/essays/service';

export async function GET() {
  return safeApiHandler(async () => {
    const user = await requireEssayStaff();
    return { comments: await listCommentBank(user) };
  });
}

export async function POST(req: NextRequest) {
  return safeApiHandler(async () => {
    const user = await requireEssayStaff();
    const body = (await req.json()) as { text?: unknown; shared?: unknown };
    return { comment: await addComment(user, body.text, body.shared === true) };
  });
}
