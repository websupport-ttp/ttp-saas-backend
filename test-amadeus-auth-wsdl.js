// Test Amadeus WSDL with authentication
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function testAuthenticatedWSDL() {
  console.log('🔐 Testing Amadeus WSDL with Authentication...\n');
  
  const config = {
    endpoint: process.env.AMADEUS_XML_ENDPOINT,
    username: process.env.AMADEUS_XML_USERNAME,
    password: process.env.AMADEUS_XML_PASSWORD,
    officeId: process.env.AMADEUS_XML_OFFICE_ID
  };
  
  console.log('📋 Configuration:');
  console.log('- Endpoint:', config.endpoint);
  console.log('- Username:', config.username);
  console.log('- Office ID:', config.officeId);
  
  // Test different WSDL endpoints with authentication
  const wsdlEndpoints = [
    `${config.endpoint}/wsLowFarePlus.asmx?WSDL`,
    `${config.endpoint}/LowFareSearch.asmx?WSDL`,
    `${config.endpoint}/FlightSearch.asmx?WSDL`,
    `${config.endpoint}/Air_LowFareSearch.asmx?WSDL`,
    `${config.endpoint}/webservice.asmx?WSDL`,
    `${config.endpoint}/service.asmx?WSDL`,
    `${config.endpoint}?WSDL`,
    `${config.endpoint}.asmx?WSDL`
  ];
  
  // Try different authentication methods
  const authMethods = [
    {
      name: 'Basic Auth',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`,
        'User-Agent': 'TTP-AmadeusXML/1.0',
        'Accept': 'text/xml, application/xml'
      }
    },
    {
      name: 'URL Parameters',
      headers: {
        'User-Agent': 'TTP-AmadeusXML/1.0',
        'Accept': 'text/xml, application/xml'
      },
      urlSuffix: `?username=${config.username}&password=${config.password}`
    },
    {
      name: 'Custom Headers',
      headers: {
        'User-Agent': 'TTP-AmadeusXML/1.0',
        'Accept': 'text/xml, application/xml',
        'X-Username': config.username,
        'X-Password': config.password,
        'X-Office-ID': config.officeId
      }
    }
  ];
  
  for (const endpoint of wsdlEndpoints) {
    console.log(`\n🔍 Testing endpoint: ${endpoint}`);
    
    for (const authMethod of authMethods) {
      try {
        const url = endpoint + (authMethod.urlSuffix || '');
        console.log(`  🔐 Trying ${authMethod.name}...`);
        
        const response = await axios.get(url, {
          timeout: 15000,
          headers: authMethod.headers,
          validateStatus: function (status) {
            return status < 500; // Don't throw for 4xx errors
          }
        });
        
        console.log(`    ✅ Status: ${response.status}`);
        console.log(`    ✅ Content-Type: ${response.headers['content-type']}`);
        
        if (response.status === 200) {
          const isWsdl = response.data.includes('<wsdl:') || 
                        response.data.includes('<definitions') ||
                        response.data.includes('xmlns:wsdl');
          
          console.log(`    ✅ Valid WSDL: ${isWsdl}`);
          
          if (isWsdl) {
            console.log('    🎉 SUCCESS! Found valid WSDL with authentication!');
            console.log(`    📄 WSDL URL: ${url}`);
            console.log(`    🔐 Auth Method: ${authMethod.name}`);
            
            // Extract service information
            const serviceMatch = response.data.match(/<service[^>]*name=["']([^"']*)["'][^>]*>/i);
            if (serviceMatch) {
              console.log(`    🔧 Service Name: ${serviceMatch[1]}`);
            }
            
            return { url, authMethod: authMethod.name, wsdl: response.data };
          }
        } else if (response.status === 401) {
          console.log('    ⚠️  Authentication required but credentials rejected');
        } else if (response.status === 403) {
          console.log('    ⚠️  Access forbidden - might need different credentials');
        } else if (response.status === 404) {
          console.log('    ⚠️  Endpoint not found');
        } else {
          console.log(`    ⚠️  Unexpected status: ${response.status}`);
        }
        
      } catch (error) {
        console.error(`    ❌ ${authMethod.name}: ${error.message}`);
      }
    }
  }
  
  return null;
}

async function runAuthenticatedTests() {
  console.log('🚀 Starting Authenticated Amadeus WSDL Tests...\n');
  
  const httpResult = await testAuthenticatedWSDL();
  
  console.log('\n📋 Test Summary:');
  
  if (httpResult) {
    console.log('✅ WSDL found!');
    console.log(`   URL: ${httpResult.url}`);
    console.log(`   Auth: ${httpResult.authMethod}`);
  } else {
    console.log('❌ No valid WSDL found');
    console.log('\n💡 Recommendations:');
    console.log('1. Contact Amadeus support (Rastko) to verify:');
    console.log('   - Correct WSDL endpoint URL');
    console.log('   - Authentication method required');
    console.log('   - Whether credentials are still active');
    console.log('2. Check if the service requires IP whitelisting');
    console.log('3. Verify if the service has moved to a different endpoint');
    console.log('4. Ask for updated documentation with current endpoints');
  }
}

if (require.main === module) {
  runAuthenticatedTests().catch(console.error);
}

module.exports = { testAuthenticatedWSDL };