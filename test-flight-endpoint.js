// Test flight search endpoint
const axios = require('axios');

const testFlightSearch = async () => {
  try {
    console.log('🧪 Testing flight search endpoint...');
    
    const testData = {
      originLocationCode: 'LOS',
      destinationLocationCode: 'JFK',
      departureDate: '2024-12-15',
      adults: 1,
      children: 0,
      infants: 0,
      currencyCode: 'NGN',
      travelClass: 'ECONOMY',
      nonStop: false,
      max: 10
    };
    
    console.log('📤 Request data:', testData);
    
    const response = await axios.post('http://localhost:3004/api/v1/products/flights/search', testData, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Response status:', response.status);
    console.log('✅ Response data:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Error testing flight endpoint:');
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    } else if (error.request) {
      console.error('   No response received:', error.message);
    } else {
      console.error('   Error:', error.message);
    }
  }
};

testFlightSearch();