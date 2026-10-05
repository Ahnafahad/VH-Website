import { NextRequest } from 'next/server';
import { ApiException, safeApiHandler } from '@/lib/api-utils';
import { requireOperationalAdmin } from '@/lib/lms/operations-auth';
import { parseOperationalSection, readOperationalSection, saveOperationalRecord } from '@/lib/lms/operations-store';

type Context = { params: Promise<{ section: string }> };

export async function GET(_req: NextRequest, context: Context) {
  return safeApiHandler(async () => {
    await requireOperationalAdmin();
    const section = parseOperationalSection((await context.params).section);
    return readOperationalSection(section);
  });
}

export async function POST(req: NextRequest, context: Context) {
  return safeApiHandler(async () => {
    const admin = await requireOperationalAdmin();
    const section = parseOperationalSection((await context.params).section);
    const body = await req.json().catch(() => { throw new ApiException('Invalid JSON', 400); });
    return saveOperationalRecord(section, body, admin.id);
  });
}
