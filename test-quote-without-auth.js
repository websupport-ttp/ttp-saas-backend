// Test if quote and purchase endpoints require authentication
const axios = require('axios');

const BASE_URL = 'https://web-app.sanlamallianz.com.ng/Travel';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

const log = {
  success: (msg) => console.log(`${colors.green}✓ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}✗ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}⚠ ${msg}${colors.reset}`),
  section: (msg) => console.log(`\n${'='.repeat(70)}\n${msg}\n${'='.repeat(70)}\n`),
};

async function testQuoteWithoutAuth() {
  log.section('Testing Quote Endpoint Without Authentication');
  
  const quoteRequest = {
    DateOfBirth: '14-Nov-2000',
    Email: 'test@thetravelplace.com',
    Telephone: '08034635116',
    CoverBegins: '14-Mar-2026',
    CoverEnds: '30-Mar-2026',
    CountryId: 110,
    PurposeOfTravel: 'Leisure',
    TravelPlanId: 1,
    BookingTypeId: 1,
    IsRoundTrip: false,
    NoOfPeople: 1,
    NoOfChildren: 0,
    IsMultiTrip: false,
  };

  try {
    log.info('Sending quote request without authentication...');
    const response = await axios.post(`${BASE_URL}/api/Quote`, quoteRequest, {
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'TravelPlace-API/1.0',
      },
    });

    log.success('Quote endpoint is publicly accessible!');
    log.info(`Status: ${response.status}`);
    console.log('\nQuote Response:');
    console.log(JSON.stringify(response.data, null, 2));
    
    return response.data;
    
  } catch (error) {
    if (error.response) {
      if (error.response.status === 401) {
        log.error('Quote endpoint requires authentication (Status 401)');
        log.warn('You need to obtain credentials from SanlamAllianz');
      } else {
        log.error(`Quote request failed (Status ${error.response.status})`);
        console.log('\nError Response:');
        console.log(JSON.stringify(error.response.data, null, 2));
      }
    } else {
      log.error(`Request failed: ${error.message}`);
    }
    return null;
  }
}

async function testTravelPlanLookup() {
  log.section('Testing Travel Plan Lookup (requires countryId)');
  
  try {
    log.info('Fetching travel plans for countryId=110...');
    const response = await axios.get(`${BASE_URL}/api/lookup/GetTravelPlan`, {
      params: { countryId: 110 },
      timeout: 10000,
      headers: {
        'User-Agent': 'TravelPlace-API/1.0',
      },
    });

    log.success('Travel Plan lookup successful!');
    log.info(`Received ${response.data.length} travel plans`);
    console.log('\nSample Travel Plan:');
    console.log(JSON.stringify(response.data[0], null, 2));
    
  } catch (error) {
    if (error.response) {
      log.error(`Failed (Status ${error.response.status})`);
      console.log(JSON.stringify(error.response.data, null, 2));
    } else {
      log.error(`Request failed: ${error.message}`);
    }
  }
}

async function runTests() {
  log.section('SanlamAllianz API - Quote & Purchase Access Test');
  
  // Test travel plan lookup first
  await testTravelPlanLookup();
  
  // Test quote endpoint
  const quote = await testQuoteWithoutAuth();
  
  log.section('Summary');
  
  if (quote) {
    log.success('✓ The API allows quote generation without authentication!');
    log.info('This means you can test the full flow without credentials.');
    log.info('\nTo test purchases, you may still need authentication.');
    log.warn('\nNote: Even if quotes work, purchases likely require authentication.');
  } else {
    log.warn('⚠ Quote endpoint requires authentication.');
    log.info('\nYou need to:');
    log.info('1. Contact SanlamAllianz for API credentials');
    log.info('2. Update .env file with username and password');
    log.info('3. The system will authenticate and get a token automatically');
    log.info('4. Then you can test quotes and purchases');
  }
}

runTests().catch(error => {
  log.error(`Test failed: ${error.message}`);
  console.error(error);
  process.exit(1);
});
