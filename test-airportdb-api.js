// test-airportdb-api.js
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testAirportDbEndpoints() {
  console.log('🧪 Testing AirportDB API Endpoints...\n');

  try {
    // Test 1: Search airports
    console.log('1️⃣ Testing Airport Search...');
    try {
      const searchResponse = await axios.get(`${BASE_URL}/api/v1/airportdb/search`, {
        params: { q: 'new york', limit: 5 }
      });
      console.log('✅ Airport Search Status:', searchResponse.status);
      console.log('   Results:', searchResponse.data.data.length);
      console.log('   Sample:', searchResponse.data.data[0]?.displayName || 'No results');
    } catch (error) {
      console.log('❌ Airport Search Failed:', error.response?.status, error.message);
    }

    // Test 2: Get airport details
    console.log('\n2️⃣ Testing Airport Details...');
    try {
      const detailsResponse = await axios.get(`${BASE_URL}/api/v1/airportdb/airport/JFK`);
      console.log('✅ Airport Details Status:', detailsResponse.status);
      console.log('   Airport:', detailsResponse.data.data?.name || 'Not found');
      console.log('   City:', detailsResponse.data.data?.city || 'N/A');
    } catch (error) {
      console.log('❌ Airport Details Failed:', error.response?.status, error.message);
    }

    // Test 3: Get popular airports
    console.log('\n3️⃣ Testing Popular Airports...');
    try {
      const popularResponse = await axios.get(`${BASE_URL}/api/v1/airportdb/popular`, {
        params: { limit: 10 }
      });
      console.log('✅ Popular Airports Status:', popularResponse.status);
      console.log('   Count:', popularResponse.data.data.length);
      console.log('   Sample:', popularResponse.data.data[0]?.displayName || 'No results');
    } catch (error) {
      console.log('❌ Popular Airports Failed:', error.response?.status, error.message);
    }

    // Test 4: Get countries
    console.log('\n4️⃣ Testing Countries...');
    try {
      const countriesResponse = await axios.get(`${BASE_URL}/api/v1/airportdb/countries`);
      console.log('✅ Countries Status:', countriesResponse.status);
      console.log('   Count:', countriesResponse.data.data.length);
      console.log('   Sample:', countriesResponse.data.data[0]?.name || 'No results');
    } catch (error) {
      console.log('❌ Countries Failed:', error.response?.status, error.message);
    }

    // Test 5: Search with different queries
    console.log('\n5️⃣ Testing Various Search Queries...');
    const queries = ['london', 'LAX', 'dubai', 'lagos', 'paris'];
    
    for (const query of queries) {
      try {
        const response = await axios.get(`${BASE_URL}/api/v1/airportdb/search`, {
          params: { q: query, limit: 3 }
        });
        console.log(`   "${query}": ${response.data.data.length} results`);
      } catch (error) {
        console.log(`   "${query}": Failed (${error.response?.status})`);
      }
    }

    // Test 6: Cache status (will fail without admin auth, but that's expected)
    console.log('\n6️⃣ Testing Cache Status (should fail without auth)...');
    try {
      const cacheResponse = await axios.get(`${BASE_URL}/api/v1/airportdb/cache/status`);
      console.log('✅ Cache Status (unexpected success):', cacheResponse.status);
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Cache Status correctly requires authentication');
      } else {
        console.log('❌ Cache Status unexpected error:', error.response?.status, error.message);
      }
    }

    console.log('\n🎉 AirportDB API tests completed!');

  } catch (error) {
    console.error('\n💥 Test suite failed:', error.message);
    process.exit(1);
  }
}

// Performance test
async function performanceTest() {
  console.log('\n⚡ Running Performance Tests...');
  
  const queries = ['new', 'lon', 'par', 'tok', 'dub'];
  const startTime = Date.now();
  
  try {
    const promises = queries.map(query => 
      axios.get(`${BASE_URL}/api/v1/airportdb/search`, {
        params: { q: query, limit: 5 }
      })
    );
    
    const results = await Promise.all(promises);
    const endTime = Date.now();
    
    console.log(`✅ Concurrent searches completed in ${endTime - startTime}ms`);
    console.log(`   Average: ${(endTime - startTime) / queries.length}ms per search`);
    
    const totalResults = results.reduce((sum, res) => sum + res.data.data.length, 0);
    console.log(`   Total results: ${totalResults}`);
    
  } catch (error) {
    console.log('❌ Performance test failed:', error.message);
  }
}

// Rate limit test
async function rateLimitTest() {
  console.log('\n🚦 Testing Rate Limits...');
  
  try {
    const requests = [];
    for (let i = 0; i < 15; i++) {
      requests.push(
        axios.get(`${BASE_URL}/api/v1/airportdb/search`, {
          params: { q: 'test', limit: 1 }
        }).catch(err => ({ error: err.response?.status }))
      );
    }
    
    const results = await Promise.all(requests);
    const successful = results.filter(r => !r.error).length;
    const rateLimited = results.filter(r => r.error === 429).length;
    
    console.log(`   Successful requests: ${successful}`);
    console.log(`   Rate limited requests: ${rateLimited}`);
    
    if (rateLimited > 0) {
      console.log('✅ Rate limiting is working');
    } else {
      console.log('⚠️  Rate limiting may not be configured properly');
    }
    
  } catch (error) {
    console.log('❌ Rate limit test failed:', error.message);
  }
}

// Run all tests
async function runAllTests() {
  await testAirportDbEndpoints();
  await performanceTest();
  await rateLimitTest();
}

// Check if this script is being run directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testAirportDbEndpoints,
  performanceTest,
  rateLimitTest,
  runAllTests
};