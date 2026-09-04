/**
 * Send student confirmation emails to registrations that never received one,
 * then write the real outcome ('sent' / 'failed') back to the DB.
 *
 * Uses Node 20 fetch + @libsql/client directly so there are no TypeScript
 * import-order issues.
 *
 * Run with:  node scripts/send-missing-emails.mjs
 */

import { readFileSync } from 'fs';
import { createClient } from '../node_modules/@libsql/client/lib-esm/node.js';

// ── Load .env.local manually ──────────────────────────────────────────────────
const envLines = readFileSync('.env.local', 'utf8').split('\n');
const env = {};
for (const line of envLines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq < 0) continue;
  env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
}

// Allow env var override (process.env takes priority over .env.local)
const RESEND_API_KEY      = process.env.RESEND_API_KEY ?? env.RESEND_API_KEY;
const TURSO_DATABASE_URL  = env.TURSO_DATABASE_URL;
const TURSO_AUTH_TOKEN    = env.TURSO_AUTH_TOKEN;
const BASE_URL            = (env.NEXTAUTH_URL ?? 'https://vh-beyondthehorizons.org').replace(/\/$/, '');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // local TLS quirk

// ── DB client ─────────────────────────────────────────────────────────────────
const db = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN });

// ── Registration IDs to send to ───────────────────────────────────────────────
// These had NULL student_email_status: Mister Bald Man (#11), Habibur (#12), rahmi (#13)
const TARGET_IDS = [11, 12, 13];

