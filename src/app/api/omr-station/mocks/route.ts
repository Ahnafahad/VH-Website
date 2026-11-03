import { NextRequest } from 'next/server';
import { safeApiHandler } from '@/lib/api-utils';
import { requireStation, listMocks } from '@/lib/mocks/omr-station';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return safeApiHandler(async () => { requireStation(req); return listMocks(); });
}
