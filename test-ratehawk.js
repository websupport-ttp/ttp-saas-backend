// Quick test script for Ratehawk API credentials
require('dotenv').config();
const axios = require('axios');

const RATEHAWK_BASE_URL = process.env.RATEHAWK_BASE_URL;
const RATEHAWK_API_KEY_ID = process.env.RATEHAWK_API_KEY_ID;
const RATEHAWK_API_ACCESS_TOKEN = process.env.RATEHAWK_API_ACCESS_TOKEN;

const auth = Buffer.from(`${RATEHAWK_API_KEY_ID}:${RATEHAWK_API_ACCESS_TOKEN}`).toString('base64');

console.log('Testing Ratehawk API credentials...');
console.log('Base URL:', RATEHAWK_BASE_URL);
console.log('Key ID:', RATEHAWK_API_KEY_ID);
console.log('Token length:', RATEHAWK_API_ACCESS_TOKEN?.length);
console.log('---');

// Test 1: Multicomplete search (location search)
console.log('\nTest 1: Multicomplete Search');
axios.post(`${RATEHAWK_BASE_URL}/api/b2b/v3/search/multicomplete`, {
  query: 'London',
  language: 'en'
}, {
  headers: {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/json'
  }
})
.then(response => {
  console.log('✅ Multicomplete search SUCCESS');
  console.log('Status:', response.status);
  console.log('Regions found:', response.data?.data?.regions?.length || 0);
  console.log('Hotels found:', response.data?.data?.hotels?.length || 0);
  if (response.data?.data?.regions?.length > 0) {
    console.log('First region:', response.data.data.regions[0]);
  }
})
.catch(error => {
  console.log('❌ Multicomplete search FAILED');
  console.log('Error:', error.message);
  if (error.response) {
    console.log('Status:', error.response.status);
    console.log('Data:', JSON.stringify(error.response.data, null, 2));
  }
})
.finally(() => {
  // Test 2: Hotel search by region
  console.log('\nTest 2: Hotel Search by Region');
  axios.post(`${RATEHAWK_BASE_URL}/api/b2b/v3/search/serp/region`, {
    checkin: '2025-12-01',
    checkout: '2025-12-02',
    residency: 'us',
    language: 'en',
    guests: [{ adults: 2, children: [] }],
    region_id: 6040,
    currency: 'USD'
  }, {
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json'
    }
  })
  .then(response => {
    console.log('✅ Hotel search SUCCESS');
    console.log('Status:', response.status);
    console.log('Hotels found:', response.data?.data?.hotels?.length || 0);
  })
  .catch(error => {
    console.log('❌ Hotel search FAILED');
    console.log('Error:', error.message);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', JSON.stringify(error.response.data, null, 2));
    }
  });
});
