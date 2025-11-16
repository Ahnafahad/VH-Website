import { Resend } from 'resend';

const API_KEY = 're_gEJfccMx_PvGhkJ5xDSYR23uyMMc7pR89';

async function checkResendStatus() {
  console.log('🔍 Checking Resend API Key Status\n');

  const resend = new Resend(API_KEY);

  try {
    // Try to get API key info
    console.log('📊 API Key Information:');
    console.log('   Key:', `${API_KEY.substring(0, 10)}...`);

    // Send a test and check headers
    const result = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: 'delivered@resend.dev', // Resend's test delivery address
      subject: 'API Key Test',
      html: '<p>Testing API key capabilities</p>'
    });

    console.log('\n📧 Test Email Response:');
    console.log('   Status:', result.data ? 'Accepted' : 'Failed');
    console.log('   Email ID:', result.data?.id || 'N/A');

    console.log('\n📊 Quota Information:');
    console.log('   Daily quota used:', result.headers['x-resend-daily-quota']);
    console.log('   Monthly quota used:', result.headers['x-resend-monthly-quota']);
    console.log('   Rate limit:', result.headers['ratelimit-limit']);
    console.log('   Rate remaining:', result.headers['ratelimit-remaining']);

    console.log('\n⚠️  IMPORTANT NOTES:');
    console.log('   1. Free tier Resend has limitations');
    console.log('   2. Emails from onboarding@resend.dev may not deliver to real addresses');
    console.log('   3. You may need to:');
    console.log('      - Verify your domain in Resend dashboard');
    console.log('      - Add recipient emails to "Allowed Recipients" in test mode');
    console.log('      - Upgrade to a paid plan for full functionality');
    console.log('\n   Visit: https://resend.com/settings');

    if (result.error) {
      console.log('\n❌ Error:', result.error);
    }

  } catch (error) {
    console.error('\n💥 Error:', error);
  }
}

checkResendStatus();
