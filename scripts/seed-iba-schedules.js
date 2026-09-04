/**
 * Seed IBA class schedules: Sun 2-4pm, Mon 2-4pm, Thurs 4-6pm
 * Run once to create recurring schedule rows. Subjects are TBA and can be set per-session.
 */

import { config } from 'dotenv';
config();

import { createClient } from '@libsql/client';

const turso = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function seed() {
  try {
    // Get any admin user (use id 1 if available, else 2)
    const adminUser = await turso.execute({
      sql: `SELECT id FROM users WHERE role IN ('admin', 'super_admin') LIMIT 1`,
      args: [],
    });

    if (!adminUser.rows || adminUser.rows.length === 0) {
      console.error('❌ No admin user found. Create an admin account first.');
      process.exit(1);
    }

    const createdBy = Number(adminUser.rows[0].id);

    const schedules = [
      {
        titleTemplate: 'Sunday Class',
        subject: 'english', // placeholder; will vary per-session
        product: 'iba',
        batch: null,
        dayOfWeek: 0, // Sunday
        timeOfDay: '14:00',
        durationMinutes: 120,
        active: true,
      },
      {
        titleTemplate: 'Monday Class',
        subject: 'math',
        product: 'iba',
        batch: null,
        dayOfWeek: 1, // Monday
        timeOfDay: '14:00',
        durationMinutes: 120,
        active: true,
      },
      {
        titleTemplate: 'Thursday Class',
        subject: 'analytical',
        product: 'iba',
        batch: null,
        dayOfWeek: 4, // Thursday
        timeOfDay: '16:00',
        durationMinutes: 120,
        active: true,
      },
    ];

    for (const schedule of schedules) {
      const existing = await turso.execute({
        sql: `SELECT id FROM class_schedules WHERE day_of_week = ? AND time_of_day = ?`,
        args: [schedule.dayOfWeek, schedule.timeOfDay],
      });

      if (existing.rows && existing.rows.length > 0) {
        console.log(`⏭️  ${schedule.titleTemplate} already exists (ID: ${existing.rows[0].id})`);
        continue;
      }

      await turso.execute({
        sql: `INSERT INTO class_schedules
              (title_template, subject, product, batch, day_of_week, time_of_day, duration_minutes, active, created_by, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())`,
        args: [
          schedule.titleTemplate,
          schedule.subject,
          schedule.product,
          schedule.batch,
          schedule.dayOfWeek,
          schedule.timeOfDay,
          schedule.durationMinutes,
          schedule.active ? 1 : 0,
          createdBy,
        ],
      });

      console.log(`✓ Created: ${schedule.titleTemplate} (${schedule.dayOfWeek} @ ${schedule.timeOfDay})`);
    }

    console.log('\n✓ IBA schedules seeded. Use /admin/classes → Schedules tab to generate sessions.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
}

seed();
