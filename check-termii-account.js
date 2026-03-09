// check-termii-account.js - Check Termii Account Status
require('dotenv').config();
const axios = require('axios');

const checkTermiiAccount = async () => {
  console.log('🔍 Checking Termii Account Status...\n');
  
  if (!process.env.TERMII_API_KEY) {
    console.error('❌ TERMII_API_KEY is not set');
    process.exit(1);
  }
  
  const apiKey = process.env.TERMII_API_KEY;
  const baseUrl = process.env.TERMII_BASE_URL || 'https://v3.api.termii.com';
  
  try {
    // Check account balance
    console.log('💰 Checking Account Balance...');
    const balanceResponse = await axios.get(`${baseUrl}/api/get-balance?api_key=${apiKey}`);
    console.log('   Balance: ₦' + balanceResponse.data.balance);
    console.log('   Currency:', balanceResponse.data.currency);
    console.log('');
    
    // Get sender IDs
    console.log('📝 Fetching Sender IDs...');
    const senderResponse = await axios.get(`${baseUrl}/api/sender-id?api_key=${apiKey}`);
    
    if (senderResponse.data.data && senderResponse.data.data.length > 0) {
      console.log('   Available Sender IDs:');
      senderResponse.data.data.forEach((sender, index) => {
        console.log(`   ${index + 1}. ${sender.sender_id}`);
        console.log(`      Status: ${sender.status}`);
        console.log(`      Created: ${sender.created_at}`);
        console.log('');
      });
      
      // Find approved sender IDs
      const approvedSenders = senderResponse.data.data.filter(s => s.status === 'approved' || s.status === 'active');
      if (approvedSenders.length > 0) {
        console.log('✅ Approved Sender IDs:');
        approvedSenders.forEach(sender => {
          console.log(`   → ${sender.sender_id}`);
        });
        console.log('');
        console.log('💡 Use one of these in your TERMII_SENDER_ID environment variable');
      } else {
        console.log('⚠️  No approved sender IDs found');
        console.log('   Your KYC verification is likely still pending');
        console.log('   You can still test with Termii\'s default sender ID');
      }
    } else {
      console.log('   No sender IDs found');
      console.log('   You may need to request a sender ID in Termii dashboard');
    }
    
  } catch (error) {
    console.error('❌ Error checking account:');
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Message:', error.response.data);
    } else {
      console.error('   Error:', error.message);
    }
  }
};

checkTermiiAccount();
