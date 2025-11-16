import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { isAdminEmail } from '@/lib/db-access-control';
import { connectToDatabase } from '@/lib/db';
import User from '@/lib/models/User';
import fs from 'fs';
import path from 'path';

/**
 * Sync roleNumbers from students.json to MongoDB
 * This ensures FBS students can access their mock test results
 *
 * The issue: FBS mock results use 7-digit IDs as keys, but users might not have
 * these IDs in their roleNumbers array in MongoDB.
 */
export async function POST() {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || !(await isAdminEmail(session.user.email))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    console.log('[Sync Role Numbers] Starting sync...');

    // Read students.json
    const studentsPath = path.join(process.cwd(), 'public', 'data', 'students.json');
    if (!fs.existsSync(studentsPath)) {
      return NextResponse.json({
        error: 'students.json not found',
        path: studentsPath
      }, { status: 404 });
    }

    const studentsData = JSON.parse(fs.readFileSync(studentsPath, 'utf-8'));
    const students = studentsData.students;

    // Connect to database
    await connectToDatabase();
    console.log('[Sync Role Numbers] Connected to MongoDB');

    let updated = 0;
    const created = 0;
    let skipped = 0;
    let errors = 0;
    const results: any[] = [];

    // Build a map of email -> all IDs (both 6-digit and 7-digit)
    const emailToIds = new Map<string, Set<string>>();

    Object.entries(students).forEach(([key, student]: [string, any]) => {
      const email = student.email?.toLowerCase()?.trim();
      if (email) {
        if (!emailToIds.has(email)) {
          emailToIds.set(email, new Set());
        }
        // Add both the key (actual ID) and the id field
        emailToIds.get(email)!.add(key);
        if (student.id && student.id !== key) {
          emailToIds.get(email)!.add(student.id);
        }
      }
    });

    console.log(`[Sync Role Numbers] Found ${emailToIds.size} unique emails in students.json`);

    // Update each user with their roleNumbers
    for (const [email, ids] of emailToIds.entries()) {
      try {
        const user = await User.findOne({ email });

        if (user) {
          const roleNumbersArray = Array.from(ids);
          const currentRoleNumbers = user.roleNumbers || [];

          // Check if update is needed
          const needsUpdate = roleNumbersArray.some(id => !currentRoleNumbers.includes(id)) ||
                             currentRoleNumbers.some(id => !roleNumbersArray.includes(id));

          if (needsUpdate) {
            user.roleNumbers = roleNumbersArray;

            // Also set studentId to the 6-digit ID if present
            const sixDigitId = roleNumbersArray.find(id => id.length === 6);
            if (sixDigitId && !user.studentId) {
              user.studentId = sixDigitId;
            }

            await user.save();
            console.log(`[Sync Role Numbers] Updated ${email}: ${roleNumbersArray.join(', ')}`);
            updated++;
            results.push({ email, action: 'updated', roleNumbers: roleNumbersArray });
          } else {
            console.log(`[Sync Role Numbers] Skipped ${email}: already has correct roleNumbers`);
            skipped++;
            results.push({ email, action: 'skipped', roleNumbers: roleNumbersArray });
          }
        } else {
          console.log(`[Sync Role Numbers] User not found in DB: ${email}`);
          skipped++;
          results.push({ email, action: 'not_found', message: 'User not in database' });
        }
      } catch (error) {
        console.error(`[Sync Role Numbers] Error processing ${email}:`, error);
        errors++;
        results.push({
          email,
          action: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log('[Sync Role Numbers] Sync complete!');

    return NextResponse.json({
      success: true,
      summary: {
        totalEmails: emailToIds.size,
        updated,
        created,
        skipped,
        errors
      },
      results
    });

  } catch (error) {
    console.error('[Sync Role Numbers] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
