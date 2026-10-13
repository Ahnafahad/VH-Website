/** Shared wrapper for /api/admin/super/people/** routes: super-admin gate + zod body parsing + JSON error mapping. */
import { NextResponse } from 'next/server';
import type { ZodType } from 'zod';
import { ApiException, createErrorResponse } from '@/lib/api-utils';
import { requireSuperAdmin, type SuperActor } from '@/lib/super/guard';

export async function handle(fn: (actor: SuperActor) => Promise<unknown>): Promise<NextResponse> {
  try {
    const actor = await requireSuperAdmin();
    return NextResponse.json({ success: true, ...(await fn(actor) as object) });
  } catch (error) {
    return createErrorResponse(error);
  }
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  const raw = await req.json().catch(() => null);
  const r = schema.safeParse(raw);
  if (!r.success) throw new ApiException(`Invalid request: ${r.error.issues[0]?.path.join('.') || 'body'} ${r.error.issues[0]?.message ?? ''}`.trim(), 400);
  return r.data;
}

export function intParam(url: string, name: string): number {
  const v = Number(new URL(url).searchParams.get(name));
  if (!Number.isInteger(v) || v <= 0) throw new ApiException(`Invalid ${name}`, 400);
  return v;
}
