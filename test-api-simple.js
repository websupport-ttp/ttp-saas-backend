const http = require('http');

const testEndpoint = (path) => {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://localhost:3001${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', err => reject(err));
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
};

async function testAPI() {
  try {
    console.log('Testing API endpoints...\n');
    
    // Test health endpoint
    console.log('1. Testing health endpoint:');
    const health = await testEndpoint('/health');
    console.log(`Status: ${health.status}`);
    console.log(`Response:`, JSON.stringify(health.data, null, 2));
    console.log('');
    
    // Test airports endpoint
    console.log('2. Testing airports endpoint:');
    const airports = await testEndpoint('/api/v1/reference-data/airports?query=london&limit=5');
    console.log(`Status: ${airports.status}`);
    console.log(`Response:`, JSON.stringify(airports.data, null, 2));
    console.log('');
    
    // Test countries endpoint
    console.log('3. Testing countries endpoint:');
    const countries = await testEndpoint('/api/v1/reference-data/countries');
    console.log(`Status: ${countries.status}`);
    console.log(`Response:`, JSON.stringify(countries.data, null, 2));
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testAPI();