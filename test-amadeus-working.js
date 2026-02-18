// Test Amadeus XML with the working approach
const AmadeusXmlService = require('./v1/services/amadeusXmlService');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function testWorkingAmadeus() {
  console.log('🎯 Testing Working Amadeus Implementation...\n');
  
  try {
    const amadeusService = new AmadeusXmlService();
    
    console.log('📋 Configuration Check:');
    const isValid = amadeusService.isConfigurationValid();
    console.log(`✅ Configuration Valid: ${isValid}`);
    
    if (!isValid) {
      console.error('❌ Configuration is invalid');
      return false;
    }
    
    console.log('\n✈️ Testing Flight Search...');
    const searchCriteria = {
      originLocationCode: 'LOS',
      destinationLocationCode: 'JFK',
      departureDate: '2024-12-15',
      adults: 1,
      travelClass: 'Economy'
    };
    
    console.log('📤 Search Criteria:', JSON.stringify(searchCriteria, null, 2));
    
    const startTime = Date.now();
    const result = await amadeusService.searchFlightsXml(searchCriteria);
    const duration = Date.now() - startTime;
    
    console.log(`\n🎉 SUCCESS! Flight search completed in ${duration}ms`);
    console.log('📊 Results Summary:');
    console.log(`- Status: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`- Results Count: ${result.data?.length || 0}`);
    console.log(`- Processing Time: ${result.meta?.processingTime || 'N/A'}ms`);
    console.log(`- Currency: ${result.meta?.currency || 'N/A'}`);
    
    if (result.data && result.data.length > 0) {
      console.log('\n📋 Sample Flight Details:');
      const firstFlight = result.data[0];
      console.log(`- Flight ID: ${firstFlight.id || 'N/A'}`);
      console.log(`- Price: ${firstFlight.price?.total || 'N/A'} ${firstFlight.price?.currency || ''}`);
      console.log(`- Airline: ${firstFlight.validatingAirlineCodes?.[0] || 'N/A'}`);
      console.log(`- Duration: ${firstFlight.itineraries?.[0]?.duration || 'N/A'}`);
      
      if (firstFlight.itineraries?.[0]?.segments?.[0]) {
        const segment = firstFlight.itineraries[0].segments[0];
        console.log(`- Route: ${segment.departure?.iataCode || 'N/A'} → ${segment.arrival?.iataCode || 'N/A'}`);
        console.log(`- Departure: ${segment.departure?.at || 'N/A'}`);
        console.log(`- Arrival: ${segment.arrival?.at || 'N/A'}`);
      }
    }
    
    if (result.dictionaries) {
      console.log('\n📚 Dictionaries Available:', Object.keys(result.dictionaries));
    }
    
    return true;
    
  } catch (error) {
    console.error('\n❌ Test Failed:');
    console.error(`❌ Error: ${error.message}`);
    
    if (error.code) {
      console.error(`❌ Code: ${error.code}`);
    }
    
    if (error.stack) {
      console.error(`❌ Stack: ${error.stack.split('\n').slice(0, 5).join('\n')}`);
    }
    
    return false;
  }
}

async function runWorkingTest() {
  console.log('🚀 Starting Working Amadeus Test...\n');
  
  const success = await testWorkingAmadeus();
  
  console.log('\n📋 Test Summary:');
  
  if (success) {
    console.log('✅ SUCCESS! Amadeus XML service is working correctly!');
    console.log('🎉 Your flight search is now returning real Amadeus data!');
    console.log('\n💡 Next steps:');
    console.log('1. Test your frontend flight search');
    console.log('2. Verify real flight data appears in your app');
    console.log('3. Test different routes and dates');
  } else {
    console.log('❌ Test failed - service needs debugging');
    console.log('\n💡 The namespace fix worked in isolation, but the service needs adjustment');
  }
}

if (require.main === module) {
  runWorkingTest().catch(console.error);
}

module.exports = { testWorkingAmadeus };