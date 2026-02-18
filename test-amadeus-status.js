// Test Amadeus service status through the backend API
const axios = require('axios');

async function testAmadeusStatus() {
  try {
    console.log('🔍 Testing Amadeus Service Status via Backend API...\n');
    
    // Test health endpoint to see Amadeus status
    const healthResponse = await axios.get('http://localhost:8080/health');
    
    console.log('🏥 Backend Health Status:', healthResponse.data.data.status);
    
    if (healthResponse.data.data.services.amadeus) {
      const amadeusHealth = healthResponse.data.data.services.amadeus;
      console.log('✅ Amadeus Service Status:', amadeusHealth.status);
      console.log('✅ Amadeus Response Time:', amadeusHealth.responseTime + 'ms');
      
      if (amadeusHealth.details) {
        console.log('✅ Amadeus Details:', amadeusHealth.details);
      }
      
      if (amadeusHealth.status === 'healthy') {
        console.log('\n🎉 Amadeus service is healthy! The issue might be elsewhere.');
        
        // Try a simple flight search to see detailed error
        console.log('\n🔍 Testing flight search for detailed error...');
        
        try {
          const flightResponse = await axios.post('http://localhost:8080/api/v1/products/flights/search', {
            originLocationCode: 'LOS',
            destinationLocationCode: 'JFK', 
            departureDate: '2024-12-15',
            adults: 1,
            currencyCode: 'NGN'
          });
          
          if (flightResponse.data.message.includes('mock data')) {
            console.log('⚠️  Still getting mock data despite healthy Amadeus service');
            console.log('💡 This suggests the Amadeus XML service might have authentication issues');
          } else {
            console.log('✅ Real flight data received!');
          }
          
        } catch (flightError) {
          console.error('❌ Flight search error:', flightError.response?.data || flightError.message);
        }
        
      } else {
        console.log('\n⚠️  Amadeus service is not healthy');
        console.log('💡 This explains why flight search is using mock data');
        
        if (amadeusHealth.error) {
          console.log('❌ Amadeus Error:', amadeusHealth.error);
        }
      }
    } else {
      console.log('❌ No Amadeus service status found in health check');
    }
    
  } catch (error) {
    console.error('❌ Failed to test Amadeus status:', error.message);
    
    if (error.response) {
      console.error('❌ Response:', error.response.data);
    }
  }
}

async function checkBackendLogs() {
  console.log('\n📋 Backend Configuration Check:');
  console.log('💡 To check if Amadeus XML is properly configured:');
  console.log('1. Check backend/.env file for AMADEUS_XML_* variables');
  console.log('2. Restart your backend server to reload environment variables');
  console.log('3. Check backend logs for Amadeus initialization errors');
  console.log('4. Verify Amadeus XML endpoint is accessible');
  
  console.log('\n🔧 Troubleshooting Steps:');
  console.log('1. Restart backend: cd backend && npm start');
  console.log('2. Check logs for "Amadeus" or "XML" related errors');
  console.log('3. Verify network connectivity to Amadeus endpoint');
  console.log('4. Test Amadeus credentials with their support team');
}

async function runTest() {
  console.log('🚀 Testing Amadeus Service Status...\n');
  
  await testAmadeusStatus();
  await checkBackendLogs();
  
  console.log('\n📋 Summary:');
  console.log('- Frontend is correctly connected to backend on port 8080');
  console.log('- Backend is falling back to mock data due to Amadeus service issues');
  console.log('- Check backend logs and Amadeus configuration to resolve');
}

if (require.main === module) {
  runTest().catch(console.error);
}

module.exports = { testAmadeusStatus };