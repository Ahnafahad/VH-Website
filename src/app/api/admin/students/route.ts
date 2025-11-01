import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { validateAuth, createErrorResponse, ApiException } from '@/lib/api-utils';

const execAsync = promisify(exec);

const ACCESS_CONTROL_PATH = path.join(process.cwd(), 'access-control.json');

// GET - Fetch all students from access-control.json
export async function GET(request: NextRequest) {
  try {
    // Validate admin authentication
    const user = await validateAuth();
    const { isAdminEmail } = await import('@/lib/generated-access-control');

    if (!isAdminEmail(user.email)) {
      throw new ApiException('Unauthorized', 403, 'UNAUTHORIZED');
    }

    // Read access-control.json
    const fileContent = await fs.readFile(ACCESS_CONTROL_PATH, 'utf-8');
    const accessControl = JSON.parse(fileContent);

    return NextResponse.json({
      success: true,
      students: accessControl.students || []
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}

// PATCH - Update student information in access-control.json
export async function PATCH(request: NextRequest) {
  try {
    // Validate admin authentication
    const user = await validateAuth();
    const { isAdminEmail } = await import('@/lib/generated-access-control');

    if (!isAdminEmail(user.email)) {
      throw new ApiException('Unauthorized', 403, 'UNAUTHORIZED');
    }

    const body = await request.json();
    const { studentId, ...updates } = body;

    if (!studentId) {
      throw new ApiException('Student ID is required', 400, 'VALIDATION_ERROR');
    }

    // Read current access-control.json
    const fileContent = await fs.readFile(ACCESS_CONTROL_PATH, 'utf-8');
    const accessControl = JSON.parse(fileContent);

    // Find and update the student
    const studentIndex = accessControl.students.findIndex(
      (s: any) => s.studentId === studentId
    );

    if (studentIndex === -1) {
      throw new ApiException('Student not found', 404, 'NOT_FOUND');
    }

    // Update student fields
    accessControl.students[studentIndex] = {
      ...accessControl.students[studentIndex],
      ...updates
    };

    // Write back to access-control.json
    await fs.writeFile(
      ACCESS_CONTROL_PATH,
      JSON.stringify(accessControl, null, 2),
      'utf-8'
    );

    // Regenerate access control TypeScript file
    try {
      await execAsync('npm run generate:access-control');
    } catch (error) {
      console.error('Failed to regenerate access control:', error);
      // Don't fail the request if regeneration fails
    }

    return NextResponse.json({
      success: true,
      message: 'Student updated successfully',
      student: accessControl.students[studentIndex]
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}
