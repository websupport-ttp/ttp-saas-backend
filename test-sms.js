// Test SMS Service
// Run with: node test-sms.js from backend directory

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { sendSMS, validateSMSConfiguration, getProviderForCountry } = require('./v1/utils/smsService');

async function testSMSService() {
  console.log('\n🔍 Testing SMS Service Configuration...\n');
  
  // Check configuration
  const config = validateSMSConfiguration();
  console.log('Configuration Status:');
  console.log('  Valid:', config.valid ? '✅' : '❌');
  console.log('  Providers:', config.providers.join(', '));
  console.log('  Message:', config.message);
  console.log('\nProvider Details:');
  console.log('  Termii:', config.details.termii.configured ? '✅ Configured' : '❌ Not configured');
  console.log('  Telnyx:', config.details.telnyx.configured ? '✅ Configured' : '❌ Not configured');
  console.log('  Twilio:', config.details.twilio.configured ? '✅ Configured' : '❌ Not configured');
  
  // Test phone numbers
  const testNumbers = [
    '+2348012345678',  // Nigerian
    '+14155551234',    // US
    '08012345678',     // Nigerian local format
  ];
  
  console.log('\n📱 Provider Routing Test:\n');
  testNumbers.forEach(number => {
    const provider = getProviderForCountry(number);
    console.log(`  ${number} → ${provider}`);
  });
  
  // Ask for confirmation before sending real SMS
  console.log('\n⚠️  WARNING: The next step will send a real SMS and may incur charges.');
  console.log('To test SMS sending, uncomment the code below and add your phone number.\n');
  
  // Uncomment to test actual SMS sending
  /*
  const testPhoneNumber = '+2348012345678'; // Replace with your number
  const testMessage = 'Test SMS from The Travel Place. Your OTP is: 123456';
  
  try {
    console.log(`\n📤 Sending test SMS to ${testPhoneNumber}...\n`);
    const result = await sendSMS(testPhoneNumber, testMessage);
    console.log('✅ SMS sent successfully!');
    console.log('  Provider:', result.provider);
    console.log('  Message ID:', result.messageId || result.messageSid);
    console.log('  Status:', result.status);
    console.log('  Cost:', result.cost);
  } catch (error) {
    console.error('❌ SMS sending failed:', error.message);
  }
  */
}

// Run the test
testSMSService().catch(console.error);
