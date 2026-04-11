import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Admin email addresses to notify
const ADMIN_EMAILS = [
  'ahnaf816@gmail.com',
  'hasanxsarower@gmail.com',
  'ahnafahad16@gmail.com'
];

interface RegistrationEmailData {
  name: string;
  email: string;
  phone: string;
  educationType: 'hsc' | 'alevels';
  programMode: 'mocks' | 'full';
  selectedMocks?: string[];
  selectedFullCourses?: string[];
  mockIntent?: 'trial' | 'full';
  pricing?: {
    subtotal: number;
    discount: number;
    finalPrice: number;
  };
  referral?: {
    name: string;
    institution: string;
    batch: string;
  };
}

/**
 * Send email notification to admins when someone registers
 */
export async function sendRegistrationNotification(data: RegistrationEmailData) {
  try {
    // Skip sending if no API key is configured
    if (!process.env.RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not configured. Skipping email notification.');
      return { success: false, error: 'API key not configured' };
    }

    const programType = data.programMode === 'mocks' ? 'Mock Test Program' : 'Full Course';
    const programDetails = data.programMode === 'mocks'
      ? data.selectedMocks?.join(', ') || 'None'
      : data.selectedFullCourses?.join(', ') || 'None';

    // Create email subject
    const subject = `New Registration: ${data.name} - ${programType}`;

    // Create email body
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
            .section { margin-bottom: 20px; }
            .label { font-weight: bold; color: #667eea; }
            .value { margin-left: 10px; }
            .highlight { background: white; padding: 15px; border-radius: 6px; margin: 10px 0; border-left: 4px solid #667eea; }
            .footer { margin-top: 20px; padding-top: 20px; border-top: 2px solid #eee; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">New Registration Received! 🎉</h1>
            </div>
            <div class="content">
              <div class="section">
                <h2 style="color: #667eea; margin-top: 0;">Student Information</h2>
                <div class="highlight">
                  <p><span class="label">Name:</span><span class="value">${data.name}</span></p>
                  <p><span class="label">Email:</span><span class="value">${data.email}</span></p>
                  <p><span class="label">Phone:</span><span class="value">${data.phone}</span></p>
                  <p><span class="label">Education Type:</span><span class="value">${data.educationType.toUpperCase()}</span></p>
                </div>
              </div>

              <div class="section">
                <h2 style="color: #667eea;">Program Details</h2>
                <div class="highlight">
                  <p><span class="label">Program Mode:</span><span class="value">${programType}</span></p>
                  <p><span class="label">Selected Programs:</span><span class="value">${programDetails}</span></p>
                  ${data.mockIntent ? `<p><span class="label">Mock Intent:</span><span class="value">${data.mockIntent === 'trial' ? 'Trial' : 'Full Program'}</span></p>` : ''}
                  ${data.pricing ? `
                    <p><span class="label">Pricing:</span></p>
                    <ul style="margin-left: 20px;">
                      <li>Subtotal: ${data.pricing.subtotal} BDT</li>
                      <li>Discount: ${data.pricing.discount} BDT</li>
                      <li><strong>Final Price: ${data.pricing.finalPrice} BDT</strong></li>
                    </ul>
                  ` : ''}
                </div>
              </div>

              ${data.referral ? `
                <div class="section">
                  <h2 style="color: #667eea;">Referral Information</h2>
                  <div class="highlight">
                    <p><span class="label">Referred By:</span><span class="value">${data.referral.name}</span></p>
                    <p><span class="label">Institution:</span><span class="value">${data.referral.institution}</span></p>
                    <p><span class="label">Batch:</span><span class="value">${data.referral.batch}</span></p>
                  </div>
                </div>
              ` : ''}

              <div class="footer">
                <p>This is an automated notification from VH Website Registration System.</p>
                <p>Please log in to the admin panel to view and manage registrations.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    // Plain text version
    const textContent = `
New Registration Received!

Student Information:
- Name: ${data.name}
- Email: ${data.email}
- Phone: ${data.phone}
- Education Type: ${data.educationType.toUpperCase()}

Program Details:
- Program Mode: ${programType}
- Selected Programs: ${programDetails}
${data.mockIntent ? `- Mock Intent: ${data.mockIntent === 'trial' ? 'Trial' : 'Full Program'}` : ''}
${data.pricing ? `
Pricing:
- Subtotal: ${data.pricing.subtotal} BDT
- Discount: ${data.pricing.discount} BDT
- Final Price: ${data.pricing.finalPrice} BDT
` : ''}
${data.referral ? `
Referral Information:
- Referred By: ${data.referral.name}
- Institution: ${data.referral.institution}
- Batch: ${data.referral.batch}
` : ''}

---
This is an automated notification from VH Website Registration System.
Please log in to the admin panel to view and manage registrations.
    `.trim();

    // Send email to all admin addresses
    const results = await Promise.allSettled(
      ADMIN_EMAILS.map(adminEmail =>
        resend.emails.send({
          from: 'VH Registration System <onboarding@resend.dev>', // Update this with your verified domain
          to: adminEmail,
          subject: subject,
          html: htmlContent,
          text: textContent,
        })
      )
    );

    // Check results
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`Registration notification sent: ${successful} successful, ${failed} failed`);

    if (failed > 0) {
      console.error('Some emails failed to send:',
        results.filter(r => r.status === 'rejected').map(r => (r as PromiseRejectedResult).reason)
      );
    }

    return {
      success: successful > 0,
      successful,
      failed,
      total: ADMIN_EMAILS.length
    };

  } catch (error) {
    console.error('Error sending registration notification:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ---------------------------------------------------------------------------
// LexiCore Email Templates
// ---------------------------------------------------------------------------

interface WeeklySummaryData {
  name: string;
  wordsReviewed: number;
  pointsEarned: number;
  leaderboardRank: number | null;
  streakDays: number;
  weekOf: string;
}

/**
 * Send a weekly summary email to a LexiCore user.
 */
export async function sendWeeklySummary(
  to: string,
  data: WeeklySummaryData
): Promise<{ success: number; failed: number; total: number }> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not configured. Skipping sendWeeklySummary.');
      return { success: 0, failed: 1, total: 1 };
    }

    const rankDisplay = data.leaderboardRank !== null ? `#${data.leaderboardRank}` : 'Unranked';

    const htmlContent = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LexiCore Weekly Report</title>
  </head>
  <body style="margin:0;padding:0;background:#0F0F0F;font-family:-apple-system,Helvetica,Arial,sans-serif;color:#E8E4DC;">
    <div style="max-width:600px;margin:0 auto;background:#0F0F0F;">

      <!-- Header -->
      <div style="background:#D62B38;padding:28px 32px;">
        <p style="margin:0 0 4px 0;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.7);">VH LexiCore</p>
        <h1 style="margin:0;font-family:Georgia,serif;font-size:26px;font-weight:400;color:#FFFFFF;letter-spacing:0.5px;">Weekly Report</h1>
        <p style="margin:8px 0 0 0;font-size:13px;color:rgba(255,255,255,0.8);">${data.weekOf}</p>
      </div>

      <!-- Greeting -->
      <div style="padding:32px 32px 0 32px;">
        <p style="margin:0;font-size:16px;color:#E8E4DC;">Hi ${data.name},</p>
        <p style="margin:12px 0 0 0;font-size:14px;color:#9E9A93;line-height:1.7;">Here is how your vocabulary study went this week.</p>
      </div>

      <!-- Stats Grid -->
      <div style="padding:28px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:8px;">
          <tr>
            <td width="50%" style="background:#1A1A1A;padding:20px;vertical-align:top;">
              <p style="margin:0 0 6px 0;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#9E9A93;">Words Reviewed</p>
              <p style="margin:0;font-family:Georgia,serif;font-size:36px;font-weight:400;color:#C9A84C;">${data.wordsReviewed}</p>
            </td>
            <td width="50%" style="background:#1A1A1A;padding:20px;vertical-align:top;">
              <p style="margin:0 0 6px 0;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#9E9A93;">Points Earned</p>
              <p style="margin:0;font-family:Georgia,serif;font-size:36px;font-weight:400;color:#C9A84C;">${data.pointsEarned}</p>
            </td>
          </tr>
          <tr>
            <td width="50%" style="background:#1A1A1A;padding:20px;vertical-align:top;">
              <p style="margin:0 0 6px 0;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#9E9A93;">Leaderboard Rank</p>
              <p style="margin:0;font-family:Georgia,serif;font-size:36px;font-weight:400;color:#C9A84C;">${rankDisplay}</p>
            </td>
            <td width="50%" style="background:#1A1A1A;padding:20px;vertical-align:top;">
              <p style="margin:0 0 6px 0;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#9E9A93;">Streak</p>
              <p style="margin:0;font-family:Georgia,serif;font-size:36px;font-weight:400;color:#C9A84C;">${data.streakDays} <span style="font-size:16px;color:#9E9A93;">days</span></p>
            </td>
          </tr>
        </table>
      </div>

      <!-- Divider -->
      <div style="padding:0 32px;">
        <div style="height:1px;background:#2A2A2A;"></div>
      </div>

      <!-- Footer -->
      <div style="padding:24px 32px 32px 32px;">
        <p style="margin:0;font-size:12px;color:#5A5750;line-height:1.7;">
          You are receiving this because you enabled weekly summaries.
          To unsubscribe, visit your LexiCore settings.
        </p>
      </div>

    </div>
  </body>
</html>`;

    const result = await resend.emails.send({
      from: 'LexiCore <onboarding@resend.dev>',
      to,
      subject: `Your LexiCore Week — ${data.weekOf}`,
      html: htmlContent,
    });

    if (result.error) {
      console.error('sendWeeklySummary failed:', result.error);
      return { success: 0, failed: 1, total: 1 };
    }

    return { success: 1, failed: 0, total: 1 };
  } catch (error) {
    console.error('sendWeeklySummary error:', error);
    return { success: 0, failed: 1, total: 1 };
  }
}

/**
 * Notify a LexiCore user that their streak has been lost.
 */
export async function sendStreakLost(
  to: string,
  data: { name: string; streakDays: number }
): Promise<{ success: number; failed: number; total: number }> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not configured. Skipping sendStreakLost.');
      return { success: 0, failed: 1, total: 1 };
    }

    const vocabUrl =
      (process.env.NEXTAUTH_URL ?? 'https://vh-website.vercel.app') + '/vocab';

    const htmlContent = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Your streak — LexiCore</title>
  </head>
  <body style="margin:0;padding:0;background:#0F0F0F;font-family:-apple-system,Helvetica,Arial,sans-serif;color:#E8E4DC;">
    <div style="max-width:600px;margin:0 auto;background:#0F0F0F;">

      <!-- Header -->
      <div style="background:#D62B38;padding:28px 32px;">
        <p style="margin:0 0 4px 0;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.7);">VH LexiCore</p>
        <h1 style="margin:0;font-family:Georgia,serif;font-size:26px;font-weight:400;color:#FFFFFF;letter-spacing:0.5px;">Your Streak</h1>
      </div>

      <!-- Body -->
      <div style="padding:36px 32px 0 32px;">
        <p style="margin:0;font-size:16px;color:#E8E4DC;">Hi ${data.name},</p>

        <!-- Streak callout -->
        <div style="margin:28px 0;padding:24px;background:#1A1A1A;">
          <p style="margin:0 0 8px 0;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#9E9A93;">Your streak</p>
          <p style="margin:0;font-family:Georgia,serif;font-size:48px;font-weight:400;color:#C9A84C;">${data.streakDays} <span style="font-size:20px;color:#9E9A93;">days</span></p>
          <p style="margin:12px 0 0 0;font-size:13px;color:#9E9A93;">has ended.</p>
        </div>

        <p style="margin:0 0 12px 0;font-size:15px;color:#E8E4DC;line-height:1.8;">
          It happens. What matters is getting back.
        </p>
        <p style="margin:0 0 32px 0;font-size:14px;color:#9E9A93;line-height:1.7;">
          Every expert was once a beginner who kept showing up. Your next streak starts with a single session today.
        </p>

        <!-- CTA -->
        <a href="${vocabUrl}"
           style="display:inline-block;background:#D62B38;color:#FFFFFF;text-decoration:none;padding:14px 32px;font-size:13px;letter-spacing:2px;text-transform:uppercase;font-family:-apple-system,Helvetica,Arial,sans-serif;">
          Get Back on Track
        </a>
      </div>

      <!-- Divider -->
      <div style="padding:36px 32px 0 32px;">
        <div style="height:1px;background:#2A2A2A;"></div>
      </div>

      <!-- Footer -->
      <div style="padding:24px 32px 32px 32px;">
        <p style="margin:0;font-size:12px;color:#5A5750;line-height:1.7;">
          You are receiving this because you enabled streak notifications.
          To unsubscribe, visit your LexiCore settings.
        </p>
      </div>

    </div>
  </body>
</html>`;

    const result = await resend.emails.send({
      from: 'LexiCore <onboarding@resend.dev>',
      to,
      subject: `Your ${data.streakDays}-day streak — LexiCore`,
      html: htmlContent,
    });

    if (result.error) {
      console.error('sendStreakLost failed:', result.error);
      return { success: 0, failed: 1, total: 1 };
    }

    return { success: 1, failed: 0, total: 1 };
  } catch (error) {
    console.error('sendStreakLost error:', error);
    return { success: 0, failed: 1, total: 1 };
  }
}

/**
 * Broadcast an admin announcement to a list of LexiCore users.
 */
export async function sendAdminAnnouncement(
  to: string[],
  data: { subject: string; body: string; adminName: string }
): Promise<{ success: number; failed: number; total: number }> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not configured. Skipping sendAdminAnnouncement.');
      return { success: 0, failed: to.length, total: to.length };
    }

    // Sanitize body: strip script, iframe and javascript: protocol (case-insensitive)
    const sanitizedBody = data.body
      .replace(/<script/gi, '&lt;script')
      .replace(/<\/script>/gi, '&lt;/script&gt;')
      .replace(/<iframe/gi, '&lt;iframe')
      .replace(/<\/iframe>/gi, '&lt;/iframe&gt;')
      .replace(/javascript:/gi, 'javascript&#58;');

    const htmlContent = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${data.subject}</title>
  </head>
  <body style="margin:0;padding:0;background:#0F0F0F;font-family:-apple-system,Helvetica,Arial,sans-serif;color:#E8E4DC;">
    <div style="max-width:600px;margin:0 auto;background:#0F0F0F;">

      <!-- Header -->
      <div style="background:#D62B38;padding:28px 32px;">
        <p style="margin:0 0 4px 0;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.7);">VH LexiCore — Announcement</p>
        <h1 style="margin:0;font-family:Georgia,serif;font-size:24px;font-weight:400;color:#FFFFFF;letter-spacing:0.5px;">${data.subject}</h1>
      </div>

      <!-- Body content -->
      <div style="padding:36px 32px;font-size:15px;line-height:1.8;color:#E8E4DC;">
        ${sanitizedBody}
      </div>

      <!-- Divider -->
      <div style="padding:0 32px;">
        <div style="height:1px;background:#2A2A2A;"></div>
      </div>

      <!-- Footer -->
      <div style="padding:24px 32px 32px 32px;">
        <p style="margin:0;font-size:12px;color:#5A5750;line-height:1.7;">
          Sent by ${data.adminName} via VH LexiCore Admin
        </p>
      </div>

    </div>
  </body>
</html>`;

    const results = await Promise.allSettled(
      to.map(recipient =>
        resend.emails.send({
          from: 'LexiCore <onboarding@resend.dev>',
          to: recipient,
          subject: `[VH LexiCore] ${data.subject}`,
          html: htmlContent,
        })
      )
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`sendAdminAnnouncement: ${successful} sent, ${failed} failed out of ${to.length}`);

    if (failed > 0) {
      console.error(
        'sendAdminAnnouncement — failed recipients:',
        results
          .filter(r => r.status === 'rejected')
          .map(r => (r as PromiseRejectedResult).reason)
      );
    }

    return { success: successful, failed, total: to.length };
  } catch (error) {
    console.error('sendAdminAnnouncement error:', error);
    return { success: 0, failed: to.length, total: to.length };
  }
}
