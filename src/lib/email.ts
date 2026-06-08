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

    const MOCK_NAMES: Record<string, string> = {
      'du-iba':  'DU IBA',
      'bup-iba': 'BUP IBA',
      'du-fbs':  'DU FBS',
      'bup-fbs': 'BUP FBS',
      // legacy
      'fbs-detailed': 'FBS Detailed Guidance',
    };
    const FULL_NAMES: Record<string, string> = {
      'iba-combined': 'DU IBA & BUP IBA',
      'du-fbs-full':  'DU FBS',
      'bup-fbs-full': 'BUP FBS',
      // legacy
      'du-iba-full':      'DU IBA Complete',
      'bup-iba-fbs-full': 'BUP IBA & FBS Complete',
    };
    const pretty = (k: string, map: Record<string, string>) => map[k] ?? k;

    const programType = data.programMode === 'mocks' ? 'Mock Test Program' : 'Full Course';
    const programDetails = data.programMode === 'mocks'
      ? data.selectedMocks?.map(k => pretty(k, MOCK_NAMES)).join(', ') || 'None'
      : data.selectedFullCourses?.map(k => pretty(k, FULL_NAMES)).join(', ') || 'None';

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
          from: 'VH Beyond the Horizons <noreply@vh-beyondthehorizons.org>',
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
// Free Signup Notification (Path A)
// ---------------------------------------------------------------------------

interface FreeSignupEmailData {
  name: string;
  email: string;
  whatsapp: string;
}

/**
 * Notify admins when someone signs up for free games/resources access.
 */
export async function sendFreeSignupNotification(data: FreeSignupEmailData) {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not configured. Skipping free signup notification.');
      return { success: false, error: 'API key not configured' };
    }

    const subject = `New Free Signup: ${data.name}`;
    const waLink = `https://wa.me/${data.whatsapp.replace(/[^0-9]/g, '')}`;

    const htmlContent = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body style="margin:0;padding:0;background:#FAF5EF;font-family:-apple-system,Helvetica,Arial,sans-serif;color:#1A0507;">
    <div style="max-width:600px;margin:0 auto;background:#FAF5EF;">
      <div style="background:#1A0507;padding:28px 32px;">
        <p style="margin:0 0 4px 0;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#D4B094;">VH Beyond the Horizons</p>
        <h1 style="margin:0;font-family:Georgia,serif;font-size:26px;font-weight:400;color:#FAF5EF;">New Free Signup</h1>
      </div>

      <div style="padding:32px;">
        <p style="margin:0 0 20px 0;font-size:14px;color:#760F13;line-height:1.7;">
          Someone just signed up for free games and resources access. Their account has been auto-created and they can sign in with Google.
        </p>

        <div style="background:#FFFFFF;padding:20px;border-left:3px solid #D4B094;margin:24px 0;">
          <p style="margin:0 0 8px 0;"><strong style="color:#760F13;">Name:</strong> ${data.name}</p>
          <p style="margin:0 0 8px 0;"><strong style="color:#760F13;">Email:</strong> ${data.email}</p>
          <p style="margin:0;"><strong style="color:#760F13;">WhatsApp:</strong> <a href="${waLink}" style="color:#760F13;">${data.whatsapp}</a></p>
        </div>

        <p style="margin:24px 0 0 0;font-size:13px;color:#A86E58;line-height:1.7;">
          View the full list of free signups in the admin panel under Registrations → Free Signups.
        </p>
      </div>
    </div>
  </body>
