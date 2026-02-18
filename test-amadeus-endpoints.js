// Test Amadeus XML endpoints to find the correct WSDL
const soap = require('soap');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function testAmadeusEndpoints() {
  console.log('🚀 Testing Amadeus XML Endpoints...\n');
  
  const baseEndpoint = process.env.AMADEUS_XML_ENDPOINT;
  const config = {
    username: process.env.AMADEUS_XML_USERNAME,
    password: process.env.AMADEUS_XML_PASSWORD,
    officeId: process.env.AMADEUS_XML_OFFICE_ID
  };
  
  console.log('📋 Configuration:');
  console.log('- Base Endpoint:', baseEndpoint);
  console.log('- Username:', config.username);
  console.log('- Office ID:', config.officeId);
  
  // Common Amadeus WSDL endpoints to test
  const endpoints = [
    `${baseEndpoint}`,
    `${baseEndpoint}/wsLowFarePlus.asmx`,
    `${baseEndpoint}/wsLowFarePlus.asmx?WSDL`,
    `${baseEndpoint}/Air_LowFareSearch.asmx?WSDL`,
    `${baseEndpoint}/FlightSearch.asmx?WSDL`,
    `${baseEndpoint}/LowFareSearch.asmx?WSDL`,
    `${baseEndpoint}/webservice.asmx?WSDL`,
    `${baseEndpoint}/service.asmx?WSDL`
  ];
  
  console.log('\n🌐 Testing HTTP Connectivity...');
  
  for (const endpoint of endpoints) {
    try {
      console.log(`\n🔍 Testing: ${endpoint}`);
      
      const response = await axios.get(endpoint, { 
        timeout: 15000,
        headers: {
          'User-Agent': 'TTP-AmadeusXML-Test/1.0',
          'Accept': 'text/xml, application/xml, text/html'
        }
      });
      
      console.log(`✅ Status: ${response.status}`);
      console.log(`✅ Content-Type: ${response.headers['content-type']}`);
      console.log(`✅ Content-Length: ${response.headers['content-length'] || 'N/A'}`);
      
      // Check if it's a WSDL
      if (endpoint.includes('WSDL')) {
        const isWsdl = response.data.includes('<wsdl:') || 
                      response.data.includes('<definitions') ||
                      response.data.includes('xmlns:wsdl');
        console.log(`✅ Valid WSDL: ${isWsdl}`);
        
        if (isWsdl) {
          console.log('🎯 Found valid WSDL! Testing SOAP client...');
          await testSoapClient(endpoint, config);
        }
      } else {
        // Check if it's a service description page
        const isServicePage = response.data.includes('Web Service') || 
                             response.data.includes('asmx') ||
                             response.data.includes('SOAP');
        console.log(`✅ Service Page: ${isServicePage}`);
        
        if (isServicePage) {
          console.log('📄 Service description found');
          // Extract WSDL links if any
          const wsdlMatch = response.data.match(/href=\"([^\"]*\\?WSDL[^\"]*)\"/i);
          if (wsdlMatch) {
            console.log(`🔗 WSDL Link found: ${wsdlMatch[1]}`);
          }
        }
      }
      
    } catch (error) {
      console.error(`❌ ${endpoint}`);
      console.error(`   Error: ${error.message}`);
      
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
        console.error(`   Headers: ${JSON.stringify(error.response.headers, null, 2)}`);
      }
    }
  }
}

async function testSoapClient(wsdlUrl, config) {
  try {
    console.log(`\n🔌 Creating SOAP client for: ${wsdlUrl}`);
    
    const soapOptions = {
      timeout: 30000,
      connection_timeout: 30000,
      forceSoap12Headers: false,
      preserveWhitespace: true,
      strict: false,
      ignoreBaseNameSpaces: false,
      request: {
        timeout: 30000,
        headers: {
          'User-Agent': 'TTP-AmadeusXML-Test/1.0',
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': ''
        }
      }
    };
    
    const client = await soap.createClientAsync(wsdlUrl, soapOptions);
    console.log('✅ SOAP Client Created Successfully');
    
    // Set authentication
    client.setSecurity(new soap.BasicAuthSecurity(config.username, config.password));
    console.log('✅ Authentication Set');
    
    // Get service description
    const description = client.describe();
    console.log('\n📋 Available Services:');
    
    Object.keys(description).forEach(serviceName => {
      console.log(`\n🔧 Service: ${serviceName}`);
      const service = description[serviceName];
      
      Object.keys(service).forEach(portName => {
        console.log(`  📡 Port: ${portName}`);
        const port = service[portName];
        
        Object.keys(port).forEach(methodName => {
          console.log(`    🎯 Method: ${methodName}`);
        });
      });
    });
    
    // Try to find common flight search methods
    const allMethods = [];
    Object.keys(description).forEach(serviceName => {
      const service = description[serviceName];
      Object.keys(service).forEach(portName => {
        const port = service[portName];
        Object.keys(port).forEach(methodName => {
          allMethods.push(methodName);
        });
      });
    });
    
    console.log('\n🔍 Looking for flight search methods...');
    const flightMethods = allMethods.filter(method => 
      method.toLowerCase().includes('flight') ||
      method.toLowerCase().includes('search') ||
      method.toLowerCase().includes('fare') ||
      method.toLowerCase().includes('air')
    );
    
    if (flightMethods.length > 0) {
      console.log('✅ Flight search methods found:');
      flightMethods.forEach(method => console.log(`  - ${method}`));
    } else {
      console.log('⚠️  No obvious flight search methods found');
      console.log('📋 All available methods:');
      allMethods.forEach(method => console.log(`  - ${method}`));
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ SOAP Client Test Failed:');
    console.error('❌ Error:', error.message);
    
    if (error.code) {
      console.error('❌ Error Code:', error.code);
    }
    
    return false;
  }
}

async function runEndpointTests() {
  try {
    await testAmadeusEndpoints();
    
    console.log('\n📋 Summary:');
    console.log('💡 Look for endpoints marked as "Valid WSDL: true"');
    console.log('💡 Use those endpoints in your AmadeusXmlService configuration');
    console.log('💡 Check the available methods to understand the API structure');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

if (require.main === module) {
  runEndpointTests().catch(console.error);
}

module.exports = { testAmadeusEndpoints, testSoapClient };