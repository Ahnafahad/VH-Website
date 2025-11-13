import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import User from '@/lib/models/User';
import { validateAuth, createErrorResponse, ApiException } from '@/lib/api-utils';
import { isAdminEmail } from '@/lib/db-access-control';
import fs from 'fs';
import path from 'path';

// POST - Migrate students from access-control.json to database (one-time operation)
export async function POST(request: NextRequest) {
  try {
    // Validate admin authentication
    const user = await validateAuth();

    // Check if user is super admin (only super admins can run migrations)
    const admin = await isAdminEmail(user.email);
    if (!admin) {
      throw new ApiException('Only super admins can run migrations', 403, 'UNAUTHORIZED');
    }

    // Connect to database
    await connectToDatabase();

    // Check if students already exist
    const existingCount = await User.countDocuments({ role: 'student' });
    if (existingCount > 0) {
      return NextResponse.json({
        success: false,
        message: `Migration skipped: ${existingCount} students already exist in database`,
        existingCount
      });
    }

    // Read access-control.json
    const jsonPath = path.join(process.cwd(), 'access-control.json');
    if (!fs.existsSync(jsonPath)) {
      throw new ApiException('access-control.json not found', 404, 'NOT_FOUND');
    }

    const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    const students = jsonData.students || [];

    if (students.length === 0) {
      throw new ApiException('No students found in access-control.json', 400, 'VALIDATION_ERROR');
    }

    // Migrate students
    const studentsToInsert = students.map((s: any) => ({
      email: s.email.toLowerCase(),
      name: s.name,
      role: 'student',
      studentId: s.studentId,
      class: s.class,
      batch: s.batch,
      permissions: s.permissions || ['read'],
      active: s.active !== false,
      addedDate: new Date(s.addedDate || '2025-09-17'),
      accessTypes: {
        IBA: (s.class || '').toUpperCase().includes('IBA'),
        FBS: (s.class || '').toUpperCase().includes('FBS')
      },
      mockAccess: {
        duIba: false,
        bupIba: false,
        duFbs: false,
        bupFbs: false,
        fbsDetailed: false
      },
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    // Insert all students
    const result = await User.insertMany(studentsToInsert, { ordered: false });

    return NextResponse.json({
      success: true,
      message: `Successfully migrated ${result.length} students to database`,
      migratedCount: result.length,
      students: result.map(s => ({
        email: s.email,
        name: s.name,
        studentId: s.studentId
      }))
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}
