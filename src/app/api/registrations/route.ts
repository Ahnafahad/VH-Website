import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { isAdminEmail } from '@/lib/generated-access-control';
import { connectToDatabase } from '@/lib/db';
import Registration from '@/lib/models/Registration';

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();

    const doc = await Registration.create({
      name: body.name,
      email: body.email,
      phone: body.phone,
      track: body.track,
      years: body.years || {},
      mode: body.mode,
      mocks: body.mocks || [],
      full: body.full || [],
      intent: body.intent || null,
      totalPrice: typeof body.totalPrice === 'number' ? body.totalPrice : undefined,
    });

    return NextResponse.json({ ok: true, id: doc._id }, { status: 201 });
  } catch (e) {
    console.error('POST /api/registrations failed', e);
    return NextResponse.json({ ok: false, error: 'Failed to save registration' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.toLowerCase();
    if (!email || !isAdminEmail(email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await connectToDatabase();
    const items = await Registration.find({}).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ items });
  } catch (e) {
    console.error('GET /api/registrations failed', e);
    return NextResponse.json({ error: 'Failed to fetch registrations' }, { status: 500 });
  }
}
