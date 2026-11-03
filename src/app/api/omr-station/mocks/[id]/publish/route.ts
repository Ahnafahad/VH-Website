import { NextRequest } from 'next/server';
import { safeApiHandler } from '@/lib/api-utils';
import { requireStation, publish } from '@/lib/mocks/omr-station';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return safeApiHandler(async () => {
    requireStation(req);
    return publish(Number((await params).id), await req.json().catch(() => ({})));
  });
}
