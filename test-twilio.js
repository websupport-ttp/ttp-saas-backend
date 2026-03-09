// test-twilio.js - Test Twilio SMS Integration
require('dotenv').config();

const testTwilioSMS = async () => {
  console.log('🧪 Testing Twilio SMS Integration...\n');
  
  // Check environment variables
  console.log('📋 Configuration Check:');
  console.log('✓ TWILIO_ACCOUNT_SID:', process.env.TWILIO_ACCOUNT_SID ? '✅ Set' : '❌ Missing');
  console.log('✓ TWILIO_AUTH_TOKEN:', process.env.TWILIO_AUTH_TOKEN ? '✅ Set' : '❌ Missing');
  console.log('✓ TWILIO_PHONE_NUMBER:', process.env.TWILIO_PHONE_NUMBER || '❌ Not set');
  console.log('');
  
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.error('❌ Twilio credentials are not set in .env file');
    process.exit(1);
  }
  
  if (!process.env.TWILIO_PHONE_NUMBER) {
    console.error('❌ TWILIO_PHONE_NUMBER is not set');
    console.error('   Get a phone number from: https://console.twilio.com/us1/develop/phone-numbers/manage/incoming');
    process.exit(1);
  }
  
  try {
    const twilio = require('twilio');
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    
    // Test phone number
    const testPhoneNumber = '+2349035573593'; // Your number
    const testMessage = 'Test message from The Travel Place. Your verification code is: 123456';
    
    console.log('📱 Sending test SMS to:', testPhoneNumber);
    console.log('📤 From:', process.env.TWILIO_PHONE_NUMBER);
    console.log('💬 Message:', testMessage);
    console.log('');
    console.log('⏳ Sending...');
    console.log('');
    
    const message = await client.messages.create({
      body: testMessage,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: testPhoneNumber,
    });
    
    console.log('✅ SMS Sent Successfully!');
    console.log('');
    console.log('📊 Response Details:');
    console.log('   Message SID:', message.sid);
    console.log('   Status:', message.status);
    console.log('   Direction:', message.direction);
    console.log('   Price:', message.price || 'Pending');
    console.log('   Price Unit:', message.priceUnit || 'USD');
    console.log('');
    console.log('📱 Check your phone for the SMS!');
    console.log('');
    
    // Check account balance
    try {
      const balance = await client.balance.fetch();
      console.log('💰 Account Balance:', balance.balance, balance.currency);
      console.log('');
    } catch (balanceError) {
      console.log('⚠️  Could not fetch balance (this is normal for trial accounts)');
      console.log('');
    }
    
    return message;
    
  } catch (error) {
    console.error('❌ SMS Sending Failed!');
    console.error('');
    
    if (error.code) {
      console.error('📊 Error Details:');
      console.error('   Code:', error.code);
      console.error('   Message:', error.message);
      console.error('');
      
      // Common error codes
      if (error.code === 20003) {
        console.error('🔑 Authentication Error: Invalid credentials');
        console.error('   → Check your TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN');
      } else if (error.code === 21211) {
        console.error('📱 Invalid Phone Number');
        console.error('   → Check the phone number format: +2349035573593');
      } else if (error.code === 21608) {
        console.error('📤 Invalid From Number');
        console.error('   → Check your TWILIO_PHONE_NUMBER');
        console.error('   → Get a number from Twilio console');
      } else if (error.code === 21614) {
        console.error('🚫 Unverified Number (Trial Account)');
        console.error('   → Add +2349035573593 to verified numbers in Twilio console');
        console.error('   → Or upgrade your account');
      }
    } else {
      console.error('❌ Error:', error.message);
    }
    
    console.error('');
    console.error('📚 Twilio Documentation: https://www.twilio.com/docs/sms');
    console.error('💬 Twilio Console: https://console.twilio.com/');
    
    throw error;
  }
};

// Run the test
console.log('═══════════════════════════════════════════════════════');
console.log('  TWILIO SMS INTEGRATION TEST');
console.log('═══════════════════════════════════════════════════════');
console.log('');

testTwilioSMS()
  .then(() => {
    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ TEST COMPLETED SUCCESSFULLY');
    console.log('═══════════════════════════════════════════════════════');
    process.exit(0);
  })
  .catch((error) => {
    console.log('═══════════════════════════════════════════════════════');
    console.log('❌ TEST FAILED');
    console.log('═══════════════════════════════════════════════════════');
    process.exit(1);
  });
