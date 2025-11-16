import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { isAdminEmail, getUserByEmail } from '@/lib/db-access-control';
import { connectToDatabase } from '@/lib/db';
import fs from 'fs';
import path from 'path';

/**
 * Debug endpoint to help diagnose admin authentication issues
 * This should be removed or secured after debugging
 */
export async function GET(request: NextRequest) {
  try {
    // Get session
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({
        error: 'No session found',
        hasSession: false
      });
    }

    const email = session.user.email.toLowerCase();

    // Check if access-control.json exists
    const jsonPath = path.join(process.cwd(), 'access-control.json');
    const jsonExists = fs.existsSync(jsonPath);
    let jsonAdmins = [];
    let adminInJson = false;

    if (jsonExists) {
      try {
        const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        jsonAdmins = jsonData.admins || [];
        adminInJson = jsonAdmins.some((admin: any) =>
          admin.email.toLowerCase() === email && admin.active !== false
        );
      } catch (e) {
        console.error('Error reading JSON:', e);
      }
    }

    // Check database
    await connectToDatabase();
    const userFromDb = await getUserByEmail(email);
    const isAdmin = await isAdminEmail(email);

    return NextResponse.json({
      email,
      hasSession: true,
      sessionName: session.user.name,
      jsonFile: {
        exists: jsonExists,
        path: jsonPath,
        totalAdmins: jsonAdmins.length,
        adminFoundInJson: adminInJson
      },
      database: {
        userFound: !!userFromDb,
        userRole: userFromDb?.role || null,
        isAdmin
      },
      cwd: process.cwd(),
      nodeEnv: process.env.NODE_ENV
    });
  } catch (error) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
