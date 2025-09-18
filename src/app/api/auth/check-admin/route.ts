import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ isAdmin: false }, { status: 401 });
    }

    // Check if user is in access control file
    const accessControlPath = join(process.cwd(), 'access-control.json');

    if (!existsSync(accessControlPath)) {
      return NextResponse.json({ isAdmin: false }, { status: 404 });
    }

    const accessControlData = JSON.parse(readFileSync(accessControlPath, 'utf8'));
    const userEmail = session.user.email.toLowerCase();

    // Check if user is admin
    const isAdmin = accessControlData.admins?.some((admin: any) => admin.email.toLowerCase() === userEmail) || false;

    return NextResponse.json({ isAdmin });

  } catch (error) {
    console.error('Error checking admin status:', error);
    return NextResponse.json({ isAdmin: false }, { status: 500 });
  }
}