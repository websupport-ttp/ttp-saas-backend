// test-sms.js - Test Termii SMS Integration
require('dotenv').config();
const axios = require('axios');

const testTermiiSMS = async () => {
  console.log('🧪 Testing Termii SMS Integration...\n');
  
  // Check environment variables
  console.log('📋 Configuration Check:');
  console.log('✓ TERMII_API_KEY:', process.env.TERMII_API_KEY ? '✅ Set' : '❌ Missing');
  console.log('✓ TERMII_BASE_URL:', process.env.TERMII_BASE_URL || 'https://v3.api.termii.com');
  console.log('✓ TERMII_SENDER_ID:', process.env.TERMII_SENDER_ID || 'TravelPlace');
  console.log('');
  
  if (!process.env.TERMII_API_KEY) {
    console.error('❌ TERMII_API_KEY is not set in .env file');
    process.exit(1);
  }
  
  // Test phone number (replace with your actual number)
  const testPhoneNumber = '2349035573593'; // Your number without +
  const testMessage = 'Test message from The Travel Place. Your verification code is: 123456';
  
  // Use generic sender ID while KYC is pending
  const senderID = 'N-Alert'; // Generic sender ID that works without KYC
  
  console.log('📱 Sending test SMS to:', `+${testPhoneNumber}`);
  console.log('📤 Sender ID:', senderID, '(Generic - works without KYC)');
  console.log('💬 Message:', testMessage);
  console.log('');
  
  try {
    const termiiBaseUrl = process.env.TERMII_BASE_URL || 'https://v3.api.termii.com';
    const response = await axios.post(`${termiiBaseUrl}/api/sms/send`, {
      to: testPhoneNumber,
      from: senderID, // Use generic sender ID
      sms: testMessage,
      type: 'plain',
      channel: 'generic',
      api_key: process.env.TERMII_API_KEY
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });
    
    console.log('✅ SMS Sent Successfully!');
    console.log('');
    console.log('📊 Response Details:');
    console.log('   Message ID:', response.data.message_id || 'N/A');
    console.log('   Status:', response.data.message || response.data.status);
    console.log('   Balance:', response.data.balance || 'N/A');
    console.log('');
    console.log('📱 Check your phone for the SMS!');
    console.log('');
    
    // Check account balance
    if (response.data.balance) {
      const balance = parseFloat(response.data.balance);
      if (balance < 100) {
        console.log('⚠️  Warning: Low balance (₦' + balance + '). Consider topping up.');
      } else {
        console.log('💰 Account Balance: ₦' + balance);
      }
    }
    
    return response.data;
    
  } catch (error) {
    console.error('❌ SMS Sending Failed!');
    console.error('');
    
    if (error.response) {
      console.error('📊 Error Details:');
      console.error('   Status:', error.response.status);
      console.error('   Message:', error.response.data?.message || error.response.data);
      console.error('');
      
      // Common error messages
      if (error.response.status === 401) {
        console.error('🔑 Authentication Error: Invalid API key');
        console.error('   → Check your TERMII_API_KEY in .env file');
      } else if (error.response.status === 400) {
        console.error('📝 Bad Request: Check your request parameters');
        console.error('   → Phone number format: 2349035573593 (no + or spaces)');
        console.error('   → Sender ID must be approved');
      } else if (error.response.status === 402) {
        console.error('💳 Payment Required: Insufficient balance');
        console.error('   → Top up your Termii account');
      } else if (error.response.status === 403) {
        console.error('🚫 Forbidden: KYC verification may be required');
        console.error('   → Complete KYC verification in Termii dashboard');
        console.error('   → Or you may have reached daily limits');
      }
    } else if (error.request) {
      console.error('🌐 Network Error: Could not reach Termii API');
      console.error('   → Check your internet connection');
      console.error('   → Termii API might be down');
    } else {
      console.error('❌ Error:', error.message);
    }
    
    console.error('');
    console.error('📚 Termii Documentation: https://developers.termii.com/');
    console.error('💬 Termii Support: support@termii.com');
    
    throw error;
  }
};

// Run the test
console.log('═══════════════════════════════════════════════════════');
console.log('  TERMII SMS INTEGRATION TEST');
console.log('═══════════════════════════════════════════════════════');
console.log('');

testTermiiSMS()
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
