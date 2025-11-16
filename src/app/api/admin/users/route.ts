import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import User from '@/lib/models/User';
import { validateAuth, createErrorResponse, ApiException } from '@/lib/api-utils';
import { isAdminEmail, getUserByEmail } from '@/lib/db-access-control';
import fs from 'fs';
import path from 'path';

/**
 * Sync a student's data to students.json
 * This ensures students.json stays in sync with MongoDB changes
 *
 * NOTE: In production (Vercel), the file system is read-only.
 * This function will gracefully fail without affecting the API response.
 */
function syncStudentToJson(user: any) {
  // Skip file sync in production environments (Vercel has read-only file system)
  if (process.env.NODE_ENV === 'production') {
    console.log('[syncStudentToJson] Skipping file sync in production (read-only file system)');
    return;
  }

  try {
    // Only sync students with roleNumbers
    if (!user.roleNumbers || user.roleNumbers.length === 0) {
      console.log('[syncStudentToJson] No roleNumbers to sync');
      return;
    }

    const studentsPath = path.join(process.cwd(), 'public', 'data', 'students.json');

    // Load existing students.json
    if (!fs.existsSync(studentsPath)) {
      console.warn('[syncStudentToJson] students.json not found at:', studentsPath);
      return;
    }

    const studentsData = JSON.parse(fs.readFileSync(studentsPath, 'utf8'));

    // Update all roleNumbers for this student
    let updated = false;
    user.roleNumbers.forEach((roleNumber: string) => {
      const roleNumberStr = String(roleNumber);
      if (studentsData.students[roleNumberStr]) {
        // Update existing student entry
        studentsData.students[roleNumberStr].email = user.email;
        studentsData.students[roleNumberStr].name = user.name;
        updated = true;
        console.log(`[syncStudentToJson] Updated roleNumber ${roleNumberStr}`);
      }
    });

    // Save if updated
    if (updated) {
      studentsData.metadata.lastUpdated = new Date().toISOString();
      fs.writeFileSync(studentsPath, JSON.stringify(studentsData, null, 2));
      console.log('[syncStudentToJson] Successfully wrote to students.json');
    } else {
      console.log('[syncStudentToJson] No updates needed');
    }
  } catch (error) {
    console.error('[syncStudentToJson] Error syncing student to JSON:', error);
    console.error('[syncStudentToJson] Error details:', error instanceof Error ? error.message : String(error));
    // Don't throw - this is a non-critical operation
  }
}

// GET - Fetch all users with optional filtering
export async function GET(request: NextRequest) {
  try {
    console.log('[GET /api/admin/users] Request received');

    // Validate admin authentication
    console.log('[GET /api/admin/users] Validating auth...');
    const user = await validateAuth();
    console.log('[GET /api/admin/users] Auth validated for:', user.email);

    // Check if user is admin (using hybrid access control - admins in JSON)
    console.log('[GET /api/admin/users] Checking admin status...');
    const adminCheck = await isAdminEmail(user.email);
    console.log('[GET /api/admin/users] Admin check result:', adminCheck);

    if (!adminCheck) {
      console.error('[GET /api/admin/users] User is not admin:', user.email);
      throw new ApiException('Unauthorized', 403, 'UNAUTHORIZED');
    }

    // Connect to database
    console.log('[GET /api/admin/users] Connecting to database...');
    await connectToDatabase();
    console.log('[GET /api/admin/users] Database connected');

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');
    const active = searchParams.get('active');
    const search = searchParams.get('search');

    // Build query
    const query: any = {};

    if (role) {
      query.role = role;
    }

    if (active !== null && active !== undefined) {
      query.active = active === 'true';
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { studentId: { $regex: search, $options: 'i' } }
      ];
    }

    // Fetch users
    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .lean();

    console.log('[GET /api/admin/users] Returning', users.length, 'users');
    return NextResponse.json({
      success: true,
      users: users,
      count: users.length
    });
  } catch (error) {
    console.error('[GET /api/admin/users] Error occurred:', error);
    return createErrorResponse(error);
  }
}

// POST - Create a new user
export async function POST(request: NextRequest) {
  try {
    // Validate admin authentication
    const user = await validateAuth();

    // Check if user is admin (using hybrid access control - admins in JSON)
    if (!(await isAdminEmail(user.email))) {
      throw new ApiException('Unauthorized', 403, 'UNAUTHORIZED');
    }

    // Connect to database
    await connectToDatabase();

    const body = await request.json();
    const {
      email,
      name,
      role,
      adminId,
      studentId,
      class: userClass,
      batch,
      accessTypes,
      mockAccess,
      permissions,
      active
    } = body;

    // Validation
    if (!email || !name || !role) {
      throw new ApiException(
        'Missing required fields: email, name, role',
        400,
        'VALIDATION_ERROR'
      );
    }

    // Validate email format
    if (!email.includes('@')) {
      throw new ApiException('Invalid email format', 400, 'VALIDATION_ERROR');
    }

    // Validate student ID format if provided
    if (studentId && !/^[0-9]{6}$/.test(studentId)) {
      throw new ApiException('Student ID must be exactly 6 digits', 400, 'VALIDATION_ERROR');
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        ...(studentId ? [{ studentId }] : []),
        ...(adminId ? [{ adminId }] : [])
      ]
    });

    if (existingUser) {
      throw new ApiException(
        'User with this email, student ID, or admin ID already exists',
        409,
        'CONFLICT'
      );
    }

    // Create new user
    const newUser = new User({
      email: email.toLowerCase(),
      name: name.trim(),
      role,
      adminId: adminId?.trim(),
      studentId: studentId?.trim(),
      class: userClass?.trim(),
      batch: batch?.trim(),
      accessTypes: accessTypes || { IBA: false, FBS: false },
      mockAccess: mockAccess || {
        duIba: false,
        bupIba: false,
        duFbs: false,
        bupFbs: false,
        fbsDetailed: false
      },
      permissions: permissions || ['read'],
      active: active !== undefined ? active : true,
      addedDate: new Date()
    });

    await newUser.save();

    // Sync new student to students.json
    syncStudentToJson(newUser);

    return NextResponse.json({
      success: true,
      message: 'User created successfully',
      user: newUser
    }, { status: 201 });
  } catch (error) {
    return createErrorResponse(error);
  }
}

