import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserByEmail, isAdminEmail } from '@/lib/db-access-control';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ hasIBA: false, hasFBS: false, isAdmin: false });
    }

    // Check if user is admin
    const adminCheck = await isAdminEmail(session.user.email);

    // Admins have access to everything
    if (adminCheck) {
      return NextResponse.json({ hasIBA: true, hasFBS: true, isAdmin: true });
    }

    // Get user from database for students
    const user = await getUserByEmail(session.user.email);

    if (!user) {
      return NextResponse.json({ hasIBA: false, hasFBS: false, isAdmin: false });
    }

    // Check access types for students
    const hasIBA = user.accessTypes?.IBA || false;
    const hasFBS = user.accessTypes?.FBS || false;

    return NextResponse.json({
      hasIBA,
      hasFBS,
      isAdmin: false,
      roleNumbers: user.roleNumbers || []
    });

  } catch (error) {
    console.error('Error checking user access:', error);
    return NextResponse.json({ hasIBA: false, hasFBS: false, isAdmin: false });
  }
}
