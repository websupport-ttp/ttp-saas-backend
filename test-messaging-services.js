// test-messaging-services.js
// Quick test script to verify SMS and WhatsApp services are working

const { sendSMS, validateTwilioConfiguration } = require('./v1/utils/smsService');
const { sendWhatsAppMessage, whatsappService } = require('./v1/utils/whatsappService');

async function testMessagingServices() {
  console.log('🧪 Testing Messaging Services Configuration...\n');

  // Test Twilio SMS Configuration
  console.log('📱 Testing Twilio SMS Configuration:');
  const twilioConfig = validateTwilioConfiguration();
  console.log(`   Status: ${twilioConfig.valid ? '✅ Valid' : '❌ Invalid'}`);
  console.log(`   Message: ${twilioConfig.message}`);
  if (!twilioConfig.valid) {
    console.log(`   Missing: ${twilioConfig.missing.join(', ')}`);
  }
  console.log();

  // Test WhatsApp Configuration
  console.log('💬 Testing WhatsApp Business API Configuration:');
  const whatsappConfig = whatsappService.validateConfiguration();
  console.log(`   Status: ${whatsappConfig.valid ? '✅ Valid' : '❌ Invalid'}`);
  console.log(`   Message: ${whatsappConfig.message}`);
  if (!whatsappConfig.valid) {
    console.log(`   Missing: ${whatsappConfig.missing.join(', ')}`);
  }
  console.log();

  // Test actual message sending (only if configurations are valid)
  const testPhoneNumber = process.env.TEST_PHONE_NUMBER;
  
  if (!testPhoneNumber) {
    console.log('⚠️  Set TEST_PHONE_NUMBER environment variable to test actual message sending');
    console.log('   Example: TEST_PHONE_NUMBER=1234567890 node test-messaging-services.js');
    return;
  }

  console.log(`📞 Testing with phone number: ${testPhoneNumber}\n`);

  // Test SMS
  if (twilioConfig.valid) {
    try {
      console.log('📱 Testing SMS sending...');
      await sendSMS(testPhoneNumber, 'Test SMS from The Travel Place - SMS service is working!');
      console.log('   ✅ SMS sent successfully');
    } catch (error) {
      console.log(`   ❌ SMS failed: ${error.message}`);
    }
  } else {
    console.log('   ⏭️  Skipping SMS test (configuration invalid)');
  }
  console.log();

  // Test WhatsApp
  if (whatsappConfig.valid) {
    try {
      console.log('💬 Testing WhatsApp sending...');
      await sendWhatsAppMessage(testPhoneNumber, 'Test WhatsApp message from The Travel Place - WhatsApp service is working!');
      console.log('   ✅ WhatsApp message sent successfully');
    } catch (error) {
      console.log(`   ❌ WhatsApp failed: ${error.message}`);
    }
  } else {
    console.log('   ⏭️  Skipping WhatsApp test (configuration invalid)');
  }
  console.log();

  console.log('🎉 Testing completed!');
  console.log('\n📋 Next Steps:');
  console.log('   1. Fix any configuration issues shown above');
  console.log('   2. Set TEST_PHONE_NUMBER to test actual message sending');
  console.log('   3. Check the setup guides in docs/ folder for detailed instructions');
}

// Handle environment loading
require('dotenv').config();

// Run the test
testMessagingServices().catch(error => {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
});