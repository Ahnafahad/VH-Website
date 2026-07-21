/**
 * One-off blast: DU FBS full-course registration has moved from "interest form"
 * to an actual registration with real fees. Notify everyone who previously
 * submitted a DU FBS full-course registration (interest) that their seat and
 * fees are confirmed, pointing them to WhatsApp for next steps. Dedupes by
 * email (a few people submitted the form twice).
 *
 * Dry run (default): prints recipients + previews the email, sends nothing.
 * Real send:          node scripts/send-dufbs-payment-email.mjs --apply
 */

import { readFileSync } from 'fs';
import { createClient } from '@libsql/client';

const APPLY = process.argv.includes('--apply');

const envLines = readFileSync('.env.local', 'utf8').split('\n');
const env = {};
for (const line of envLines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq < 0) continue;
  env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
}

const RESEND_API_KEY     = process.env.RESEND_API_KEY ?? env.RESEND_API_KEY;
const TURSO_DATABASE_URL = env.TURSO_DATABASE_URL;
const TURSO_AUTH_TOKEN   = env.TURSO_AUTH_TOKEN;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // local TLS quirk, matches other scripts

const db = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN });

function buildEmail(firstName) {
  const name = firstName.charAt(0).toUpperCase() + firstName.slice(1);
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#FAF5EF;font-family:-apple-system,Helvetica,Arial,sans-serif;color:#1A0507;">
<div style="max-width:600px;margin:0 auto;background:#FAF5EF;">

  <div style="background:#1A0507;padding:28px 32px;">
    <p style="margin:0 0 4px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#D4B094;">VH Beyond the Horizons</p>
    <h1 style="margin:0;font-family:Georgia,serif;font-size:24px;font-weight:400;color:#FAF5EF;">Your DU FBS seat.</h1>
  </div>

  <div style="padding:32px;">
    <p style="margin:0 0 20px;font-size:15px;color:#1A0507;line-height:1.75;">Hi ${name},</p>
    <p style="margin:0 0 24px;font-size:15px;color:#1A0507;line-height:1.75;">Thank you for registering your interest in DU FBS. We really appreciate it. The DU FBS batch is now actually starting.</p>

    <p style="margin:0 0 10px;font-size:13px;font-weight:500;letter-spacing:1px;text-transform:uppercase;color:#760F13;">Fees</p>
    <div style="border:1px solid #e8d5c4;border-radius:6px;overflow:hidden;margin:0 0 28px;background:#fff;">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid #f0e8dc;">
        <div>
          <div style="font-size:13px;font-weight:500;color:#1A0507;">Admission fee</div>
          <div style="font-size:11px;color:#8a6a5a;margin-top:2px;">One-time, due at registration</div>
        </div>
        <div style="font-family:Georgia,serif;font-size:18px;font-weight:600;color:#1A0507;white-space:nowrap;">1,500 <span style="font-size:11px;font-weight:400;color:#8a6a5a;">BDT</span></div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;">
        <div>
          <div style="font-size:13px;font-weight:500;color:#1A0507;">Tuition</div>
          <div style="font-size:11px;color:#8a6a5a;margin-top:2px;">Per month</div>
        </div>
        <div style="font-family:Georgia,serif;font-size:18px;font-weight:600;color:#1A0507;white-space:nowrap;">3,500 <span style="font-size:11px;font-weight:400;color:#8a6a5a;">BDT</span></div>
      </div>
    </div>

    <div style="background:#1A0507;border-radius:6px;padding:20px 24px;margin:0 0 28px;text-align:center;">
      <p style="margin:0 0 14px;font-size:14px;color:#FAF5EF;line-height:1.6;">Message us on WhatsApp to confirm your seat.</p>
      <a href="https://wa.me/8801915424939" style="display:inline-block;background:#FAF5EF;color:#1A0507;padding:10px 22px;border-radius:24px;text-decoration:none;font-size:13px;font-weight:600;">Message on WhatsApp</a>
      <p style="margin:12px 0 0;font-size:12px;color:#D4B094;">+880 1915 424939</p>
    </div>

    <p style="margin:0 0 20px;font-size:15px;color:#1A0507;line-height:1.75;">Questions before then? Just reply to this email or message the number above.</p>
    <p style="margin:0;font-size:15px;color:#1A0507;line-height:1.75;">See you soon,<br><span style="font-family:'Dancing Script',cursive;font-size:28px;color:#1A0507;line-height:2;">Ahnaf</span><br><span style="font-size:13px;color:#8a6a5a;">VH Beyond the Horizons</span></p>
  </div>

  <div style="background:#1A0507;padding:18px 32px;text-align:center;">
    <p style="margin:0;font-size:11px;color:#8a6a5a;letter-spacing:1px;">vh-beyondthehorizons.org</p>
  </div>

</div>
</body>
</html>`;
}

async function sendEmail(name, toEmail) {
  const firstName = name.trim().split(/\s+/)[0] || 'there';
  const html = buildEmail(firstName);

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:    'Ahnaf <ahnaf@vh-beyondthehorizons.org>',
      to:      toEmail,
      subject: 'Your DU FBS seat',
      html,
    }),
  });

  const json = await res.json();
  if (!res.ok) return { success: false, error: json };
  return { success: true, id: json.id };
}

async function run() {
  const rows = await db.execute(
    `SELECT id, name, email, selected_full_courses FROM registrations WHERE program_mode = 'full'`
  );

  const seen = new Set();
  const recipients = [];
  for (const r of rows.rows) {
    let full = [];
    try { full = r.selected_full_courses ? JSON.parse(r.selected_full_courses) : []; } catch { /* skip malformed */ }
    if (!full.includes('du-fbs-full')) continue;
    const email = (r.email || '').trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    recipients.push({ id: r.id, name: r.name, email: r.email });
  }

  console.log(`${recipients.length} unique DU FBS registrants found.\n`);
  for (const r of recipients) console.log(`  #${r.id} ${r.name} <${r.email}>`);

  if (!APPLY) {
    console.log('\nDry run only — no emails sent. Re-run with --apply to send.');
    process.exit(0);
  }

  let sent = 0, failed = 0;
  for (const r of recipients) {
    const result = await sendEmail(r.name, r.email);
    if (result.success) {
      console.log(`Sent to ${r.email} (Resend ID ${result.id})`);
      sent++;
    } else {
      console.error(`FAILED for ${r.email}:`, result.error);
      failed++;
    }
    await new Promise(resolve => setTimeout(resolve, 400));
  }
  console.log(`\nDone. Sent: ${sent}, Failed: ${failed}, Total: ${recipients.length}`);
  process.exit(0);
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
