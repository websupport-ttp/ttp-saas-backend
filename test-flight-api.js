// Test script to verify flight API endpoints
const axios = require('axios');

const BASE_URL = 'http://localhost:3003';

async function testFlightAPI() {
  console.log('🧪 Testing Flight API Endpoints...\n');

  // Test 1: Health Check
  try {
    console.log('1. Testing Health Check...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health Check:', healthResponse.status, healthResponse.data.status || 'OK');
  } catch (error) {
    console.log('❌ Health Check Failed:', error.message);
    console.log('   Make sure the backend server is running on port 3003');
    return;
  }

  // Test 2: Flight Search Endpoint
  try {
    console.log('\n2. Testing Flight Search Endpoint...');
    const searchData = {
      originLocationCode: 'LOS',
      destinationLocationCode: 'JFK',
      departureDate: '2024-12-15',
      adults: 1,
      children: 0,
      infants: 0,
      currencyCode: 'NGN',
      max: 50,
      travelClass: 'ECONOMY',
      nonStop: false
    };

    const searchResponse = await axios.post(
      `${BASE_URL}/api/v1/products/flights/search`,
      searchData,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Flight Search:', searchResponse.status);
    console.log('   Response:', {
      status: searchResponse.data.status,
      message: searchResponse.data.message,
      dataCount: searchResponse.data.data?.data?.length || 0
    });
  } catch (error) {
    console.log('❌ Flight Search Failed:', error.response?.status, error.response?.data || error.message);
    
    if (error.response?.status === 404) {
      console.log('   The flight search endpoint might not be implemented yet');
    } else if (error.response?.status === 500) {
      console.log('   There might be an issue with the Amadeus API configuration');
    }
  }

  // Test 3: Reference Data (if available)
  try {
    console.log('\n3. Testing Reference Data Endpoint...');
    const refResponse = await axios.get(`${BASE_URL}/api/v1/reference/countries`);
    console.log('✅ Reference Data:', refResponse.status);
    console.log('   Countries count:', refResponse.data.data?.length || 0);
  } catch (error) {
    console.log('❌ Reference Data Failed:', error.response?.status, error.message);
  }

  // Test 4: API Documentation
  try {
    console.log('\n4. Testing API Documentation...');
    const docsResponse = await axios.get(`${BASE_URL}/api-docs.json`);
    console.log('✅ API Docs:', docsResponse.status);
    console.log('   API Title:', docsResponse.data.info?.title);
  } catch (error) {
    console.log('❌ API Docs Failed:', error.response?.status, error.message);
  }

  console.log('\n🎉 API Test Complete!');
  console.log('\nNext Steps:');
  console.log('1. If health check failed, start the backend server: npm run dev');
  console.log('2. If flight search failed, check Amadeus API configuration');
  console.log('3. Visit http://localhost:3003/api-docs for full API documentation');
}

// Run the test
testFlightAPI().catch(console.error);