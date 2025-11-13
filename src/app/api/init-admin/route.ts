import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import User from '@/lib/models/User';

/**
 * ONE-TIME INITIALIZATION ENDPOINT
 * This endpoint creates the initial super admin user if none exists.
 *
 * Security: This endpoint will only work if NO super_admin exists in the database yet.
 * After the first super admin is created, this endpoint will refuse to work.
 *
 * To use: Send a POST request with { "secret": "INIT_SECRET_FROM_ENV" }
 */
export async function POST(request: Request) {
  try {
    // Check for secret key to prevent unauthorized access
    const body = await request.json();
    const { secret } = body;

    // Verify secret (must be set in environment variables)
    const expectedSecret = process.env.INIT_ADMIN_SECRET || 'your-secret-key-change-this';
    if (secret !== expectedSecret) {
      return NextResponse.json(
        { error: 'Invalid secret key' },
        { status: 403 }
      );
    }

    await connectToDatabase();

    // Check if any super_admin already exists
    const existingSuperAdmin = await User.findOne({ role: 'super_admin' });
    if (existingSuperAdmin) {
      return NextResponse.json(
        {
          error: 'Super admin already exists',
          message: 'This endpoint can only be used for initial setup. Use /admin/users to manage users.'
        },
        { status: 400 }
      );
    }

    // Create the initial super admin from access-control.json data
    const adminUser = new User({
      email: 'ahnaf816@gmail.com',
      name: 'Ahnaf Ahad',
      role: 'super_admin',
      adminId: 'admin_001',
      permissions: ['read', 'write', 'admin', 'manage_users'],
      active: true,
      addedDate: new Date('2025-09-17'),
      accessTypes: {
        IBA: false,
        DU: false,
        FBS: false
      },
      mockAccess: {
        duIba: false,
        bupIba: false,
        duFbs: false,
        bupFbs: false,
        fbsDetailed: false
      }
    });

    await adminUser.save();

    return NextResponse.json({
      success: true,
      message: 'Initial super admin created successfully',
      admin: {
        email: adminUser.email,
        name: adminUser.name,
        role: adminUser.role
      }
    });

  } catch (error) {
    console.error('Init admin error:', error);
    return NextResponse.json(
      {
        error: 'Failed to initialize admin',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
