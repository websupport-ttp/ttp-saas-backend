// Test script for Allianz API integration
// Run with: node test-allianz-api.js

require('dotenv').config();
const allianzService = require('./v1/services/allianzService');
const logger = require('./v1/utils/logger');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

async function testAuthentication() {
  logSection('TEST 1: Authentication');
  
  try {
    log('Attempting to authenticate with SanlamAllianz API...', 'blue');
    const token = await allianzService.authenticateAllianz();
    
    if (token) {
      log('✓ Authentication successful!', 'green');
      log(`Token: ${token.substring(0, 20)}...`, 'blue');
      return true;
    } else {
      log('✗ Authentication failed: No token received', 'red');
      return false;
    }
  } catch (error) {
    log('✗ Authentication failed:', 'red');
    log(`  Error: ${error.message}`, 'red');
    return false;
  }
}

async function testConnectionValidation() {
  logSection('TEST 2: Connection Validation');
  
  try {
    log('Validating API connections...', 'blue');
    const connectionStatus = await allianzService.validateApiConnection();
    
    log('Connection Status:', 'blue');
    for (const [service, status] of Object.entries(connectionStatus)) {
      if (status.status === 'connected') {
        log(`  ✓ ${service}: Connected`, 'green');
        log(`    Base URL: ${status.baseUrl}`, 'blue');
      } else if (status.status === 'not_configured') {
        log(`  ⚠ ${service}: Not configured`, 'yellow');
      } else {
        log(`  ✗ ${service}: Failed`, 'red');
        log(`    Error: ${status.error}`, 'red');
      }
    }
    
    return true;
  } catch (error) {
    log('✗ Connection validation failed:', 'red');
    log(`  Error: ${error.message}`, 'red');
    return false;
  }
}

async function testGetCountries() {
  logSection('TEST 3: Get Countries Lookup');
  
  try {
    log('Fetching countries list...', 'blue');
    const response = await allianzService.getTravelInsuranceLookup('countries');
    
    if (response && response.data) {
      log('✓ Countries fetched successfully!', 'green');
      log(`  Total countries: ${response.data.length}`, 'blue');
      log('  Sample countries:', 'blue');
      response.data.slice(0, 5).forEach(country => {
        log(`    - ${country.name} (ID: ${country.id})`, 'blue');
      });
      return true;
    } else {
      log('✗ No data received', 'red');
      return false;
    }
  } catch (error) {
    log('✗ Failed to fetch countries:', 'red');
    log(`  Error: ${error.message}`, 'red');
    log('  This is expected if API credentials are not configured', 'yellow');
    return false;
  }
}

async function testGetQuote() {
  logSection('TEST 4: Get Travel Insurance Quote');
  
  const quoteDetails = {
    Destination: 110, // USA
    CoverBegins: '2026-02-15',
    CoverEnds: '2026-02-25',
    NoOfPeople: 1,
  };
  
  try {
    log('Requesting quote with details:', 'blue');
    log(`  Destination: USA (ID: 110)`, 'blue');
    log(`  Cover Period: ${quoteDetails.CoverBegins} to ${quoteDetails.CoverEnds}`, 'blue');
    log(`  Travelers: ${quoteDetails.NoOfPeople}`, 'blue');
    
    const response = await allianzService.getTravelInsuranceQuote(quoteDetails);
    
    if (response) {
      log('✓ Quote received successfully!', 'green');
      log(`  Quote ID: ${response.QuoteRequestId}`, 'blue');
      log(`  Amount: ${response.Amount} ${response.Currency || 'NGN'}`, 'blue');
      log(`  Product: ${response.ProductVariantId}`, 'blue');
      return true;
    } else {
      log('✗ No quote received', 'red');
      return false;
    }
  } catch (error) {
    log('✗ Failed to get quote:', 'red');
    log(`  Error: ${error.message}`, 'red');
    log('  This is expected if API credentials are not configured', 'yellow');
    return false;
  }
}

