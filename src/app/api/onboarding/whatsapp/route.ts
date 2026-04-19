import { NextRequest, NextResponse } from 'next/server';
import { db, users, freeSignups } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { validateAuth, createErrorResponse, ApiException } from '@/lib/api-utils';
import { clearAccessControlCache } from '@/lib/db-access-control';
import { sendFreeSignupNotification } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const auth = await validateAuth();
    const { whatsapp } = await request.json();
    const trimmed = typeof whatsapp === 'string' ? whatsapp.trim() : '';
    if (!/^[+\s\d-]{6,20}$/.test(trimmed)) {
      throw new ApiException('Valid WhatsApp number is required', 400);
    }

    const row = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.email, auth.email.toLowerCase()))
      .get();

    if (!row) throw new ApiException('User not found', 404);

    const now = new Date();
    await db
      .update(users)
      .set({ whatsapp: trimmed, onboardedAt: now, updatedAt: now })
      .where(eq(users.id, row.id));

    const existingSignup = await db
      .select({ id: freeSignups.id })
      .from(freeSignups)
      .where(eq(freeSignups.email, row.email))
      .limit(1);

    if (!existingSignup.length) {
      await db.insert(freeSignups).values({
        userId: row.id,
        name: row.name,
        email: row.email,
        whatsapp: trimmed,
      });
      sendFreeSignupNotification({ name: row.name, email: row.email, whatsapp: trimmed })
        .catch(e => console.error('Free signup notification failed:', e));
    }

    clearAccessControlCache(row.email);

    return NextResponse.json({ success: true });
  } catch (error) {
    return createErrorResponse(error);
  }
}
