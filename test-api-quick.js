const axios = require('axios');

async function testAPI() {
  try {
    console.log('Testing API connection...');
    
    // Test health endpoint
    const healthResponse = await axios.get('http://localhost:3005/health');
    console.log('Health check:', healthResponse.status, healthResponse.data);
    
    // Test airport search
    const airportResponse = await axios.get('http://localhost:3005/api/v1/reference/airports/search?q=New&limit=5');
    console.log('Airport search:', airportResponse.status);
    console.log('Airport data:', JSON.stringify(airportResponse.data, null, 2));
    
  } catch (error) {
    console.error('API test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testAPI();