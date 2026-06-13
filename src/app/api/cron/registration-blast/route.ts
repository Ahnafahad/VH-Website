/**
 * GET /api/cron/registration-blast
 *
 * One-shot cron: fires at 4am UTC on June 14, 2026 (10am Bangladesh time).
 * Sends registration confirmation + payment details email to all registered students.
 *
 * Protected by CRON_SECRET header.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@libsql/client';
import { Resend } from 'resend';

const CRON_SECRET = process.env.CRON_SECRET;

function buildEmailHtml(firstName: string): string {
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
    <h1 style="margin:0;font-family:Georgia,serif;font-size:24px;font-weight:400;color:#FAF5EF;">Your spot is reserved. Here is how to secure it.</h1>
  </div>

  <div style="padding:32px;">
    <p style="margin:0 0 20px;font-size:15px;color:#1A0507;line-height:1.75;">Hi ${name},</p>
    <p style="margin:0 0 24px;font-size:15px;color:#1A0507;line-height:1.75;">Thank you for registering for the IBA and BUP Admissions Programme (Batch 2026-27). Your spot is reserved. To confirm it, complete your first payment in person at our premises.</p>

    <div style="background:#1A0507;border-radius:6px;padding:20px 24px;margin:0 0 24px;">
      <p style="margin:0 0 6px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#D4B094;">Early bird offer</p>
      <p style="margin:0 0 8px;font-family:Georgia,serif;font-size:22px;color:#FAF5EF;">Pay before <span style="color:#D4B094;">20th June</span> and save 30%</p>
      <p style="margin:0 0 4px;font-size:14px;color:#D4B094;line-height:1.6;">First installment: <strong style="color:#FAF5EF;">7,000 BDT</strong> <span style="color:#5a3a2a;font-size:12px;text-decoration:line-through;">10,000 BDT</span></p>
      <p style="margin:6px 0 0;font-size:13px;color:#D4B094;line-height:1.6;">+ Complimentary copy of <em style="color:#FAF5EF;">The Early Edge</em> <span style="color:#7a5a4a;font-size:12px;">— Introductory Book for IBA</span></p>
    </div>

    <p style="margin:0 0 6px;font-size:13px;font-weight:500;letter-spacing:1px;text-transform:uppercase;color:#760F13;">Course fees</p>
    <p style="margin:0 0 14px;font-size:13px;color:#8a6a5a;font-style:italic;">Two installments. That is all. No further payments ever.</p>

    <div style="border:1px solid #e8d5c4;border-radius:6px;overflow:hidden;margin:0 0 10px;">
      <div style="background:#1A0507;padding:10px 16px;">
        <span style="font-family:Georgia,serif;font-size:15px;color:#FAF5EF;">Offline</span>
        <span style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#D4B094;border:0.4pt solid #D4B094;padding:2px 6px;border-radius:2px;margin-left:10px;">In-Person + Hybrid</span>
      </div>
      <div style="background:#fff;padding:0 16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #f0e8dc;">
          <div>
            <div style="font-size:13px;font-weight:500;color:#1A0507;">1st Installment</div>
            <div style="font-size:11px;color:#8a6a5a;margin-top:2px;">Due at registration &nbsp;|&nbsp; <span style="color:#760F13;font-weight:600;">Early bird: 7,000 BDT</span></div>
          </div>
          <div style="font-family:Georgia,serif;font-size:18px;font-weight:600;color:#1A0507;white-space:nowrap;">10,000 <span style="font-size:11px;font-weight:400;color:#8a6a5a;">BDT</span></div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;">
          <div>
            <div style="font-size:13px;font-weight:500;color:#1A0507;">2nd Installment</div>
            <div style="font-size:11px;color:#8a6a5a;margin-top:2px;">Due at start of 2nd month</div>
          </div>
          <div style="font-family:Georgia,serif;font-size:18px;font-weight:600;color:#1A0507;white-space:nowrap;">8,500 <span style="font-size:11px;font-weight:400;color:#8a6a5a;">BDT</span></div>
        </div>
      </div>
    </div>

    <div style="border:1px solid #e8d5c4;border-radius:6px;overflow:hidden;margin:0 0 24px;">
      <div style="background:#1A0507;padding:10px 16px;">
        <span style="font-family:Georgia,serif;font-size:15px;color:#FAF5EF;">Online</span>
        <span style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#D4B094;border:0.4pt solid #D4B094;padding:2px 6px;border-radius:2px;margin-left:10px;">Remote</span>
      </div>
      <div style="background:#fff;padding:0 16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #f0e8dc;">
          <div>
            <div style="font-size:13px;font-weight:500;color:#1A0507;">1st Installment</div>
            <div style="font-size:11px;color:#8a6a5a;margin-top:2px;">Due at registration &nbsp;|&nbsp; <span style="color:#760F13;font-weight:600;">Early bird: 7,000 BDT</span></div>
          </div>
          <div style="font-family:Georgia,serif;font-size:18px;font-weight:600;color:#1A0507;white-space:nowrap;">10,000 <span style="font-size:11px;font-weight:400;color:#8a6a5a;">BDT</span></div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;">
          <div>
            <div style="font-size:13px;font-weight:500;color:#1A0507;">2nd Installment</div>
            <div style="font-size:11px;color:#8a6a5a;margin-top:2px;">Due at start of 2nd month</div>
          </div>
          <div style="font-family:Georgia,serif;font-size:18px;font-weight:600;color:#1A0507;white-space:nowrap;">5,000 <span style="font-size:11px;font-weight:400;color:#8a6a5a;">BDT</span></div>
        </div>
      </div>
    </div>

    <div style="background:#fff;border:1px solid #e8d5c4;border-radius:6px;padding:16px 20px;margin:0 0 24px;">
      <p style="margin:0 0 8px;font-size:13px;font-weight:500;color:#760F13;">Where to pay</p>
      <p style="margin:0 0 6px;font-size:14px;color:#1A0507;line-height:1.7;">Walk in with this email or your registration confirmation and our team will receive you.</p>
      <p style="margin:0 0 2px;font-size:13px;color:#1A0507;font-weight:500;">House 31/A, Road 6, Dhanmondi R/A, Dhaka 1205</p>
      <p style="margin:4px 0 0;font-size:13px;color:#8a6a5a;">Questions? <a href="tel:+8801835200626" style="color:#760F13;text-decoration:none;">+880 1835 200 626</a> (WhatsApp or call)</p>
    </div>

    <div style="background:#f0ece6;border-radius:6px;padding:18px 20px;margin:0 0 28px;">
      <p style="margin:0 0 12px;font-size:14px;color:#1A0507;line-height:1.7;">If you have already paid, you have access to the entire system right now. Start exploring:</p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="48%" style="padding-right:8px;">
          <a href="https://vh-beyondthehorizons.org/vocab/home" style="display:block;background:#fff;border:1px solid #e8d5c4;border-radius:5px;padding:10px 14px;text-decoration:none;">
            <p style="margin:0 0 2px;font-size:13px;font-weight:500;color:#760F13;">LexiCore</p>
            <p style="margin:0;font-size:12px;color:#8a6a5a;">Vocabulary game</p>
          </a>
        </td>
        <td width="48%" style="padding-left:8px;">
          <a href="https://vh-beyondthehorizons.org/games/mental-math" style="display:block;background:#fff;border:1px solid #e8d5c4;border-radius:5px;padding:10px 14px;text-decoration:none;">
            <p style="margin:0 0 2px;font-size:13px;font-weight:500;color:#760F13;">Mental Math</p>
            <p style="margin:0;font-size:12px;color:#8a6a5a;">Speed arithmetic</p>
          </a>
        </td>
      </tr></table>
    </div>

    <p style="margin:0 0 20px;font-size:15px;color:#1A0507;line-height:1.75;">If you have any questions before coming in, just reply to this email.</p>
    <p style="margin:0;font-size:15px;color:#1A0507;line-height:1.75;">See you soon,<br><span style="font-family:'Dancing Script',cursive;font-size:28px;color:#1A0507;line-height:2;">Ahnaf</span><br><span style="font-size:13px;color:#8a6a5a;">VH Beyond the Horizons</span></p>
  </div>

  <div style="background:#1A0507;padding:18px 32px;text-align:center;">
    <p style="margin:0 0 3px;font-size:11px;color:#8a6a5a;letter-spacing:1px;">vh-beyondthehorizons.org</p>
    <p style="margin:0;font-size:11px;color:#5a3a2a;">House 31/A, Road 6, Dhanmondi R/A, Dhaka 1205 &nbsp;·&nbsp; +880 1835 200 626</p>
  </div>

</div>
</body>
</html>`;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fixEmail(email: string): string {
  // Fix known malformed email: @mehkatarannum@gmail.com → mehkatarannum@gmail.com
  if (email.startsWith('@') && email.indexOf('@', 1) !== -1) {
    return email.slice(1);
  }
  return email;
}

export async function GET(req: NextRequest) {
  // Validate cron secret
  if (!CRON_SECRET) {
    console.error('[registration-blast] CRON_SECRET is not configured');
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // One-shot guard: only run on 2026-06-14 (UTC)
  const now = new Date();
  const utcDate = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
  if (utcDate !== '2026-06-14') {
    console.log(`[registration-blast] Skipping — today is ${utcDate}, not 2026-06-14`);
    return NextResponse.json({ skipped: true, reason: `Not the target date (${utcDate})` });
  }

  try {
    // Connect to Turso
    const tursoUrl = process.env.TURSO_DATABASE_URL;
    const tursoToken = process.env.TURSO_AUTH_TOKEN;
    if (!tursoUrl || !tursoToken) {
      console.error('[registration-blast] Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN');
      return NextResponse.json({ error: 'DB not configured' }, { status: 500 });
    }

    const client = createClient({ url: tursoUrl, authToken: tursoToken });

    // Query registrations
    const result = await client.execute(
      `SELECT id, name, email FROM registrations WHERE status != 'cancelled' AND email LIKE '%@%' AND email != 'gfgf@gmail.com'`
    );

    type Recipient = { id: number | string; name: string; email: string };

    const dbRecipients: Recipient[] = result.rows.map((row) => ({
      id: row[0] as number | string,
      name: (row[1] as string) || '',
      email: fixEmail((row[2] as string) || ''),
    }));

    // Add hardcoded extra recipient
    const extraRecipient: Recipient = { id: 'extra-ahnaf', name: 'Ahnaf', email: 'ahnaf816@gmail.com' };
    const allRecipients = [...dbRecipients, extraRecipient];

    console.log(`[registration-blast] Found ${dbRecipients.length} DB recipients + 1 extra = ${allRecipients.length} total`);

    // Set up Resend
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      console.error('[registration-blast] Missing RESEND_API_KEY');
      return NextResponse.json({ error: 'Email not configured' }, { status: 500 });
    }
    const resend = new Resend(resendKey);

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const recipient of allRecipients) {
      const firstName = (recipient.name.trim().split(/\s+/)[0] || 'there');
      try {
        await resend.emails.send({
          from: 'Ahnaf <ahnaf@vh-beyondthehorizons.org>',
          to: recipient.email,
          subject: 'Your registration is confirmed — VH Beyond the Horizons',
          html: buildEmailHtml(firstName),
        });
        console.log(`[registration-blast] Sent to ${recipient.email} (${recipient.name})`);
        sent++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[registration-blast] Failed to send to ${recipient.email}: ${msg}`);
        errors.push(`${recipient.email}: ${msg}`);
        failed++;
      }

      // 400ms delay between sends to avoid rate limits
      await sleep(400);
    }

    console.log(`[registration-blast] Done. Sent: ${sent}, Failed: ${failed}, Total: ${allRecipients.length}`);

    return NextResponse.json({ sent, failed, total: allRecipients.length, errors });
  } catch (err) {
    console.error('[registration-blast]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
