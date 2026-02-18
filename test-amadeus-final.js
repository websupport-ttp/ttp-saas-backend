// Final test of Amadeus XML with correct implementation
const soap = require('soap');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function testAmadeusFinal() {
  console.log('🎯 Final Amadeus XML Test with Correct Implementation...\n');
  
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
  
  try {
    // Correct WSDL URL from documentation
    const wsdlUrl = `${config.endpoint}/wsLowFarePlus.asmx?WSDL`;
    console.log(`\n🔍 WSDL URL: ${wsdlUrl}`);
    
    // Create SOAP client
    console.log('🔌 Creating SOAP client...');
    const client = await soap.createClientAsync(wsdlUrl, {
      timeout: 30000,
      connection_timeout: 30000,
      forceSoap12Headers: false,
      preserveWhitespace: true,
      strict: false,
      ignoreBaseNameSpaces: false
    });
    
    console.log('✅ SOAP client created successfully!');
    
    // Get available methods
    const description = client.describe();
    console.log('\n📋 Available Services and Methods:');
    
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
    
    // Build sample request based on documentation
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
    
    console.log('\n✈️ Testing flight search...');
    console.log('📤 Request:', JSON.stringify(sampleRequest, null, 2));
    
    // Try to call the correct method (wmLowFarePlus)
    try {
      const result = await client.wmLowFarePlusAsync(sampleRequest);
      console.log('\n🎉 SUCCESS! Flight search completed!');
      console.log('📄 Response:', JSON.stringify(result, null, 2));
      
      return { success: true, result };
      
    } catch (searchError) {
      console.error('\n❌ Flight search failed:', searchError.message);
      
      if (searchError.response) {
        console.error('📄 SOAP Response:', searchError.response);
      }
      
      if (searchError.body) {
        console.error('📄 Response Body:', searchError.body);
      }
      
      // Check for authentication errors
      if (searchError.message.includes('401') || searchError.message.includes('Unauthorized')) {
        console.error('💡 Authentication failed - check credentials with Amadeus support');
      } else if (searchError.message.includes('SOAP')) {
        console.error('💡 SOAP error - check request format');
      }
      
      return { success: false, error: searchError.message };
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    if (error.code) {
      console.error('❌ Error Code:', error.code);
    }
    
    return { success: false, error: error.message };
  }
}

async function runFinalTest() {
  console.log('🚀 Starting Final Amadeus XML Test...\n');
  
  const result = await testAmadeusFinal();
  
  console.log('\n📋 Final Test Summary:');
  
  if (result.success) {
    console.log('✅ SUCCESS! Amadeus XML service is working correctly!');
    console.log('🎉 Your flight search should now return real Amadeus data!');
    console.log('\n💡 Next steps:');
    console.log('1. The AmadeusXmlService has been updated with correct endpoints');
    console.log('2. Test your frontend flight search');
    console.log('3. Verify real flight data is returned');
  } else {
    console.log('❌ Test failed');
    console.log(`   Error: ${result.error}`);
    console.log('\n💡 Troubleshooting:');
    console.log('1. Verify credentials are still active with Amadeus support (Rastko)');
    console.log('2. Check if IP whitelisting is required');
    console.log('3. Confirm test environment is accessible');
  }
}

if (require.main === module) {
  runFinalTest().catch(console.error);
}

module.exports = { testAmadeusFinal };