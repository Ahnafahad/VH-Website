import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import User from '@/lib/models/User';
import { validateAuth, createErrorResponse, ApiException } from '@/lib/api-utils';

// GET - Fetch all users with optional filtering
export async function GET(request: NextRequest) {
  try {
    // Validate admin authentication
    const user = await validateAuth();

    // Connect to database
    await connectToDatabase();

    // Check if user is admin
    const adminUser = await User.findOne({ email: user.email.toLowerCase(), role: { $in: ['super_admin', 'admin'] } });
    if (!adminUser) {
      throw new ApiException('Unauthorized', 403, 'UNAUTHORIZED');
    }

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

    return NextResponse.json({
      success: true,
      users: users,
      count: users.length
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}

// POST - Create a new user
export async function POST(request: NextRequest) {
  try {
    // Validate admin authentication
    const user = await validateAuth();

    // Connect to database
    await connectToDatabase();

    // Check if user is admin
    const adminUser = await User.findOne({ email: user.email.toLowerCase(), role: { $in: ['super_admin', 'admin'] } });
    if (!adminUser) {
      throw new ApiException('Unauthorized', 403, 'UNAUTHORIZED');
    }

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
      accessTypes: accessTypes || { IBA: false, DU: false, FBS: false },
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
    // Validate admin authentication
    const user = await validateAuth();

    // Connect to database
    await connectToDatabase();

    // Check if user is admin
    const adminUser = await User.findOne({ email: user.email.toLowerCase(), role: { $in: ['super_admin', 'admin'] } });
    if (!adminUser) {
      throw new ApiException('Unauthorized', 403, 'UNAUTHORIZED');
    }

    const body = await request.json();
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
    if (existingUser.role === 'super_admin' && adminUser.role !== 'super_admin') {
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

    return NextResponse.json({
      success: true,
      message: 'User updated successfully',
      user: existingUser
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}

// DELETE - Delete a user
export async function DELETE(request: NextRequest) {
  try {
    // Validate admin authentication
    const user = await validateAuth();

    // Connect to database
    await connectToDatabase();

    // Check if user is super admin (only super admins can delete users)
    const adminUser = await User.findOne({ email: user.email.toLowerCase(), role: 'super_admin' });
    if (!adminUser) {
      throw new ApiException('Only super admins can delete users', 403, 'UNAUTHORIZED');
    }

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
