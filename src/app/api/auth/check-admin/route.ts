import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdminEmail, isSuperAdminEmail } from '@/lib/db-access-control';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ isAdmin: false, isSuperAdmin: false }, { status: 401 });
    }

    const email = session.user.email;
    const [isAdmin, isSuperAdmin] = await Promise.all([
      isAdminEmail(email),
      isSuperAdminEmail(email),
    ]);

    return NextResponse.json({ isAdmin, isSuperAdmin });
  } catch (error) {
    console.error('Error checking admin status:', error);
    return NextResponse.json({ isAdmin: false, isSuperAdmin: false }, { status: 500 });
  }
}
