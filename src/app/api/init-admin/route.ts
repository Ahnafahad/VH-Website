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

    // Check if any admins already exist
    const existingAdmins = await User.find({ role: { $in: ['super_admin', 'admin'] } });
    if (existingAdmins.length > 0) {
      return NextResponse.json(
        {
          error: 'Admins already exist',
          message: 'This endpoint can only be used for initial setup. Use /admin/users to manage users.',
          existingAdmins: existingAdmins.map(a => ({ email: a.email, role: a.role }))
        },
        { status: 400 }
      );
    }

    // Create both initial admins from access-control.json data
    const admins = [
      {
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
      },
      {
        email: 'hasanxsarower@gmail.com',
        name: 'Hasan Sarower',
        role: 'admin',
        adminId: 'admin_002',
        permissions: ['read', 'write', 'admin'],
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
      }
    ];

    const createdAdmins = [];
    for (const adminData of admins) {
      const adminUser = new User(adminData);
      await adminUser.save();
      createdAdmins.push({
        email: adminUser.email,
        name: adminUser.name,
        role: adminUser.role
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Initial admins created successfully',
      admins: createdAdmins
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