</html>`;

    const textContent = `New Free Signup\n\nName: ${data.name}\nEmail: ${data.email}\nWhatsApp: ${data.whatsapp}\n\nAccount auto-created. User can sign in with Google.`;

    const results = await Promise.allSettled(
      ADMIN_EMAILS.map(adminEmail =>
        resend.emails.send({
          from: 'VH Beyond the Horizons <noreply@vh-beyondthehorizons.org>',
          to: adminEmail,
          subject,
          html: htmlContent,
          text: textContent,
        })
      )
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`Free signup notification sent: ${successful} successful, ${failed} failed`);

    return { success: successful > 0, successful, failed, total: ADMIN_EMAILS.length };
  } catch (error) {
    console.error('Error sending free signup notification:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ---------------------------------------------------------------------------
// Student Registration Confirmation
// ---------------------------------------------------------------------------

interface StudentConfirmationData {
  name: string;
  email: string;
  programMode: 'mocks' | 'full';
  selectedMocks?: string[];
  selectedFullCourses?: string[];
}

/**
 * Send a confirmation email to the student immediately after they register.
 * Course start date and early bird discount are read from environment variables
 * so you can update them without touching code:
 *   COURSE_START_DATE=e.g. "15 August 2025"
 *   EARLY_BIRD_DISCOUNT=e.g. "25% off — saves up to 2,500 BDT"
 */
export async function sendStudentConfirmationEmail(data: StudentConfirmationData) {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not configured. Skipping student confirmation email.');
      return { success: false, error: 'API key not configured' };
    }

    const MOCK_NAMES: Record<string, string> = {
      'du-iba':  'DU IBA Mock',
      'bup-iba': 'BUP IBA Mock',
      'du-fbs':  'DU FBS Mock',
      'bup-fbs': 'BUP FBS Mock',
    };
    const FULL_NAMES: Record<string, string> = {
      'iba-combined': 'DU IBA & BUP IBA Full Course',
      'du-fbs-full':  'DU FBS Full Course',
      'bup-fbs-full': 'BUP FBS Full Course',
    };
    const pretty = (k: string, map: Record<string, string>) => map[k] ?? k;

    const programLines = data.programMode === 'mocks'
      ? (data.selectedMocks ?? []).map(k => pretty(k, MOCK_NAMES))
      : (data.selectedFullCourses ?? []).map(k => pretty(k, FULL_NAMES));

    const programListHtml = programLines
      .map(p => `<li style="margin:0 0 4px 0;font-size:13px;color:#3D1A0E;">${p}</li>`)
      .join('');

    const courseStartDate = process.env.COURSE_START_DATE ?? "To be announced. We will notify you.";
    const earlyBirdDiscount = process.env.EARLY_BIRD_DISCOUNT ?? "Early bird discount. Details coming soon.";
    const baseUrl = (process.env.NEXTAUTH_URL ?? 'https://vh-beyondthehorizons.org').replace(/\/$/, '');

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You're registered — VH Beyond the Horizons</title>
  <style>
    @media only screen and (max-width: 600px) {
      .outer-pad { padding: 0 !important; }
      .content-pad { padding: 28px 20px !important; }
      .header-pad { padding: 28px 20px 24px 20px !important; }
      .footer-pad { padding: 20px !important; }
      .ebird-inner { padding: 20px !important; }
      .stats-row td { display: block !important; width: 100% !important; padding-right: 0 !important; }
      .stats-row td + td { border-top: 1px solid #EDE9E3 !important; }
      h1.headline { font-size: 26px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#EDE9E3;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;color:#1A0507;">

  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#EDE9E3;">
    <tr>
      <td align="center" class="outer-pad" style="padding:40px 16px;">

        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;">

          <!-- ═══ HEADER ═══ -->
          <tr>
            <td class="header-pad" style="background:#1A0507;padding:36px 40px 30px 40px;">
              <p style="margin:0 0 10px 0;font-size:10px;letter-spacing:4px;text-transform:uppercase;color:#D4B094;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;">VH Beyond the Horizons</p>
              <h1 class="headline" style="margin:0;font-family:Georgia,'Times New Roman',Times,serif;font-size:30px;font-weight:400;color:#FAF5EF;line-height:1.25;letter-spacing:0.2px;">Thank you for<br/>registering.</h1>
            </td>
          </tr>

          <!-- ═══ BODY ═══ -->
          <tr>
            <td class="content-pad" style="background:#FAF5EF;padding:36px 40px;">

              <!-- Greeting -->
              <p style="margin:0 0 16px 0;font-size:16px;color:#1A0507;line-height:1.75;">Hi ${data.name},</p>
              <p style="margin:0 0 14px 0;font-size:15px;color:#3D1A0E;line-height:1.85;">
                Welcome. Really glad you're here.
              </p>
              <p style="margin:0 0 14px 0;font-size:15px;color:#3D1A0E;line-height:1.85;">
                We're still finalising some of the course details, so this isn't the full picture yet. But you registered early, and that's exactly why we're writing now. It means you're already locked in for early bird pricing, and you'll hear everything from us before anyone else does.
              </p>
              <p style="margin:0 0 32px 0;font-size:15px;color:#3D1A0E;line-height:1.85;">
                Within the next week, you'll have the course start date and your discount in your inbox. No chasing required.
              </p>

              <!-- Divider -->
              <div style="height:1px;background:linear-gradient(to right,#D4B094,transparent);margin-bottom:32px;"></div>

              <!-- ── EARLY BIRD CALLOUT ── -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#FFFFFF;border-left:4px solid #D4B094;margin-bottom:32px;">
                <tr>
                  <td class="ebird-inner" style="padding:26px 28px;">

                    <p style="margin:0 0 4px 0;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#D4B094;">Already Confirmed</p>
                    <p style="margin:0 0 16px 0;font-family:Georgia,'Times New Roman',Times,serif;font-size:22px;font-weight:400;color:#760F13;line-height:1.3;">You are getting<br/>early bird pricing.</p>

                    <div style="border-top:1px solid #EDE9E3;padding-top:16px;">
                      <p style="margin:0 0 10px 0;font-size:14px;color:#3D1A0E;line-height:1.8;">
                        The exact start date and discount amount are being finalised. You will have both within the next week. Because you registered early, you get a better price than anyone who signs up later. That is already set.
                      </p>
                    </div>

                    ${programLines.length > 0 ? `
                    <div style="margin-top:16px;padding-top:16px;border-top:1px solid #EDE9E3;">
                      <p style="margin:0 0 8px 0;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#A86E58;">Your Selected Programme</p>
                      <ul style="margin:0;padding:0 0 0 16px;">
                        ${programListHtml}
                      </ul>
                    </div>` : ''}

                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <div style="height:1px;background:linear-gradient(to right,#D4B094,transparent);margin-bottom:32px;"></div>

              <!-- ── EXPLORE SECTION ── -->
              <p style="margin:0 0 5px 0;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#D4B094;">While You Wait</p>
              <p style="margin:0 0 14px 0;font-family:Georgia,'Times New Roman',Times,serif;font-size:22px;color:#1A0507;font-weight:400;line-height:1.3;">The site is live. Go explore.</p>
              <p style="margin:0 0 24px 0;font-size:14px;color:#3D1A0E;line-height:1.9;">
                We have already built quite a bit. Here is where to start, depending on where you are right now:
              </p>

              <!-- Card 1 — Eligibility Checker -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#FFFFFF;margin-bottom:10px;">
                <tr>
                  <td style="padding:20px 24px 20px 20px;border-left:3px solid #760F13;">
                    <p style="margin:0 0 8px 0;font-size:15px;font-family:Georgia,'Times New Roman',Times,serif;color:#1A0507;font-weight:400;">If you want to know which universities you qualify for</p>
                    <p style="margin:0 0 14px 0;font-size:13px;color:#6B4032;line-height:1.7;">Whether you are on the HSC track or doing A-Levels, put in your results and it will show you exactly where you stand: IBA DU, BUP, FBS, and more.</p>
                    <a href="${baseUrl}/eligibility-checker" style="display:inline-block;font-size:11px;color:#760F13;text-decoration:none;letter-spacing:2px;text-transform:uppercase;border-bottom:1px solid #D4B094;padding-bottom:2px;">Go to Eligibility Checker</a>
                  </td>
                </tr>
              </table>

              <!-- Card 2 — Free Games -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#FFFFFF;margin-bottom:10px;">
                <tr>
                  <td style="padding:20px 24px 20px 20px;border-left:3px solid #760F13;">
                    <p style="margin:0 0 8px 0;font-size:15px;font-family:Georgia,'Times New Roman',Times,serif;color:#1A0507;font-weight:400;">If you want to start practising right now, for free</p>
                    <p style="margin:0 0 14px 0;font-size:13px;color:#6B4032;line-height:1.7;">Vocab training, mental math, and an accounting game. All free. All built around what actually shows up in these exams.</p>
                    <a href="${baseUrl}/registration/games" style="display:inline-block;font-size:11px;color:#760F13;text-decoration:none;letter-spacing:2px;text-transform:uppercase;border-bottom:1px solid #D4B094;padding-bottom:2px;">Get Free Access</a>
                  </td>
                </tr>
              </table>

              <!-- Card 3 — Programme Details -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#FFFFFF;margin-bottom:32px;">
                <tr>
                  <td style="padding:20px 24px 20px 20px;border-left:3px solid #760F13;">
                    <p style="margin:0 0 8px 0;font-size:15px;font-family:Georgia,'Times New Roman',Times,serif;color:#1A0507;font-weight:400;">If you want to read up on what the course actually covers</p>
                    <p style="margin:0 0 14px 0;font-size:13px;color:#6B4032;line-height:1.7;">The programme page has the structure, what is included, and how it is different from everything else out there.</p>
                    <a href="${baseUrl}/program" style="display:inline-block;font-size:11px;color:#760F13;text-decoration:none;letter-spacing:2px;text-transform:uppercase;border-bottom:1px solid #D4B094;padding-bottom:2px;">View the Programme</a>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <div style="height:1px;background:linear-gradient(to right,#D4B094,transparent);margin-bottom:32px;"></div>

              <!-- Closing -->
              <p style="margin:0 0 14px 0;font-size:15px;color:#3D1A0E;line-height:1.85;">
                You will hear from us within the week. If anything comes up before then, just reply to this email.
              </p>
              <p style="margin:0 0 28px 0;font-size:15px;color:#3D1A0E;line-height:1.85;">
                Glad to have you.
              </p>
              <div style="margin-top:8px;padding-top:20px;border-top:1px solid #D4B094;display:inline-block;">
                <p style="margin:0 0 2px 0;font-family:'Brush Script MT','Segoe Script','Apple Chancery',cursive;font-size:36px;color:#1A0507;line-height:1;letter-spacing:1px;">Ahnaf</p>
                <p style="margin:6px 0 0 0;font-size:10px;color:#A86E58;letter-spacing:2.5px;text-transform:uppercase;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;">VH Beyond the Horizons</p>
              </div>

            </td>
          </tr>

          <!-- ═══ FOOTER ═══ -->
          <tr>
            <td class="footer-pad" style="background:#1A0507;padding:24px 40px;">
              <p style="margin:0 0 10px 0;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#D4B094;">VH Beyond the Horizons</p>
              <p style="margin:0;font-size:11px;color:rgba(250,245,239,0.45);line-height:1.75;">
                You're receiving this because you registered your interest at
                <a href="${baseUrl}" style="color:#D4B094;text-decoration:none;">${baseUrl.replace('https://', '').replace('http://', '')}</a>.
                This is a confirmation. No action needed from you right now.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;

    const textContent = `Thank you for registering | VH Beyond the Horizons