async function testHealthStatus() {
  logSection('TEST 5: Service Health Status');
  
  try {
    log('Checking service health...', 'blue');
    const healthStatus = await allianzService.getServiceHealthStatus();
    
    log(`Overall Status: ${healthStatus.overallStatus}`, 
      healthStatus.overallStatus === 'healthy' ? 'green' : 'yellow');
    log(`Health Score: ${healthStatus.healthScore.toFixed(2)}%`, 'blue');
    log(`Timestamp: ${healthStatus.timestamp}`, 'blue');
    
    if (healthStatus.errorStatistics) {
      log('\nError Statistics:', 'blue');
      log(`  Total Errors: ${healthStatus.errorStatistics.totalErrors}`, 'blue');
    }
    
    if (healthStatus.tokenStatus) {
      log('\nToken Status:', 'blue');
      log(`  Cached Tokens: ${healthStatus.tokenStatus.cachedTokens}`, 'blue');
      if (healthStatus.tokenStatus.tokenExpiryTimes.length > 0) {
        healthStatus.tokenStatus.tokenExpiryTimes.forEach(token => {
          log(`  - ${token.endpoint}: Expires in ${Math.round(token.expiresIn / 1000)}s`, 'blue');
        });
      }
    }
    
    return true;
  } catch (error) {
    log('✗ Failed to get health status:', 'red');
    log(`  Error: ${error.message}`, 'red');
    return false;
  }
}

async function checkEnvironmentVariables() {
  logSection('Environment Variables Check');
  
  const requiredVars = [
    'SANLAM_ALLIANZ_TRAVEL_BASE_URL',
    'SANLAM_ALLIANZ_API_USERNAME',
    'SANLAM_ALLIANZ_API_PASSWORD',
  ];
  
  const optionalVars = [
    'SANLAM_ALLIANZ_INSTANT_PLAN_BASE_URL',
    'SANLAM_ALLIANZ_AUTH_BASE_URL',
  ];
  
  log('Required Variables:', 'blue');
  let allConfigured = true;
  
  for (const varName of requiredVars) {
    const value = process.env[varName];
    if (value && !value.includes('your_') && !value.includes('_here')) {
      log(`  ✓ ${varName}: Configured`, 'green');
    } else {
      log(`  ✗ ${varName}: Not configured or using placeholder`, 'red');
      allConfigured = false;
    }
  }
  
  log('\nOptional Variables:', 'blue');
  for (const varName of optionalVars) {
    const value = process.env[varName];
    if (value) {
      log(`  ✓ ${varName}: ${value}`, 'green');
    } else {
      log(`  ⚠ ${varName}: Not set (will use defaults)`, 'yellow');
    }
  }
  
  return allConfigured;
}

async function runAllTests() {
  log('\n' + '█'.repeat(60), 'cyan');
  log('  ALLIANZ API INTEGRATION TEST SUITE', 'cyan');
  log('█'.repeat(60) + '\n', 'cyan');
  
  const envConfigured = await checkEnvironmentVariables();
  
  if (!envConfigured) {
    log('\n⚠ WARNING: API credentials not properly configured', 'yellow');
    log('Tests will use fallback mock data', 'yellow');
    log('To test real API, update credentials in backend/.env file\n', 'yellow');
  }
  
  const results = {
    authentication: await testAuthentication(),
    connection: await testConnectionValidation(),
    countries: await testGetCountries(),
    quote: await testGetQuote(),
    health: await testHealthStatus(),
  };
  
  // Summary
  logSection('TEST SUMMARY');
  
  const passed = Object.values(results).filter(r => r === true).length;
  const total = Object.keys(results).length;
  
  log(`Tests Passed: ${passed}/${total}`, passed === total ? 'green' : 'yellow');
  
  for (const [test, result] of Object.entries(results)) {
    const status = result ? '✓ PASS' : '✗ FAIL';
    const color = result ? 'green' : 'red';
    log(`  ${status}: ${test}`, color);
  }
  
  if (!envConfigured) {
    log('\n📝 Next Steps:', 'cyan');
    log('1. Update backend/.env with real SanlamAllianz API credentials', 'blue');
    log('2. Run this test again: node test-allianz-api.js', 'blue');
    log('3. Check ALLIANZ_API_INTEGRATION_GUIDE.md for detailed setup', 'blue');
  } else if (passed === total) {
    log('\n✓ All tests passed! API integration is working correctly.', 'green');
  } else {
    log('\n⚠ Some tests failed. Check error messages above.', 'yellow');
  }
  
  console.log('\n');
}

// Run tests
runAllTests().catch(error => {
  log('\n✗ Test suite failed with error:', 'red');
  log(error.stack, 'red');
  process.exit(1);
});
