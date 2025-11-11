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
