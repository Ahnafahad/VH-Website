import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserByEmail, isAdminEmail, computeAccessFromProducts } from '@/lib/db-access-control';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ hasIBA: false, hasFBS: false, isAdmin: false });
    }

    const isAdmin = await isAdminEmail(session.user.email);
    if (isAdmin) {
      return NextResponse.json({ hasIBA: true, hasFBS: true, isAdmin: true });
    }

    const user = await getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ hasIBA: false, hasFBS: false, isAdmin: false });
    }

    const access = computeAccessFromProducts(user);
    return NextResponse.json({
      hasIBA:      access.accessTypes.IBA,
      hasFBS:      access.accessTypes.FBS,
      isAdmin:     false,
      products:    user.products,
    });
  } catch (error) {
    console.error('Error checking user access:', error);
    return NextResponse.json({ hasIBA: false, hasFBS: false, isAdmin: false });
  }
}
