import { Resend } from 'resend';

const API_KEY = 're_gEJfccMx_PvGhkJ5xDSYR23uyMMc7pR89';

async function testResendAPI() {
  console.log('🧪 Testing Resend API Key\n');
  console.log('API Key:', `${API_KEY.substring(0, 10)}...`);
  console.log('\n📧 Attempting to send test email...\n');

  const resend = new Resend(API_KEY);

  const ADMIN_EMAILS = [
    'ahnaf816@gmail.com',
    'hasanxsarower@gmail.com',
    'ahnafahad16@gmail.com'
  ];

  try {
    const results = await Promise.allSettled(
      ADMIN_EMAILS.map(adminEmail =>
        resend.emails.send({
          from: 'VH Registration Test <onboarding@resend.dev>',
          to: adminEmail,
          subject: 'Test Email - VH Registration System',
          html: `
            <!DOCTYPE html>
            <html>
              <head>
                <style>
                  body { font-family: Arial, sans-serif; padding: 20px; }
                  .container { max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 8px; }
                  .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
                  .content { background: white; padding: 20px; border-radius: 8px; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1>Test Email</h1>
                  </div>
                  <div class="content">
                    <h2>Resend API Key Test</h2>
                    <p>This is a test email to verify that the Resend API key is working correctly.</p>
                    <p><strong>Status:</strong> If you're reading this, the API key works! ✓</p>
                    <hr>
                    <p style="font-size: 12px; color: #666;">Sent from VH Website Registration System</p>
                  </div>
                </div>
              </body>
            </html>
          `,
          text: 'This is a test email to verify that the Resend API key is working correctly. If you are reading this, the API key works!'
        })
      )
    );

    // Analyze results
    const successful = results.filter(r => r.status === 'fulfilled');
    const failed = results.filter(r => r.status === 'rejected');

    console.log('📊 RESULTS:\n');
    console.log(`✅ Successful: ${successful.length}`);
    console.log(`❌ Failed: ${failed.length}`);
    console.log(`📫 Total: ${ADMIN_EMAILS.length}\n`);

    if (successful.length > 0) {
      console.log('✨ SUCCESS DETAILS:');
      successful.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          console.log(`   ${index + 1}. Email sent to ${ADMIN_EMAILS[index]}`);
          console.log(`      Email ID: ${result.value.data?.id || 'N/A'}`);
        }
      });
    }

    if (failed.length > 0) {
      console.log('\n❌ FAILURE DETAILS:');
      failed.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.log(`   ${index + 1}. Failed for ${ADMIN_EMAILS[index]}`);
          console.log(`      Error: ${result.reason}`);
        }
      });
    }

    console.log('\n📬 Check your inbox at:');
    ADMIN_EMAILS.forEach(email => console.log(`   - ${email}`));

    if (successful.length === ADMIN_EMAILS.length) {
      console.log('\n🎉 All emails sent successfully! The Resend API key is working perfectly.');
      process.exit(0);
    } else if (successful.length > 0) {
      console.log('\n⚠️  Some emails sent, but some failed. Check the errors above.');
      process.exit(1);
    } else {
      console.log('\n💥 All emails failed to send. The API key may be invalid or have issues.');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n💥 CRITICAL ERROR:');
    console.error(error);
    process.exit(1);
  }
}

testResendAPI();