// PATCH - Update a user
export async function PATCH(request: NextRequest) {
  try {
    console.log('[PATCH /api/admin/users] Request received');

    // Validate admin authentication
    console.log('[PATCH /api/admin/users] Validating auth...');
    const user = await validateAuth();
    console.log('[PATCH /api/admin/users] Auth validated for:', user.email);

    // Check if user is admin (using hybrid access control - admins in JSON)
    console.log('[PATCH /api/admin/users] Checking admin status...');
    if (!(await isAdminEmail(user.email))) {
      console.error('[PATCH /api/admin/users] User is not admin:', user.email);
      throw new ApiException('Unauthorized', 403, 'UNAUTHORIZED');
    }

    // Connect to database
    console.log('[PATCH /api/admin/users] Connecting to database...');
    await connectToDatabase();
    console.log('[PATCH /api/admin/users] Database connected');

    const body = await request.json();
    console.log('[PATCH /api/admin/users] Request body:', JSON.stringify(body, null, 2));
    const { userId, ...updates } = body;

    if (!userId) {
      throw new ApiException('User ID is required', 400, 'VALIDATION_ERROR');
    }

    // Find the user
    const existingUser = await User.findById(userId);
    if (!existingUser) {
      throw new ApiException('User not found', 404, 'NOT_FOUND');
    }

    // Prevent non-super-admins from modifying super-admins
    const adminUser = await getUserByEmail(user.email);
    if (existingUser.role === 'super_admin' && adminUser?.role !== 'super_admin') {
      throw new ApiException('Only super admins can modify super admin accounts', 403, 'UNAUTHORIZED');
    }

    // If email is being updated, check for duplicates
    if (updates.email && updates.email.toLowerCase() !== existingUser.email) {
      const emailExists = await User.findOne({ email: updates.email.toLowerCase() });
      if (emailExists) {
        throw new ApiException('Email already in use', 409, 'CONFLICT');
      }
    }

    // If studentId is being updated, check for duplicates
    if (updates.studentId && updates.studentId !== existingUser.studentId) {
      const studentIdExists = await User.findOne({ studentId: updates.studentId });
      if (studentIdExists) {
        throw new ApiException('Student ID already in use', 409, 'CONFLICT');
      }
    }

    // Update user fields
    Object.keys(updates).forEach(key => {
      if (key === 'email') {
        existingUser.email = updates.email.toLowerCase();
      } else if (key === 'accessTypes') {
        existingUser.accessTypes = { ...existingUser.accessTypes, ...updates.accessTypes };
      } else if (key === 'mockAccess') {
        existingUser.mockAccess = { ...existingUser.mockAccess, ...updates.mockAccess };
      } else {
        (existingUser as any)[key] = updates[key];
      }
    });

    await existingUser.save();

    // Sync student data to students.json if email or name changed
    if (updates.email || updates.name) {
      syncStudentToJson(existingUser);
    }

    console.log('[PATCH /api/admin/users] User updated successfully:', userId);
    return NextResponse.json({
      success: true,
      message: 'User updated successfully',
      user: existingUser
    });
  } catch (error) {
    console.error('[PATCH /api/admin/users] Error occurred:', error);
    return createErrorResponse(error);
  }
}

// DELETE - Delete a user
export async function DELETE(request: NextRequest) {
  try {
    // Validate admin authentication
    const user = await validateAuth();

    // Check if user is super admin (only super admins can delete users)
    const adminUser = await getUserByEmail(user.email);
    if (!adminUser || adminUser.role !== 'super_admin') {
      throw new ApiException('Only super admins can delete users', 403, 'UNAUTHORIZED');
    }

    // Connect to database
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      throw new ApiException('User ID is required', 400, 'VALIDATION_ERROR');
    }

    // Find the user
    const existingUser = await User.findById(userId);
    if (!existingUser) {
      throw new ApiException('User not found', 404, 'NOT_FOUND');
    }

    // Prevent deletion of super admin accounts
    if (existingUser.role === 'super_admin') {
      throw new ApiException('Cannot delete super admin accounts', 403, 'UNAUTHORIZED');
    }

    // Delete the user
    await User.findByIdAndDelete(userId);

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}
