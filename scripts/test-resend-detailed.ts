import { Resend } from 'resend';

const API_KEY = 're_gEJfccMx_PvGhkJ5xDSYR23uyMMc7pR89';

async function testResendDetailed() {
  console.log('🧪 Testing Resend API Key with Detailed Logging\n');

  const resend = new Resend(API_KEY);

  try {
    console.log('📧 Sending test email to ahnaf816@gmail.com...\n');

    const result = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: 'ahnaf816@gmail.com',
      subject: 'Test Email - VH Registration System',
      html: '<h1>Test Email</h1><p>This is a test email from Resend API.</p>',
      text: 'This is a test email from Resend API.'
    });

    console.log('📊 Full API Response:');
    console.log(JSON.stringify(result, null, 2));

    if (result.data) {
      console.log('\n✅ Email accepted by Resend!');
      console.log('   Email ID:', result.data.id);
      console.log('\n⚠️  NOTE: Emails from onboarding@resend.dev may go to spam or may only work in test mode.');
      console.log('   Check your spam folder or configure a verified domain in Resend.');
    }

    if (result.error) {
      console.log('\n❌ Error from Resend:');
      console.log(JSON.stringify(result.error, null, 2));
    }

  } catch (error) {
    console.error('\n💥 Error:', error);
  }
}

testResendDetailed();
