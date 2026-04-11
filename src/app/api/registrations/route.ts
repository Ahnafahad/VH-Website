import { NextRequest, NextResponse } from 'next/server';
import { db, registrations } from '@/lib/db';
import { eq, desc } from 'drizzle-orm';
import { validateAuth, createErrorResponse, ApiException } from '@/lib/api-utils';
import { isAdminEmail } from '@/lib/db-access-control';
import { sendRegistrationNotification } from '@/lib/email';

// POST — public registration form submission
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { name, email, phone, educationType, years, programMode, selectedMocks, mockIntent, pricing, selectedFullCourses, referral } = data;

    const errors: string[] = [];
    if (!name?.trim())                                     errors.push('name is required');
    if (!email?.includes('@'))                             errors.push('valid email is required');
    if (!phone?.trim())                                    errors.push('phone is required');
    if (!['hsc', 'alevels'].includes(educationType))       errors.push('educationType must be hsc or alevels');
    if (!years || typeof years !== 'object')               errors.push('years is required');
    if (!['mocks', 'full'].includes(programMode))          errors.push('programMode must be mocks or full');
    if (programMode === 'mocks') {
      if (!Array.isArray(selectedMocks) || !selectedMocks.length) errors.push('at least one mock must be selected');
      if (!['trial', 'full'].includes(mockIntent))                errors.push('mockIntent must be trial or full');
    }
    if (programMode === 'full') {
      if (!Array.isArray(selectedFullCourses) || !selectedFullCourses.length) errors.push('at least one full course must be selected');
    }
    if (errors.length) throw new ApiException(`Validation failed: ${errors.join(', ')}`, 400);

    const [saved] = await db.insert(registrations).values({
      name:                name.trim(),
      email:               email.trim().toLowerCase(),
      phone:               phone.trim(),
      educationType,
      hscYear:             years.hscYear    || null,
      sscYear:             years.sscYear    || null,
      aLevelYear:          years.aLevelYear || null,
      oLevelYear:          years.oLevelYear || null,
      programMode,
      selectedMocks:       programMode === 'mocks' ? JSON.stringify(selectedMocks) : null,
      mockIntent:          programMode === 'mocks' ? mockIntent : null,
      pricingSubtotal:     pricing?.subtotal   ?? null,
      pricingDiscount:     pricing?.discount   ?? null,
      pricingFinalPrice:   pricing?.finalPrice ?? null,
      selectedFullCourses: programMode === 'full' ? JSON.stringify(selectedFullCourses) : null,
      referralName:        referral?.name        || null,
      referralInstitution: referral?.institution || null,
      referralBatch:       referral?.batch       || null,
      status:              'pending',
    }).returning({ id: registrations.id });

    // Non-blocking email notification
    sendRegistrationNotification({ name, email, phone, educationType, programMode, selectedMocks, selectedFullCourses, mockIntent, pricing, referral })
      .catch(e => console.error('Email notification failed:', e));

    return NextResponse.json({ success: true, registrationId: saved.id }, { status: 201 });
  } catch (error) {
    return createErrorResponse(error);
  }
}

// GET — admin: list registrations
export async function GET(request: NextRequest) {
  try {
    const auth = await validateAuth();
    if (!(await isAdminEmail(auth.email))) throw new ApiException('Unauthorized', 403);

    const { searchParams } = new URL(request.url);
    const status      = searchParams.get('status');
    const programMode = searchParams.get('programMode');
    const limit       = Math.min(parseInt(searchParams.get('limit') || '50'), 200);

    const conditions = [];
    if (status)      conditions.push(eq(registrations.status, status));
    if (programMode) conditions.push(eq(registrations.programMode, programMode));

    const { and: andOp } = await import('drizzle-orm');
    const rows = await db
      .select()
      .from(registrations)
      .where(conditions.length ? andOp(...conditions) : undefined)
      .orderBy(desc(registrations.createdAt))
      .limit(limit);

    // Status counts
    const countRows = await db.$client.execute('SELECT status, COUNT(*) as count FROM registrations GROUP BY status');
    const counts: Record<string, number> = { pending: 0, contacted: 0, enrolled: 0, cancelled: 0 };
    for (const r of countRows.rows as Array<Record<string, unknown>>) {
      counts[r.status as string] = Number(r.count);
    }

    return NextResponse.json({ success: true, registrations: rows, counts, total: rows.length });
  } catch (error) {
    return createErrorResponse(error);
  }
}
