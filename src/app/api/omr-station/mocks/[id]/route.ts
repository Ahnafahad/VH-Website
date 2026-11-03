import { NextRequest } from 'next/server';
import { safeApiHandler } from '@/lib/api-utils';
import { requireStation, buildBundle } from '@/lib/mocks/omr-station';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return safeApiHandler(async () => { requireStation(req); return buildBundle(Number((await params).id)); });
}
