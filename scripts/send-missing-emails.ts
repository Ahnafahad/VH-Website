/**
 * Send student confirmation emails to registrations that never received one,
 * then write the real outcome (sent/failed) back to the DB.
 *
 * Run with:
 *   npx tsx scripts/send-missing-emails.ts
 */

// dotenv must run before ANY other import that reads env vars at module init time
import { config } from 'dotenv';
config({ path: '.env.local' });
// Also suppress TLS error for local Turso connection
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Dynamic imports so env vars are already set when these modules initialise
const { createClient } = await import('@libsql/client');
const { sendStudentConfirmationEmail } = await import('../src/lib/email');

const client = createClient({
  url:       process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

// IDs to send to — those with NULL student_email_status that actually need the email
// (excluding self #2, duplicates #4/#8)
const TARGET_IDS = [11, 12, 13];

async function run() {
  const rows = await client.execute(
    `SELECT id, name, email, program_mode, selected_mocks, selected_full_courses, student_email_status
     FROM registrations
     WHERE id IN (${TARGET_IDS.join(',')})
     ORDER BY id`
  );

  console.log(`Found ${rows.rows.length} registrations to process.\n`);

  for (const row of rows.rows) {
    const id              = row.id as number;
    const name            = row.name as string;
    const email           = row.email as string;
    const programMode     = row.program_mode as 'mocks' | 'full';
    const existingStatus  = row.student_email_status as string | null;
    const selectedMocks   = row.selected_mocks
      ? JSON.parse(row.selected_mocks as string)
      : undefined;
    const selectedFullCourses = row.selected_full_courses
      ? JSON.parse(row.selected_full_courses as string)
      : undefined;

    if (existingStatus === 'sent') {
      console.log(`#${id} ${name} — already marked sent, skipping.`);
      continue;
    }

    console.log(`#${id} ${name} <${email}> — sending...`);

    const result = await sendStudentConfirmationEmail({
      name,
      email,
      programMode,
      selectedMocks,
      selectedFullCourses,
    });

    const newStatus = result.success ? 'sent' : 'failed';

    await client.execute({
      sql: 'UPDATE registrations SET student_email_status = ? WHERE id = ?',
      args: [newStatus, id],
    });

    if (result.success) {
      console.log(`  ✓ Email sent. DB updated to "sent".`);
    } else {
      console.log(`  ✗ Email FAILED. DB updated to "failed". Error:`, (result as any).error);
    }
  }

  console.log('\nDone.');
  process.exit(0);
}

run().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
