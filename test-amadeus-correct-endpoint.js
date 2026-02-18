// Test Amadeus with correct endpoint from documentation
const axios = require('axios');
const soap = require('soap');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function testCorrectAmadeusEndpoint() {
  console.log('🎯 Testing Correct Amadeus Endpoint from Documentation...\n');
  
  const config = {
    username: process.env.AMADEUS_XML_USERNAME,
    password: process.env.AMADEUS_XML_PASSWORD,
    officeId: process.env.AMADEUS_XML_OFFICE_ID
  };
  
  console.log('📋 Configuration:');
  console.log('- Username:', config.username);
  console.log('- Office ID:', config.officeId);
  
  // Correct WSDL endpoint from documentation
  const correctWsdlUrl = 'http://amadeusws.tripxml.com/TripXML/wsLowFarePlus.asmx?WSDL';
  
  console.log(`\n🔍 Testing correct WSDL: ${correctWsdlUrl}`);
  
  try {
    // Test HTTP access to WSDL
    console.log('📡 Testing HTTP access...');
    const response = await axios.get(correctWsdlUrl, {
      timeout: 15000,
      headers: {
        'User-Agent': 'TTP-AmadeusXML/1.0',
        'Accept': 'text/xml, application/xml'
      }
    });
    
    console.log(`✅ HTTP Status: ${response.status}`);
    console.log(`✅ Content-Type: ${response.headers['content-type']}`);
    console.log(`✅ Content-Length: ${response.headers['content-length']}`);
    
    const isWsdl = response.data.includes('<wsdl:') || 
                  response.data.includes('<definitions') ||
                  response.data.includes('xmlns:wsdl');
    
    console.log(`✅ Valid WSDL: ${isWsdl}`);
    
    if (isWsdl) {
      console.log('🎉 SUCCESS! Found valid WSDL!');
      
      // Extract service information
      const serviceMatch = response.data.match(/<service[^>]*name=["']([^"']*)["'][^>]*>/i);
      if (serviceMatch) {
        console.log(`🔧 Service Name: ${serviceMatch[1]}`);
      }
      
      // Extract operations
      const operationMatches = response.data.match(/<operation[^>]*name=["']([^"']*)["'][^>]*>/gi);
      if (operationMatches) {
        console.log('🎯 Available Operations:');
        const operations = new Set();
        operationMatches.forEach(match => {
          const opName = match.match(/name=["']([^"']*)["']/i);
          if (opName) {
            operations.add(opName[1]);
          }
        });
        operations.forEach(op => console.log(`  - ${op}`));
      }
      
      // Test SOAP client creation
      console.log('\n🔌 Testing SOAP Client Creation...');
      
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
            'User-Agent': 'TTP-AmadeusXML/1.0',
            'Content-Type': 'text/xml; charset=utf-8',
            'SOAPAction': ''
          }
        }
      };
      
      const client = await soap.createClientAsync(correctWsdlUrl, soapOptions);
      console.log('✅ SOAP Client Created Successfully');
      
      // Get service description
      const description = client.describe();
      console.log('\n📋 SOAP Service Structure:');
      
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
      
      // Test a sample flight search request
      console.log('\n✈️ Testing Sample Flight Search Request...');
      
      const sampleRequest = {
        'OTA_AirLowFareSearchPlusRQ': {
          'POS': {
            'Source': {
              'PseudoCityCode': config.officeId,
              'RequestorID': {
                'Type': '21',
                'ID': 'requestor'
              }
            },
            'TPA_Extensions': {
              'Provider': {
                'Name': 'Amadeus',
                'System': 'Test',
                'Userid': config.username,
                'Password': config.password
              }
            }
          },
          'OriginDestinationInformation': [
            {
              'DepartureDateTime': '2024-12-15T00:00:00',
              'OriginLocation': {
                'LocationCode': 'LOS'
              },
              'DestinationLocation': {
                'LocationCode': 'JFK'
              }
            }
          ],
          'TravelPreferences': {
            'CabinPref': {
              'Cabin': 'Economy'
            }
          },
          'TravelerInfoSummary': {
            'SeatsRequested': '1',
            'AirTravelerAvail': [
              {
                'PassengerTypeQuantity': {
                  'Code': 'ADT',
                  'Quantity': '1'
                }
              }
            ]
          }
        }
      };
      
      // Find the correct method name
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
      
      console.log('📋 Available methods:', allMethods);
      
      // Try to call the flight search method
      const searchMethods = allMethods.filter(method => 
        method.toLowerCase().includes('lowfare') ||
        method.toLowerCase().includes('search') ||
        method.toLowerCase().includes('plus')
      );
      
      if (searchMethods.length > 0) {
        const methodName = searchMethods[0];
        console.log(`🎯 Trying method: ${methodName}`);
        
        try {
          const searchResult = await client[methodName + 'Async'](sampleRequest);
          console.log('🎉 Flight search successful!');
          console.log('📄 Response:', JSON.stringify(searchResult, null, 2));
          
          return { success: true, wsdlUrl: correctWsdlUrl, method: methodName };
          
        } catch (searchError) {
          console.error('❌ Flight search failed:', searchError.message);
          
          if (searchError.response) {
            console.error('📄 SOAP Response:', searchError.response);
          }
          
          return { success: false, wsdlUrl: correctWsdlUrl, error: searchError.message };
        }
      } else {
        console.log('⚠️  No obvious flight search methods found');
        return { success: false, wsdlUrl: correctWsdlUrl, error: 'No flight search methods found' };
      }
      
    } else {
      console.error('❌ Response is not a valid WSDL');
      return { success: false, error: 'Invalid WSDL response' };
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.response) {
      console.error('📄 HTTP Response:', error.response.status, error.response.statusText);
    }
    
    return { success: false, error: error.message };
  }
}

async function runCorrectEndpointTest() {
  console.log('🚀 Starting Correct Amadeus Endpoint Test...\n');
  
  const result = await testCorrectAmadeusEndpoint();
  
  console.log('\n📋 Test Summary:');
  
  if (result.success) {
    console.log('✅ SUCCESS! Amadeus XML service is working!');
    console.log(`   WSDL URL: ${result.wsdlUrl}`);
    console.log(`   Method: ${result.method}`);
    console.log('\n💡 Next steps:');
    console.log('1. Update AMADEUS_XML_ENDPOINT in .env file');
    console.log('2. Update AmadeusXmlService to use correct endpoint and authentication');
    console.log('3. Test flight search integration');
  } else {
    console.log('❌ Test failed');
    console.log(`   Error: ${result.error}`);
    
    if (result.wsdlUrl) {
      console.log(`   WSDL URL: ${result.wsdlUrl}`);
    }
    
    console.log('\n💡 Troubleshooting:');
    console.log('1. Check if credentials are still valid');
    console.log('2. Verify network connectivity');
    console.log('3. Contact Amadeus support (Rastko) if needed');
  }
}

if (require.main === module) {
  runCorrectEndpointTest().catch(console.error);
}

module.exports = { testCorrectAmadeusEndpoint };