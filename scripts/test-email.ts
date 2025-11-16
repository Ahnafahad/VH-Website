import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local file
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

import { sendRegistrationNotification } from '../src/lib/email';

async function testEmail() {
  console.log('🧪 Testing Resend Email Functionality\n');
  console.log('API Key configured:', process.env.RESEND_API_KEY ? 'Yes ✓' : 'No ✗');
  console.log('API Key value:', process.env.RESEND_API_KEY ? `${process.env.RESEND_API_KEY.substring(0, 10)}...` : 'Not set');
  console.log('\n📧 Sending test registration notification...\n');

  const testData = {
    name: 'Test Student',
    email: 'test@example.com',
    phone: '+8801234567890',
    educationType: 'hsc' as const,
    programMode: 'mocks' as const,
    selectedMocks: ['IBA Mock Test 1', 'IBA Mock Test 2'],
    mockIntent: 'trial' as const,
    pricing: {
      subtotal: 5000,
      discount: 500,
      finalPrice: 4500
    },
    referral: {
      name: 'John Doe',
      institution: 'Dhaka College',
      batch: '2024'
    }
  };

  try {
    const result = await sendRegistrationNotification(testData);

    console.log('📊 Result:', result);

    if (result.success) {
      console.log('\n✅ SUCCESS! Email sent successfully!');
      console.log(`   - ${result.successful} emails sent`);
      console.log(`   - ${result.failed} failed`);
      console.log(`   - Total recipients: ${result.total}`);
      console.log('\n📬 Check the admin email addresses for the test email:');
      console.log('   - ahnaf816@gmail.com');
      console.log('   - hasanxsarower@gmail.com');
      console.log('   - ahnafahad16@gmail.com');
    } else {
      console.log('\n❌ FAILED! Error:', result.error);
    }
  } catch (error) {
    console.error('\n💥 ERROR:', error instanceof Error ? error.message : 'Unknown error');
    if (error instanceof Error && error.stack) {
      console.error('Stack:', error.stack);
    }
  }
}

testEmail().catch(console.error);
