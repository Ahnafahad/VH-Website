import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import User from '@/lib/models/User';
import { isAdminEmail } from '@/lib/db-access-control';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

interface StudentData {
  studentId: string;
  name: string;
  email: string;
}

export async function POST(request: NextRequest) {
  try {
    // Validate admin authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin
    if (!(await isAdminEmail(session.user.email))) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    // Connect to database
    await connectToDatabase();

    const body = await request.json();
    const { students, accessType } = body as {
      students: StudentData[];
      accessType: 'DU FBS' | 'BUP FBS';
    };

    if (!students || !Array.isArray(students)) {
      return NextResponse.json(
        { success: false, error: 'Invalid request: students array required' },
        { status: 400 }
      );
    }

    const results = {
      migrated: 0,
      updated: 0,
      created: 0,
      errors: [] as any[]
    };

    // Step 1: Migrate existing studentIds to roleNumbers (one-time migration)
    const usersToMigrate = await User.find({
      studentId: { $exists: true, $ne: null },
      $or: [
        { roleNumbers: { $exists: false } },
        { roleNumbers: { $size: 0 } }
      ]
    });

    for (const user of usersToMigrate) {
      if (user.studentId) {
        user.roleNumbers = [user.studentId];
        await user.save();
        results.migrated++;
      }
    }

    // Step 2: Process each student in the request
    for (const student of students) {
      try {
        const { studentId, name, email } = student;

        // Validate required fields
        if (!studentId || !name || !email) {
          results.errors.push({
            email,
            error: 'Missing required fields'
          });
          continue;
        }

        // Validate studentId format (7 digits for FBS)
        if (!/^[0-9]{7}$/.test(studentId)) {
          results.errors.push({
            email,
            error: 'FBS Student ID must be exactly 7 digits'
          });
          continue;
        }

        // Check if user exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });

        if (existingUser) {
          // User exists - update their roleNumbers and access
          const roleNumbers = existingUser.roleNumbers || [];

          // Add new FBS role if not already present
          if (!roleNumbers.includes(studentId)) {
            roleNumbers.push(studentId);
          }

          // Update access types - set FBS to true
          existingUser.roleNumbers = roleNumbers;
          existingUser.accessTypes = {
            ...existingUser.accessTypes,
            FBS: true
          };

          // Update mockAccess based on access type
          if (accessType === 'DU FBS') {
            existingUser.mockAccess = {
              ...existingUser.mockAccess,
              duFbs: true
            };
          } else if (accessType === 'BUP FBS') {
            existingUser.mockAccess = {
              ...existingUser.mockAccess,
              bupFbs: true
            };
          }

          await existingUser.save();
          results.updated++;
        } else {
          // User doesn't exist - create new user
          const newUser = new User({
            email: email.toLowerCase(),
            name: name.trim(),
            role: 'student',
            studentId: studentId, // Keep for backward compatibility
            roleNumbers: [studentId],
            accessTypes: {
              IBA: false,
              FBS: true
            },
            mockAccess: {
              duIba: false,
              bupIba: false,
              duFbs: accessType === 'DU FBS',
              bupFbs: accessType === 'BUP FBS',
              fbsDetailed: false
            },
            permissions: ['read'],
            active: true,
            addedDate: new Date()
          });

          await newUser.save();
          results.created++;
        }
      } catch (error: any) {
        results.errors.push({
          email: student.email,
          error: error.message
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${students.length} students`,
      results
    });
  } catch (error: any) {
    console.error('Error adding FBS students:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
