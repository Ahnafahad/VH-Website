import { NextRequest, NextResponse } from 'next/server';
import { db, users, freeSignups } from '@/lib/db';
import { eq, desc } from 'drizzle-orm';
import { validateAuth, createErrorResponse, ApiException } from '@/lib/api-utils';
import { isAdminEmail } from '@/lib/db-access-control';
import { sendFreeSignupNotification } from '@/lib/email';

// POST — public free signup submission (games + free resources access)
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { name, email, whatsapp } = data;

    const errors: string[] = [];
    const trimmedName = typeof name === 'string' ? name.trim() : '';
    const trimmedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const trimmedWhatsapp = typeof whatsapp === 'string' ? whatsapp.trim() : '';

    if (!trimmedName) errors.push('name is required');
    if (!trimmedEmail.endsWith('@gmail.com')) errors.push('a @gmail.com address is required (Google sign-in)');
    if (!/^[+\s\d-]{6,20}$/.test(trimmedWhatsapp)) errors.push('valid WhatsApp number is required');
    if (errors.length) throw new ApiException(`Validation failed: ${errors.join(', ')}`, 400);

    // If the email already exists in users, surface "welcome back" — don't duplicate.
    const existingUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, trimmedEmail))
      .limit(1);

    if (existingUser.length) {
      // Also check if they already have a free_signups row — if not, create one
      const existingSignup = await db
        .select({ id: freeSignups.id })
        .from(freeSignups)
        .where(eq(freeSignups.email, trimmedEmail))
        .limit(1);

      if (!existingSignup.length) {
        await db.insert(freeSignups).values({
          userId: existingUser[0].id,
          name: trimmedName,
          email: trimmedEmail,
          whatsapp: trimmedWhatsapp,
        });
      }

      return NextResponse.json({
        success: true,
        alreadyRegistered: true,
        signInUrl: '/api/auth/signin',
      });
    }

    const [newUser] = await db
      .insert(users)
      .values({
        email: trimmedEmail,
        name: trimmedName,
        role: 'student',
        status: 'active',
      })
      .returning({ id: users.id });

    await db.insert(freeSignups).values({
      userId: newUser.id,
      name: trimmedName,
      email: trimmedEmail,
      whatsapp: trimmedWhatsapp,
    });

    sendFreeSignupNotification({ name: trimmedName, email: trimmedEmail, whatsapp: trimmedWhatsapp })
      .catch(e => console.error('Free signup notification failed:', e));

    return NextResponse.json({
      success: true,
      alreadyRegistered: false,
      signInUrl: '/api/auth/signin',
    }, { status: 201 });
  } catch (error) {
    return createErrorResponse(error);
  }
}

// GET — admin: list free signups
export async function GET() {
  try {
    const auth = await validateAuth();
    if (!(await isAdminEmail(auth.email))) throw new ApiException('Unauthorized', 403);

    const rows = await db
      .select()
      .from(freeSignups)
      .orderBy(desc(freeSignups.createdAt))
      .limit(500);

    return NextResponse.json({ success: true, freeSignups: rows, total: rows.length });
  } catch (error) {
    return createErrorResponse(error);
  }
}
