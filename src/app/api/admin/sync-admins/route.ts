import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/db';
import User from '@/lib/models/User';
import fs from 'fs';
import path from 'path';

/**
 * Sync admins from access-control.json to MongoDB
 * This endpoint can only be called by authenticated super admins
 */
export async function POST(request: NextRequest) {
  try {
    // Get session
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    console.log('[Sync Admins] Starting sync...');

    // Read access-control.json
    const jsonPath = path.join(process.cwd(), 'access-control.json');

    if (!fs.existsSync(jsonPath)) {
      return NextResponse.json({
        error: 'access-control.json not found',
        path: jsonPath,
        cwd: process.cwd()
      }, { status: 404 });
    }

    const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    const admins = jsonData.admins || [];
    console.log(`[Sync Admins] Found ${admins.length} admins in JSON`);

    // Connect to database
    await connectToDatabase();
    console.log('[Sync Admins] Connected to MongoDB');

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const results: any[] = [];

    for (const admin of admins) {
      try {
        const email = admin.email.toLowerCase();
        const existingUser = await User.findOne({ email });

        if (existingUser) {
          // Update if role changed
          if (existingUser.role !== admin.role) {
            existingUser.role = admin.role;
            existingUser.name = admin.name;
            existingUser.permissions = admin.permissions || ['read', 'write', 'delete'];
            existingUser.active = admin.active !== false;
            await existingUser.save();
            console.log(`[Sync Admins] Updated: ${email}`);
            updated++;
            results.push({ email, action: 'updated', role: admin.role });
          } else {
            console.log(`[Sync Admins] Skipped: ${email}`);
            skipped++;
            results.push({ email, action: 'skipped', role: admin.role });
          }
        } else {
          // Create new admin
          const newUser = new User({
            email,
            name: admin.name,
            role: admin.role,
            permissions: admin.permissions || ['read', 'write', 'delete'],
            active: admin.active !== false,
            addedDate: new Date()
          });
          await newUser.save();
          console.log(`[Sync Admins] Created: ${email}`);
          created++;
          results.push({ email, action: 'created', role: admin.role });
        }
      } catch (error) {
        console.error(`[Sync Admins] Error processing ${admin.email}:`, error);
        results.push({
          email: admin.email,
          action: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log('[Sync Admins] Sync complete!');

    return NextResponse.json({
      success: true,
      summary: {
        total: admins.length,
        created,
        updated,
        skipped,
        errors: results.filter(r => r.action === 'error').length
      },
      results
    });
  } catch (error) {
    console.error('[Sync Admins] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
