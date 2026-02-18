// test-server.js
const axios = require('axios');

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';

async function testServerEndpoints() {
  console.log('🧪 Testing Server Endpoints...\n');

  try {
    // Test 1: Root endpoint
    console.log('1️⃣ Testing GET /');
    const rootResponse = await axios.get(`${BASE_URL}/`);
    console.log(`✅ Root endpoint: ${rootResponse.status} - ${rootResponse.data}`);

    // Test 2: Health check
    console.log('\n2️⃣ Testing GET /health');
    try {
      const healthResponse = await axios.get(`${BASE_URL}/health`);
      console.log(`✅ Health check: ${healthResponse.status} - ${JSON.stringify(healthResponse.data)}`);
    } catch (error) {
      console.log(`⚠️  Health endpoint: ${error.response?.status || 'No response'} - ${error.message}`);
    }

    // Test 3: API v1 base
    console.log('\n3️⃣ Testing GET /api/v1');
    try {
      const apiResponse = await axios.get(`${BASE_URL}/api/v1`);
      console.log(`✅ API v1: ${apiResponse.status}`);
    } catch (error) {
      console.log(`⚠️  API v1: ${error.response?.status || 'No response'} - ${error.message}`);
    }

    // Test 4: API docs
    console.log('\n4️⃣ Testing GET /api-docs');
    try {
      const docsResponse = await axios.get(`${BASE_URL}/api-docs/`);
      console.log(`✅ API docs: ${docsResponse.status} - Content-Type: ${docsResponse.headers['content-type']}`);
    } catch (error) {
      console.log(`❌ API docs: ${error.response?.status || 'No response'} - ${error.message}`);
      
      // Check if it's a redirect
      if (error.response?.status === 301 || error.response?.status === 302) {
        console.log(`   Redirect to: ${error.response.headers.location}`);
      }
    }

    // Test 5: Reference data endpoints (our new endpoints)
    console.log('\n5️⃣ Testing GET /api/v1/reference/countries');
    try {
      const countriesResponse = await axios.get(`${BASE_URL}/api/v1/reference/countries`);
      console.log(`✅ Reference countries: ${countriesResponse.status} - ${countriesResponse.data.data?.length || 0} countries`);
    } catch (error) {
      console.log(`❌ Reference countries: ${error.response?.status || 'No response'} - ${error.message}`);
    }

    console.log('\n🎉 Server endpoint tests completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Server appears to be down. Please start the server with:');
      console.error('   cd backend && npm run dev');
    }
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testServerEndpoints();
}

module.exports = testServerEndpoints;