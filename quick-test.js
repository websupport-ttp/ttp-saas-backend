// quick-test.js
const axios = require('axios');

async function quickTest() {
  const BASE_URL = 'http://localhost:5001';
  
  try {
    console.log('Testing server endpoints...\n');
    
    // Test root
    const root = await axios.get(`${BASE_URL}/`);
    console.log(`✅ Root: ${root.status} - ${root.data}`);
    
    // Test API docs
    try {
      const docs = await axios.get(`${BASE_URL}/api-docs/`);
      console.log(`✅ API Docs: ${docs.status} - Available!`);
    } catch (e) {
      console.log(`❌ API Docs: ${e.response?.status} - ${e.message}`);
    }
    
    // Test reference countries
    try {
      const countries = await axios.get(`${BASE_URL}/api/v1/reference/countries`);
      console.log(`✅ Countries: ${countries.status} - ${countries.data.data?.length} countries`);
    } catch (e) {
      console.log(`❌ Countries: ${e.response?.status} - ${e.message}`);
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

quickTest();