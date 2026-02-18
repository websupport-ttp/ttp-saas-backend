// Test if SanlamAllianz API lookup endpoints are publicly accessible
const axios = require('axios');

const BASE_URL = 'https://web-app.sanlamallianz.com.ng/Travel';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  success: (msg) => console.log(`${colors.green}✓ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}✗ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}⚠ ${msg}${colors.reset}`),
  section: (msg) => console.log(`\n${colors.cyan}${'='.repeat(70)}\n${msg}\n${'='.repeat(70)}${colors.reset}\n`),
};

async function testPublicLookupAccess() {
  log.section('Testing Public Access to SanlamAllianz Lookup Endpoints');
  log.info(`Base URL: ${BASE_URL}`);
  
  const lookupEndpoints = [
    { name: 'Countries', path: '/api/lookup/GetCountry' },
    { name: 'Gender', path: '/api/lookup/GetGender' },
    { name: 'Title', path: '/api/lookup/GetTitle' },
    { name: 'States', path: '/api/lookup/GetState' },
    { name: 'Marital Status', path: '/api/lookup/GetMaritalStatus' },
    { name: 'Booking Type', path: '/api/lookup/GetBookingType' },
  ];

  let successCount = 0;
  let failCount = 0;

  for (const endpoint of lookupEndpoints) {
    try {
      log.info(`Testing ${endpoint.name}...`);
      const response = await axios.get(`${BASE_URL}${endpoint.path}`, {
        timeout: 10000,
        headers: {
          'User-Agent': 'TravelPlace-API/1.0',
          'Accept': 'application/json',
        },
      });

      log.success(`${endpoint.name}: Accessible (Status ${response.status})`);
      
      if (response.data) {
        const dataLength = Array.isArray(response.data) ? response.data.length : 'N/A';
        log.info(`  → Received ${dataLength} items`);
        
        // Show sample data
        if (Array.isArray(response.data) && response.data.length > 0) {
          console.log(`  → Sample:`, JSON.stringify(response.data[0], null, 2).substring(0, 200));
        }
      }
      
      successCount++;
      console.log('');
      
    } catch (error) {
      failCount++;
      
      if (error.response) {
        log.error(`${endpoint.name}: Failed (Status ${error.response.status})`);
        log.info(`  → Response: ${JSON.stringify(error.response.data).substring(0, 200)}`);
        
        if (error.response.status === 401) {
          log.warn(`  → Authentication required - need to call /token first`);
        }
      } else if (error.code === 'ENOTFOUND') {
        log.error(`${endpoint.name}: DNS lookup failed - URL might be incorrect`);
      } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
        log.error(`${endpoint.name}: Request timeout`);
      } else {
        log.error(`${endpoint.name}: ${error.message}`);
      }
      console.log('');
    }
  }

  log.section('Test Summary');
  log.info(`Total endpoints tested: ${lookupEndpoints.length}`);
  log.success(`Successful: ${successCount}`);
  if (failCount > 0) {
    log.error(`Failed: ${failCount}`);
  }

  if (successCount > 0) {
    log.success('\n✓ Lookup endpoints are publicly accessible!');
    log.info('You can proceed with testing quotes and purchases.');
  } else if (failCount > 0) {
    log.warn('\n⚠ Lookup endpoints require authentication.');
    log.info('You need to obtain a token from /token endpoint first.');
    log.info('This requires username and password credentials from SanlamAllianz.');
  }
}

async function testAuthenticationEndpoint() {
  log.section('Testing Authentication Endpoint');
  log.info('Attempting to call /token endpoint without credentials...');
  
  try {
    const response = await axios.post(`${BASE_URL}/token`, 
      new URLSearchParams({
        username: 'test',
        password: 'test',
        grant_type: 'password'
      }), 
      {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'TravelPlace-API/1.0',
        },
      }
    );
    
    log.success('Authentication endpoint is accessible');
    log.info(`Response: ${JSON.stringify(response.data).substring(0, 200)}`);
    
  } catch (error) {
    if (error.response) {
      if (error.response.status === 400 || error.response.status === 401) {
        log.warn(`Authentication endpoint exists but credentials are invalid (Status ${error.response.status})`);
        log.info('This is expected - you need valid credentials from SanlamAllianz');
        log.info(`Response: ${JSON.stringify(error.response.data).substring(0, 300)}`);
      } else {
        log.error(`Unexpected status: ${error.response.status}`);
        log.info(`Response: ${JSON.stringify(error.response.data).substring(0, 200)}`);
      }
    } else if (error.code === 'ENOTFOUND') {
      log.error('DNS lookup failed - URL might be incorrect');
      log.warn('Check if the base URL is correct: ' + BASE_URL);
    } else {
      log.error(`Error: ${error.message}`);
    }
  }
}

async function runTests() {
  log.section('SanlamAllianz API Public Access Test');
  log.info('This test checks if the API endpoints are accessible without authentication');
  
  // Test authentication endpoint first
  await testAuthenticationEndpoint();
  
  // Test lookup endpoints
  await testPublicLookupAccess();
  
  log.section('Next Steps');
  log.info('1. If lookup endpoints are public: You can start testing immediately');
  log.info('2. If authentication is required: Contact SanlamAllianz for credentials');
  log.info('3. Update .env file with credentials once obtained');
  log.info('4. Run: node test-sanlam-allianz-integration.js');
}

runTests().catch(error => {
  log.error(`Test failed: ${error.message}`);
  console.error(error);
  process.exit(1);
});
