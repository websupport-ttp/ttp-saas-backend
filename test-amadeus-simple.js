// Simple test of correct Amadeus endpoint
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function testSimpleEndpoint() {
  console.log('🎯 Testing Correct Amadeus WSDL Endpoint...\n');
  
  // Correct WSDL endpoint from documentation
  const correctWsdlUrl = 'http://amadeusws.tripxml.com/TripXML/wsLowFarePlus.asmx?WSDL';
  
  console.log(`🔍 Testing: ${correctWsdlUrl}`);
  
  try {
    const response = await axios.get(correctWsdlUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'TTP-AmadeusXML/1.0',
        'Accept': 'text/xml, application/xml'
      }
    });
    
    console.log(`✅ Status: ${response.status}`);
    console.log(`✅ Content-Type: ${response.headers['content-type']}`);
    
    const isWsdl = response.data.includes('<wsdl:') || 
                  response.data.includes('<definitions') ||
                  response.data.includes('xmlns:wsdl');
    
    console.log(`✅ Valid WSDL: ${isWsdl}`);
    
    if (isWsdl) {
      console.log('🎉 SUCCESS! Found the correct WSDL endpoint!');
      console.log('\n📋 Key Information:');
      console.log(`- Correct WSDL URL: ${correctWsdlUrl}`);
      console.log('- Service is accessible');
      console.log('- Ready to update AmadeusXmlService');
      
      return true;
    } else {
      console.log('❌ Response is not a valid WSDL');
      return false;
    }
    
  } catch (error) {
    console.error(`❌ Failed: ${error.message}`);
    
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
    }
    
    return false;
  }
}

if (require.main === module) {
  testSimpleEndpoint().then(success => {
    if (success) {
      console.log('\n💡 Next Steps:');
      console.log('1. Update AMADEUS_XML_ENDPOINT in .env');
      console.log('2. Update AmadeusXmlService implementation');
      console.log('3. Test flight search functionality');
    }
  }).catch(console.error);
}