Hi ${data.name},

Welcome. Really glad you're here.

We're still finalising some of the course details, so this isn't the full picture yet. But you registered early, which means you're already locked in for early bird pricing. Within the next week, you will have the course start date and your discount amount in your inbox. No chasing required.

─────────────────────────────────────
ALREADY CONFIRMED: EARLY BIRD PRICING
─────────────────────────────────────
The exact start date and discount are being finalised. You will have both within the next week. Because you registered early, you get a better price than anyone who signs up later. That is already set.
${programLines.length > 0 ? `\nYour Selected Programme:\n${programLines.map(p => `  - ${p}`).join('\n')}` : ''}

─────────────────────────────────────
THE SITE IS LIVE. GO EXPLORE.
─────────────────────────────────────
If you want to know which universities you qualify for (HSC or A-Levels, both work):
${baseUrl}/eligibility-checker

If you want to start practising right now, for free:
${baseUrl}/registration/games

If you want to read up on what the course covers:
${baseUrl}/program

─────────────────────────────────────

You will hear from me within the week. If anything comes up before then, just reply to this email.

Ahnaf
VH Beyond the Horizons
${baseUrl}`.trim();

    const result = await resend.emails.send({
      from: 'Ahnaf Ahad (VH) <ahnaf@vh-beyondthehorizons.org>',
      to: data.email,
      replyTo: 'ahnaf@vh-beyondthehorizons.org',
      subject: `Registration confirmed — VH Beyond the Horizons`,
      html: htmlContent,
      text: textContent,
    });

    if (result.error) {
      console.error('sendStudentConfirmationEmail failed:', result.error);
      return { success: false, error: result.error };
    }

    console.log('Student confirmation email sent to:', data.email);
    return { success: true };
  } catch (error) {
    console.error('sendStudentConfirmationEmail error:', error);
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
          from: 'LexiCore <noreply@vh-beyondthehorizons.org>',
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
