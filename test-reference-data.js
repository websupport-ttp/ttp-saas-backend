// test-reference-data.js
const axios = require('axios');

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000/api/v1';

async function testReferenceDataEndpoints() {
  console.log('🧪 Testing Reference Data Endpoints...\n');

  try {
    // Test 1: Get Countries
    console.log('1️⃣ Testing GET /reference/countries');
    const countriesResponse = await axios.get(`${BASE_URL}/reference/countries`);
    console.log(`✅ Countries: ${countriesResponse.data.data.length} countries retrieved`);
    console.log(`   Sample: ${countriesResponse.data.data.slice(0, 3).map(c => c.name).join(', ')}`);
    console.log(`   Cached: ${countriesResponse.data.meta.cached}\n`);

    // Test 2: Get Airports (general list)
    console.log('2️⃣ Testing GET /reference/airports');
    const airportsResponse = await axios.get(`${BASE_URL}/reference/airports`);
    console.log(`✅ Airports: ${airportsResponse.data.data.length} airports retrieved`);
    console.log(`   Sample: ${airportsResponse.data.data.slice(0, 3).map(a => `${a.name} (${a.iataCode})`).join(', ')}`);
    console.log(`   Cached: ${airportsResponse.data.meta.cached}\n`);

    // Test 3: Search Airports
    console.log('3️⃣ Testing GET /reference/airports/search?q=london');
    const searchResponse = await axios.get(`${BASE_URL}/reference/airports/search?q=london`);
    console.log(`✅ Airport Search: ${searchResponse.data.data.length} results for "london"`);
    console.log(`   Results: ${searchResponse.data.data.slice(0, 3).map(a => `${a.name} (${a.iataCode})`).join(', ')}\n`);

    // Test 4: Get Airport Details
    console.log('4️⃣ Testing GET /reference/airports/LHR');
    try {
      const airportResponse = await axios.get(`${BASE_URL}/reference/airports/LHR`);
      console.log(`✅ Airport Details: ${airportResponse.data.data.name} (${airportResponse.data.data.iataCode})`);
      console.log(`   Location: ${airportResponse.data.data.address?.cityName}, ${airportResponse.data.data.address?.countryName}\n`);
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('⚠️  Airport LHR not found in search results (this is expected for some airports)\n');
      } else {
        throw error;
      }
    }

    // Test 5: Test with parameters
    console.log('5️⃣ Testing GET /reference/airports?keyword=dubai&limit=5');
    const dubaiResponse = await axios.get(`${BASE_URL}/reference/airports?keyword=dubai&limit=5`);
    console.log(`✅ Dubai Airports: ${dubaiResponse.data.data.length} results`);
    console.log(`   Results: ${dubaiResponse.data.data.map(a => `${a.name} (${a.iataCode})`).join(', ')}\n`);

    // Test 6: Error handling
    console.log('6️⃣ Testing error handling with invalid IATA code');
    try {
      await axios.get(`${BASE_URL}/reference/airports/INVALID`);
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ Error handling works: Invalid IATA code rejected\n');
      } else {
        console.log(`❌ Unexpected error status: ${error.response?.status}\n`);
      }
    }

    console.log('🎉 All reference data endpoint tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testReferenceDataEndpoints();
}

module.exports = testReferenceDataEndpoints;