// ── Email builder (mirrors email.ts exactly) ──────────────────────────────────
function buildEmail(name, programMode, selectedMocks, selectedFullCourses) {
  const MOCK_NAMES = {
    'du-iba': 'DU IBA', 'bup-iba': 'BUP IBA',
    'du-fbs': 'DU FBS', 'bup-fbs': 'BUP FBS',
  };
  const FULL_NAMES = {
    'iba-combined': 'DU IBA & BUP IBA',
    'du-fbs-full':  'DU FBS',
    'bup-fbs-full': 'BUP FBS',
  };
  const pretty = (k, map) => map[k] ?? k;

  const programLines = programMode === 'mocks'
    ? (selectedMocks ?? []).map(k => pretty(k, MOCK_NAMES))
    : (selectedFullCourses ?? []).map(k => pretty(k, FULL_NAMES));

  const programBlock = programLines.length > 0
    ? `<tr><td style="padding:0 40px 24px;"><div style="background:#FAF5EF;border-left:3px solid #D4B094;padding:16px 20px;border-radius:4px;">
        <p style="margin:0 0 8px 0;font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:#A86E58;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;">Your Selected Programme</p>
        ${programLines.map(p => `<p style="margin:4px 0;font-size:15px;color:#1A0507;font-family:Georgia,'Times New Roman',serif;font-weight:bold;">${p}</p>`).join('')}
      </div></td></tr>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>You are registered. Early bird pricing is yours.</title>
<style>
  @media only screen and (max-width:600px){
    .email-body{padding:0 !important;}
    .email-container{width:100% !important;border-radius:0 !important;}
    .email-header{padding:28px 24px 20px !important;}
    .section-pad{padding-left:24px !important;padding-right:24px !important;}
    .card-grid td{display:block !important;width:100% !important;padding:0 0 12px 0 !important;}
    h1{font-size:26px !important;}
  }
</style>
</head>
<body style="margin:0;padding:0;background:#FAF5EF;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;" class="email-body">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF5EF;">
  <tr><td align="center" style="padding:32px 16px;">

    <table role="presentation" class="email-container" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(26,5,7,0.08);" cellpadding="0" cellspacing="0">

      <!-- Header -->
      <tr><td class="email-header" style="background:#1A0507;padding:36px 40px 28px;text-align:center;">
        <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:4px;text-transform:uppercase;color:#D4B094;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;">VH Beyond the Horizons</p>
        <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:30px;font-weight:normal;color:#FAF5EF;line-height:1.25;">You are registered.</h1>
        <p style="margin:8px 0 0 0;font-family:Georgia,'Times New Roman',serif;font-size:18px;font-style:italic;color:#D4B094;">Early bird pricing is yours.</p>
      </td></tr>

      <!-- Greeting -->
      <tr><td class="section-pad" style="padding:32px 40px 8px;">
        <p style="margin:0 0 16px 0;font-size:17px;color:#1A0507;font-family:Georgia,'Times New Roman',serif;font-weight:bold;">Welcome. Really glad you are here.</p>
        <p style="margin:0 0 14px 0;font-size:15px;color:#4A3728;line-height:1.7;">We are still finalising some of the course details, so this is not the full picture yet. But you registered early, which means you are already locked in for early bird pricing. Within the next week, you will have the course start date and your discount amount in your inbox. No chasing required.</p>
      </td></tr>

      ${programBlock}

      <!-- Early Bird Card -->
      <tr><td class="section-pad" style="padding:0 40px 28px;">
        <div style="background:#1A0507;border-radius:8px;padding:28px;text-align:center;">
          <p style="margin:0 0 4px 0;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#D4B094;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;">Already Confirmed</p>
          <p style="margin:0 0 16px 0;font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:bold;color:#FAF5EF;line-height:1.2;">You are getting<br/>early bird pricing.</p>
          <p style="margin:0;font-size:13px;color:#D4B094;line-height:1.65;max-width:380px;margin-left:auto;margin-right:auto;">The exact start date and discount amount are being finalised. You will have both within the next week. Because you registered early, you get a better price than anyone who signs up later. That is already set.</p>
        </div>
      </td></tr>

      <!-- Explore -->
      <tr><td class="section-pad" style="padding:0 40px 28px;">
        <p style="margin:0 0 16px 0;font-size:14px;letter-spacing:2px;text-transform:uppercase;color:#760F13;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;font-weight:bold;">The site is live. Go explore.</p>
        <table role="presentation" class="card-grid" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="width:33%;padding-right:8px;vertical-align:top;">
              <a href="${BASE_URL}/eligibility-checker" style="display:block;background:#FAF5EF;border:1.5px solid #D4B094;border-radius:8px;padding:16px;text-decoration:none;text-align:center;">
                <p style="margin:0 0 6px 0;font-size:20px;">🎯</p>
                <p style="margin:0 0 6px 0;font-size:12px;font-weight:bold;color:#1A0507;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;">Check Eligibility</p>
                <p style="margin:0;font-size:11px;color:#A86E58;line-height:1.5;">If you want to know which universities you qualify for</p>
              </a>
            </td>
            <td style="width:33%;padding:0 4px;vertical-align:top;">
              <a href="${BASE_URL}/registration/games" style="display:block;background:#FAF5EF;border:1.5px solid #D4B094;border-radius:8px;padding:16px;text-decoration:none;text-align:center;">
                <p style="margin:0 0 6px 0;font-size:20px;">🎮</p>
                <p style="margin:0 0 6px 0;font-size:12px;font-weight:bold;color:#1A0507;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;">Practice for Free</p>
                <p style="margin:0;font-size:11px;color:#A86E58;line-height:1.5;">If you want to start practising right now, for free</p>
              </a>
            </td>
            <td style="width:33%;padding-left:8px;vertical-align:top;">
              <a href="${BASE_URL}/program" style="display:block;background:#FAF5EF;border:1.5px solid #D4B094;border-radius:8px;padding:16px;text-decoration:none;text-align:center;">
                <p style="margin:0 0 6px 0;font-size:20px;">📋</p>
                <p style="margin:0 0 6px 0;font-size:12px;font-weight:bold;color:#1A0507;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;">Course Details</p>
                <p style="margin:0;font-size:11px;color:#A86E58;line-height:1.5;">If you want to read up on what the course covers</p>
              </a>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- Closing -->
      <tr><td class="section-pad" style="padding:0 40px 32px;">
        <p style="margin:0 0 24px 0;font-size:15px;color:#4A3728;line-height:1.7;">You will hear from us within the week. If anything comes up before then, just reply to this email.</p>
        <div style="margin-top:8px;padding-top:20px;border-top:1px solid #D4B094;display:inline-block;">
          <p style="margin:0 0 2px 0;font-family:'Brush Script MT','Segoe Script','Apple Chancery',cursive;font-size:36px;color:#1A0507;line-height:1;letter-spacing:1px;">Ahnaf</p>
          <p style="margin:6px 0 0 0;font-size:10px;color:#A86E58;letter-spacing:2.5px;text-transform:uppercase;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;">VH Beyond the Horizons</p>
        </div>
      </td></tr>

      <!-- Footer -->
      <tr><td style="background:#1A0507;padding:20px 40px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#A86E58;line-height:1.6;">
          VH Beyond the Horizons &nbsp;|&nbsp;
          <a href="${BASE_URL}" style="color:#D4B094;text-decoration:none;">${BASE_URL.replace('https://', '').replace('http://', '')}</a>
        </p>
        <p style="margin:8px 0 0 0;font-size:10px;color:#4A2820;">This is a confirmation. No action needed from you right now.</p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;

  return html;
}

// ── Send via Resend API ───────────────────────────────────────────────────────
async function sendEmail(name, toEmail, programMode, selectedMocks, selectedFullCourses) {
  const html = buildEmail(name, programMode, selectedMocks, selectedFullCourses);

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:    'Ahnaf Ahad (VH) <ahnaf@vh-beyondthehorizons.org>',
      to:      toEmail,
      subject: "You're registered. Early bird pricing is yours.",
      html,
    }),
  });

  const json = await res.json();
  if (!res.ok || json.statusCode >= 400) {
    return { success: false, error: json };
  }
  return { success: true, id: json.id };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  const rows = await db.execute(
    `SELECT id, name, email, program_mode, selected_mocks, selected_full_courses, student_email_status
     FROM registrations WHERE id IN (${TARGET_IDS.join(',')}) ORDER BY id`
  );

  console.log(`Processing ${rows.rows.length} registration(s).\n`);

  for (const row of rows.rows) {
    const id     = row.id;
    const name   = row.name;
    const email  = row.email;
    const mode   = row.program_mode;
    const mocks  = row.selected_mocks  ? JSON.parse(row.selected_mocks)  : [];
    const full   = row.selected_full_courses ? JSON.parse(row.selected_full_courses) : [];
    const status = row.student_email_status;

    console.log(`#${id} ${name} <${email}>`);

    if (status === 'sent') {
      console.log(`  Already marked "sent". Skipping.\n`);
      continue;
    }

    const result = await sendEmail(name, email, mode, mocks, full);

    const newStatus = result.success ? 'sent' : 'failed';
    await db.execute({ sql: 'UPDATE registrations SET student_email_status = ? WHERE id = ?', args: [newStatus, id] });

    if (result.success) {
      console.log(`  Email sent (Resend ID: ${result.id}). DB => "sent".\n`);
    } else {
      console.log(`  FAILED. DB => "failed". Error:`, result.error, '\n');
    }
  }

  console.log('Done.');
  process.exit(0);
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
