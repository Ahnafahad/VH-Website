import { NextRequest } from 'next/server';
import { ApiException, safeApiHandler } from '@/lib/api-utils';
import { requireOperationalAdmin } from '@/lib/lms/operations-auth';
import { deleteOperationalRecord, parseOperationalId, parseOperationalSection, saveOperationalRecord } from '@/lib/lms/operations-store';

export async function PATCH(req: NextRequest, context: { params: Promise<{ section: string; id: string }> }) {
  return safeApiHandler(async () => {
    const admin = await requireOperationalAdmin();
    const params = await context.params;
    const section = parseOperationalSection(params.section);
    const id = parseOperationalId(params.id);
    const body = await req.json().catch(() => { throw new ApiException('Invalid JSON', 400); });
    return saveOperationalRecord(section, body, admin.id, id);
  });
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ section: string; id: string }> }) {
  return safeApiHandler(async () => {
    await requireOperationalAdmin();
    const params = await context.params;
    return deleteOperationalRecord(parseOperationalSection(params.section), parseOperationalId(params.id));
  });
}
