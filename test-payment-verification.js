const axios = require('axios');

// Test payment verification for the recent transaction
const testPaymentVerification = async () => {
  const reference = 'TTP-FL-1765985468651'; // From the logs
  
  try {
    console.log('Testing payment verification for reference:', reference);
    
    const response = await axios.post('http://localhost:8080/api/v1/products/flights/verify-payment', {
      reference: reference
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Verification successful!');
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('Verification failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
  }
};

testPaymentVerification();