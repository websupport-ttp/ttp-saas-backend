// Test script for Amadeus XML Service
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const AmadeusXmlService = require('./v1/services/amadeusXmlService');

async function testAmadeusXmlService() {
  try {
    console.log('🔍 Testing Amadeus XML Service...\n');
    
    const amadeusService = new AmadeusXmlService();
    
    // Check configuration
    console.log('📋 Checking Configuration...');
    const isConfigValid = amadeusService.isConfigurationValid();
    console.log(`✅ Configuration Valid: ${isConfigValid}`);
    
    // Test flight search
    console.log('\n🔍 Testing Flight Search...');
    const searchCriteria = {
      originLocationCode: 'LOS',
      destinationLocationCode: 'JFK',
      departureDate: '2024-12-15',
      adults: 1,
      currencyCode: 'NGN',
      travelClass: 'ECONOMY'
    };
    
    console.log('📤 Search Criteria:', searchCriteria);
    
    const searchResult = await amadeusService.searchFlightsXml(searchCriteria);
    
    console.log('✅ Flight Search Successful!');
    console.log('✅ Results Count:', searchResult.meta?.count || 0);
    console.log('✅ Processing Time:', searchResult.meta?.processingTime || 'N/A');
    
    if (searchResult.data && searchResult.data.length > 0) {
      const firstFlight = searchResult.data[0];
      console.log('✅ Sample Flight:', {
        id: firstFlight.id,
        price: firstFlight.price?.total,
        currency: firstFlight.price?.currency,
        carrier: firstFlight.validatingAirlineCodes?.[0]
      });
    }
    
    console.log('\n🎉 Amadeus XML Service Test Successful!');
    return true;
    
  } catch (error) {
    console.error('❌ Amadeus XML Service Test Failed:');
    console.error('❌ Error Type:', error.constructor.name);
    console.error('❌ Error Message:', error.message);
    
    if (error.code) {
      console.error('❌ Error Code:', error.code);
    }
    
    if (error.details) {
      console.error('❌ Error Details:', error.details);
    }
    
    if (error.stack) {
      console.error('❌ Stack Trace:', error.stack);
    }
    
    return false;
  }
}

async function testAmadeusConfiguration() {
  try {
    console.log('🔧 Testing Amadeus Configuration...\n');
    
    const requiredEnvVars = [
      'AMADEUS_XML_ENDPOINT',
      'AMADEUS_XML_USERNAME', 
      'AMADEUS_XML_PASSWORD',
      'AMADEUS_XML_OFFICE_ID'
    ];
    
    console.log('📋 Environment Variables Check:');
    requiredEnvVars.forEach(varName => {
      const value = process.env[varName];
      if (value) {
        console.log(`✅ ${varName}: ${varName.includes('PASSWORD') ? '***' : value}`);
      } else {
        console.log(`❌ ${varName}: Not set`);
      }
    });
    
    return true;
  } catch (error) {
    console.error('❌ Configuration test failed:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Starting Amadeus XML Service Tests...\n');
  
  // Test configuration first
  const configOk = await testAmadeusConfiguration();
  
  if (!configOk) {
    console.log('\n⚠️  Configuration test failed. Please check your environment variables.');
    return;
  }
  
  // Test service
  const serviceOk = await testAmadeusXmlService();
  
  console.log('\n📋 Test Summary:');
  console.log(`- Configuration: ${configOk ? '✅ OK' : '❌ Failed'}`);
  console.log(`- Service: ${serviceOk ? '✅ OK' : '❌ Failed'}`);
  
  if (configOk && serviceOk) {
    console.log('\n🎉 All tests passed! Amadeus XML service is working correctly.');
    console.log('💡 Your flight search should now return real data instead of mock data.');
  } else {
    console.log('\n⚠️  Some tests failed. Flight search will continue to use mock data.');
    console.log('💡 Check your Amadeus XML API credentials and network connectivity.');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testAmadeusXmlService, testAmadeusConfiguration };