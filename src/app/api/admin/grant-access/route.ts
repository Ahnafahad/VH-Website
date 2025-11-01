import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { validateAuth, createErrorResponse, ApiException } from '@/lib/api-utils';

const execAsync = promisify(exec);

const ACCESS_CONTROL_PATH = path.join(process.cwd(), 'access-control.json');

// POST - Add a new student to access-control.json
export async function POST(request: NextRequest) {
  try {
    // Validate admin authentication
    const user = await validateAuth();
    const { isAdminEmail } = await import('@/lib/generated-access-control');

    if (!isAdminEmail(user.email)) {
      throw new ApiException('Unauthorized', 403, 'UNAUTHORIZED');
    }

    const body = await request.json();
    const { name, email, studentId, class: studentClass, batch, permissions } = body;

    // Validation
    if (!name || !email || !studentId || !studentClass || !batch) {
      throw new ApiException(
        'Missing required fields: name, email, studentId, class, batch',
        400,
        'VALIDATION_ERROR'
      );
    }

    // Validate student ID format (6 digits)
    if (!/^[0-9]{6}$/.test(studentId)) {
      throw new ApiException('Student ID must be exactly 6 digits', 400, 'VALIDATION_ERROR');
    }

    // Validate email format
    if (!email.includes('@')) {
      throw new ApiException('Invalid email format', 400, 'VALIDATION_ERROR');
    }

    // Read current access-control.json
    const fileContent = await fs.readFile(ACCESS_CONTROL_PATH, 'utf-8');
    const accessControl = JSON.parse(fileContent);

    // Check if student already exists
    const existingStudent = accessControl.students.find(
      (s: any) => s.studentId === studentId || s.email.toLowerCase() === email.toLowerCase()
    );

    if (existingStudent) {
      throw new ApiException(
        'Student with this ID or email already exists',
        409,
        'CONFLICT'
      );
    }

    // Create new student object
    const newStudent = {
      studentId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role: 'student',
      permissions: permissions || ['read'],
      addedDate: new Date().toISOString().split('T')[0],
      active: true,
      class: studentClass.trim(),
      batch: batch.trim()
    };

    // Add to students array
    accessControl.students.push(newStudent);

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
      message: 'Access granted successfully',
      student: newStudent
    }, { status: 201 });
  } catch (error) {
    return createErrorResponse(error);
  }
}
