import { NextRequest, NextResponse } from 'next/server';
import { db, registrations } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { validateAuth, createErrorResponse, ApiException } from '@/lib/api-utils';
import { isAdminEmail } from '@/lib/db-access-control';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await validateAuth();
    if (!(await isAdminEmail(auth.email))) throw new ApiException('Unauthorized', 403);

    const data = await request.json();
    const { status, notes, name, email, phone } = data;
    const { id } = await params;
    const numId = parseInt(id);
    if (!numId) throw new ApiException('Invalid id', 400);

    if (status && !['pending', 'contacted', 'enrolled', 'cancelled'].includes(status)) {
      throw new ApiException('Invalid status', 400);
    }
    if (email && !email.includes('@')) throw new ApiException('Invalid email', 400);

    const updateSet: Record<string, unknown> = { updatedAt: new Date() };
    if (status !== undefined) updateSet.status = status;
    if (notes  !== undefined) updateSet.notes  = notes;
    if (name)                 updateSet.name   = name.trim();
    if (email)                updateSet.email  = email.trim().toLowerCase();
    if (phone)                updateSet.phone  = phone.trim();

    const [updated] = await db.update(registrations).set(updateSet).where(eq(registrations.id, numId)).returning();
    if (!updated) throw new ApiException('Registration not found', 404);

    return NextResponse.json({ success: true, registration: updated });
  } catch (error) {
    return createErrorResponse(error);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await validateAuth();
    if (!(await isAdminEmail(auth.email))) throw new ApiException('Unauthorized', 403);

    const { id } = await params;
    const row = await db.select().from(registrations).where(eq(registrations.id, parseInt(id))).get();
    if (!row) throw new ApiException('Registration not found', 404);

    return NextResponse.json({ success: true, registration: row });
  } catch (error) {
    return createErrorResponse(error);
  }
}
