// Test script for Termii OTP API
// Usage: node test-termii-otp.js <phone_number>

require('dotenv').config();
const { sendOTPViaTermii, verifyOTPViaTermii } = require('./v1/utils/smsService');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function testTermiiOTP() {
  try {
    // Get phone number from command line or prompt
    const phoneNumber = process.argv[2] || await new Promise(resolve => {
      rl.question('Enter phone number (e.g., +2347065250817): ', resolve);
    });

    console.log('\n🚀 Testing Termii OTP API\n');
    console.log('═'.repeat(60));
    console.log(`Phone Number: ${phoneNumber}`);
    console.log(`API Key: ${process.env.TERMII_API_KEY?.substring(0, 10)}...`);
    console.log(`Sender ID: ${process.env.TERMII_SENDER_ID || 'TravelPlace'}`);
    console.log('═'.repeat(60));
    console.log('');

    // Step 1: Send OTP
    console.log('📤 Step 1: Sending OTP...\n');
    
    const otpResult = await sendOTPViaTermii(phoneNumber, {
      pinLength: 6,
      pinType: 'NUMERIC',
      pinAttempts: 3,
      pinTimeToLive: 5,
      messageText: 'Your TravelPlace verification code is < 123456 >. Valid for 5 minutes.'
    });

    if (!otpResult.success) {
      console.error('❌ Failed to send OTP');
      process.exit(1);
    }

    console.log('✅ OTP Sent Successfully!');
    console.log('');
    console.log('Response Details:');
    console.log(`   PIN ID: ${otpResult.pinId}`);
    console.log(`   Message ID: ${otpResult.messageId}`);
    console.log(`   Status: ${otpResult.status}`);
    console.log(`   Phone: ${otpResult.phoneNumber}`);
    console.log(`   Cost: ${otpResult.cost}`);
    console.log('');

    // Step 2: Verify OTP
    console.log('📥 Step 2: Verify OTP\n');
    
    const otp = await new Promise(resolve => {
      rl.question('Enter the OTP code you received: ', resolve);
    });

    console.log('\n🔍 Verifying OTP...\n');

    const verifyResult = await verifyOTPViaTermii(otpResult.pinId, otp);

    if (verifyResult.verified) {
      console.log('✅ OTP Verified Successfully!');
      console.log('');
      console.log('Verification Details:');
      console.log(`   Verified: ${verifyResult.verified}`);
      console.log(`   Phone: ${verifyResult.msisdn}`);
      console.log('');
      console.log('🎉 Termii OTP integration is working correctly!');
    } else {
      console.log('❌ OTP Verification Failed');
      console.log('');
      console.log('Error Details:');
      console.log(`   Error: ${verifyResult.error || 'Invalid OTP'}`);
      console.log('');
      console.log('💡 Possible reasons:');
      console.log('   - Incorrect OTP code');
      console.log('   - OTP expired (5 minutes)');
      console.log('   - Maximum attempts exceeded (3)');
    }

    console.log('');
    console.log('═'.repeat(60));
    rl.close();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('');
    console.error('Stack:', error.stack);
    rl.close();
    process.exit(1);
  }
}

// Run the test
testTermiiOTP();
