import { NextRequest } from 'next/server';
import { safeApiHandler } from '@/lib/api-utils';
import { requireStation, storeImage } from '@/lib/mocks/omr-station';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return safeApiHandler(async () => {
    requireStation(req);
    return storeImage(
      Number((await params).id), req.nextUrl.searchParams.get('userId'),
      await req.arrayBuffer(), req.headers.get('content-type'),
    );
  });
}
