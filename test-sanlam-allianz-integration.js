// Test script for SanlamAllianz API integration
require('dotenv').config();
const allianzService = require('./v1/services/allianzService');

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
  section: (msg) => console.log(`\n${colors.cyan}${'='.repeat(60)}\n${msg}\n${'='.repeat(60)}${colors.reset}\n`),
};

async function testAuthentication() {
  log.section('Testing Authentication');
  try {
    const token = await allianzService.authenticateAllianz();
    log.success('Authentication successful');
    log.info(`Token: ${token.substring(0, 20)}...`);
    return true;
  } catch (error) {
    log.error(`Authentication failed: ${error.message}`);
    return false;
  }
}

async function testLookupEndpoints() {
  log.section('Testing Lookup Endpoints');
  
  const lookupTests = [
    { name: 'Countries', type: 'GetCountry' },
    { name: 'Gender', type: 'GetGender' },
    { name: 'Title', type: 'GetTitle' },
    { name: 'States', type: 'GetState' },
    { name: 'Marital Status', type: 'GetMaritalStatus' },
    { name: 'Booking Type', type: 'GetBookingType' },
  ];

  for (const test of lookupTests) {
    try {
      const result = await allianzService.getTravelInsuranceLookup(test.type);
      log.success(`${test.name} lookup successful`);
      log.info(`Received ${Array.isArray(result) ? result.length : 'N/A'} items`);
    } catch (error) {
      log.error(`${test.name} lookup failed: ${error.message}`);
    }
  }
}

async function testTravelPlanLookup() {
  log.section('Testing Travel Plan Lookup');
  try {
    // First get countries to get a valid countryId
    const countries = await allianzService.getTravelInsuranceLookup('GetCountry');
    if (countries && countries.length > 0) {
      const countryId = countries[0].id || countries[0].Id || 1;
      log.info(`Testing with countryId: ${countryId}`);
      
      const travelPlans = await allianzService.getTravelInsuranceLookup('GetTravelPlan', { countryId });
      log.success('Travel Plan lookup successful');
      log.info(`Received ${Array.isArray(travelPlans) ? travelPlans.length : 'N/A'} travel plans`);
    } else {
      log.warn('No countries found, skipping travel plan lookup');
    }
  } catch (error) {
    log.error(`Travel Plan lookup failed: ${error.message}`);
  }
}

async function testIndividualQuote() {
  log.section('Testing Individual Travel Insurance Quote');
  
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
    const quote = await allianzService.getTravelInsuranceQuote(quoteRequest);
    log.success('Individual quote request successful');
    log.info(`Quote ID: ${quote.QuoteRequestId || quote.quoteRequestId || 'N/A'}`);
    log.info(`Amount: ${quote.Amount || quote.amount || 'N/A'}`);
    log.info(`Product: ${quote.ProductVariantId || quote.productVariantId || 'N/A'}`);
    return quote;
  } catch (error) {
    log.error(`Individual quote failed: ${error.message}`);
    return null;
  }
}

async function testFamilyQuote() {
  log.section('Testing Family Travel Insurance Quote');
  
  const quoteRequest = {
    DateOfBirth: '14-Nov-2000',
    Email: 'test@thetravelplace.com',
    Telephone: '08034635116',
    CoverBegins: '14-Mar-2026',
    CoverEnds: '30-Mar-2026',
    CountryId: 4,
    PurposeOfTravel: 'Leisure',
    TravelPlanId: 1,
    BookingTypeId: 2,
    IsRoundTrip: false,
    NoOfPeople: 1,
    NoOfChildren: 2,
    IsMultiTrip: false,
  };

  try {
    const quote = await allianzService.getTravelInsuranceQuote(quoteRequest);
    log.success('Family quote request successful');
    log.info(`Quote ID: ${quote.QuoteRequestId || quote.quoteRequestId || 'N/A'}`);
    log.info(`Amount: ${quote.Amount || quote.amount || 'N/A'}`);
    log.info(`Product: ${quote.ProductVariantId || quote.productVariantId || 'N/A'}`);
    return quote;
  } catch (error) {
    log.error(`Family quote failed: ${error.message}`);
    return null;
  }
}

async function testIndividualPurchase(quoteId) {
  log.section('Testing Individual Travel Insurance Purchase');
  
  if (!quoteId) {
    log.warn('No quote ID provided, skipping purchase test');
    return;
  }

  const purchaseRequest = {
    QuoteId: quoteId,
    Surname: 'Doe',
    MiddleName: 'Test',
    FirstName: 'John',
    GenderId: 1,
    TitleId: 2,
    DateOfBirth: '14-Nov-1987',
    Email: 'test@thetravelplace.com',
    Telephone: '08034635116',
    StateId: 25,
    Address: '15 Test Street, Lagos',
    ZipCode: '100252',
    Nationality: 'Nigeria',
    PassportNo: 'A123456',
    IdentificationPath: null,
    Occupation: 'Software Developer',
    MaritalStatusId: 2,
    PreExistingMedicalCondition: false,
    MedicalCondition: null,
    NextOfKin: {
      FullName: 'Jane Doe',
      Address: 'Same as mine',
      Relationship: 'Spouse',
      Telephone: '08034635116',
    },
  };

  try {
    const result = await allianzService.purchaseTravelInsuranceIndividual(purchaseRequest);
    log.success('Individual purchase successful');
    log.info(`Contract No: ${result.ContractNo || result.contractNo || 'N/A'}`);
    return result;
  } catch (error) {
    log.error(`Individual purchase failed: ${error.message}`);
    return null;
  }
}

async function runAllTests() {
  log.section('SanlamAllianz API Integration Test Suite');
  
  // Check environment variables
  log.info('Checking environment variables...');
  const requiredEnvVars = [
    'SANLAM_ALLIANZ_TRAVEL_BASE_URL',
    'SANLAM_ALLIANZ_API_USERNAME',
    'SANLAM_ALLIANZ_API_PASSWORD',
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  if (missingVars.length > 0) {
    log.error(`Missing environment variables: ${missingVars.join(', ')}`);
    log.warn('Please update your .env file with the correct credentials');
    return;
  }
  
  log.success('All required environment variables are set');
  log.info(`Base URL: ${process.env.SANLAM_ALLIANZ_TRAVEL_BASE_URL}`);
  log.info(`Username: ${process.env.SANLAM_ALLIANZ_API_USERNAME}`);
  
  // Test authentication first
  const authSuccess = await testAuthentication();
  if (!authSuccess) {
    log.error('Authentication failed. Cannot proceed with other tests.');
    log.warn('Please verify your credentials in the .env file');
    return;
  }
  
  // Test lookup endpoints
  await testLookupEndpoints();
  await testTravelPlanLookup();
  
  // Test quote generation
  const individualQuote = await testIndividualQuote();
  await testFamilyQuote();
  
  // Test purchase (only if we have a quote ID)
  if (individualQuote && (individualQuote.QuoteRequestId || individualQuote.quoteRequestId)) {
    const quoteId = individualQuote.QuoteRequestId || individualQuote.quoteRequestId;
    log.warn('Purchase test is commented out to avoid creating real policies');
    log.info(`To test purchase, uncomment the line below and use Quote ID: ${quoteId}`);
    // await testIndividualPurchase(quoteId);
  }
  
  log.section('Test Suite Complete');
}

// Run the tests
runAllTests().catch(error => {
  log.error(`Test suite failed: ${error.message}`);
  console.error(error);
  process.exit(1);
});
