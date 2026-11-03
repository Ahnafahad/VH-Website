import { NextRequest } from 'next/server';
import { safeApiHandler } from '@/lib/api-utils';
import { requireStation, scoreSheets } from '@/lib/mocks/omr-station';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return safeApiHandler(async () => {
    requireStation(req);
    const body = await req.json().catch(() => ({}));
    return scoreSheets(Number((await params).id), body.sheets);
  });
}
