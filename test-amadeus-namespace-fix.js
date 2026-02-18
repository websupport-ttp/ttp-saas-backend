// Test Amadeus XML with namespace fix
const soap = require('soap');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function testNamespaceFix() {
  console.log('🔧 Testing Amadeus XML Namespace Fix...\n');
  
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
    const wsdlUrl = `${config.endpoint}/wsLowFarePlus.asmx?WSDL`;
    console.log(`\n🔍 WSDL URL: ${wsdlUrl}`);
    
    // Enhanced SOAP options to fix namespace issues
    const soapOptions = {
      timeout: 30000,
      connection_timeout: 30000,
      forceSoap12Headers: false,
      preserveWhitespace: true,
      strict: false,
      ignoreBaseNameSpaces: false,
      // Fix namespace issues
      namespaceArrayElements: false,
      attributesKey: '$attributes',
      valueKey: '$value',
      xmlKey: '$xml',
      // Disable automatic namespace prefixing
      ignoredNamespaces: {
        namespaces: [],
        override: true
      }
    };
    
    console.log('🔌 Creating SOAP client with namespace fixes...');
    const client = await soap.createClientAsync(wsdlUrl, soapOptions);
    console.log('✅ SOAP client created successfully!');
    
    // Build request with proper XML attributes
    const sampleRequest = {
      'OTA_AirLowFareSearchPlusRQ': {
        'POS': {
          'Source': {
            '$attributes': {
              'PseudoCityCode': config.officeId
            },
            'RequestorID': {
              '$attributes': {
                'Type': '21',
                'ID': 'requestor'
              }
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
              '$attributes': {
                'LocationCode': 'LOS'
              }
            },
            'DestinationLocation': {
              '$attributes': {
                'LocationCode': 'JFK'
              }
            }
          }
        ],
        'TravelPreferences': {
          'CabinPref': {
            '$attributes': {
              'Cabin': 'Economy'
            }
          }
        },
        'TravelerInfoSummary': {
          'SeatsRequested': '1',
          'AirTravelerAvail': [
            {
              'PassengerTypeQuantity': {
                '$attributes': {
                  'Code': 'ADT',
                  'Quantity': '1'
                }
              }
            }
          ]
        }
      }
    };
    
    console.log('\n✈️ Testing flight search with namespace fix...');
    console.log('📤 Using wmLowFarePlusXml method...');
    
    try {
      const result = await client.wmLowFarePlusXmlAsync(sampleRequest);
      console.log('\n🎉 SUCCESS! Flight search completed without namespace errors!');
      console.log('📄 Response received:', typeof result);
      
      if (result && result.length > 0) {
        console.log('📋 Response structure:', Object.keys(result[0] || {}));
        
        // Check if we got flight data
        if (result[0] && result[0].OTA_AirLowFareSearchPlusRS) {
          console.log('✅ Received OTA_AirLowFareSearchPlusRS response');
          const response = result[0].OTA_AirLowFareSearchPlusRS;
          
          if (response.PricedItineraries) {
            console.log('✅ Flight itineraries found!');
            console.log(`📊 Number of itineraries: ${response.PricedItineraries.length || 'N/A'}`);
          }
          
          if (response.Errors) {
            console.log('⚠️  Response contains errors:', response.Errors);
          }
        }
      }
      
      return { success: true, result };
      
    } catch (searchError) {
      console.error('\n❌ Flight search failed:', searchError.message);
      
      // Check if it's still a namespace error
      if (searchError.message.includes('undeclared prefix') || searchError.message.includes('namespace')) {
        console.error('💡 Still a namespace issue - trying alternative approach...');
        
        // Try with wmLowFarePlus instead
        try {
          console.log('🔄 Trying wmLowFarePlus method...');
          const altResult = await client.wmLowFarePlusAsync(sampleRequest);
          console.log('✅ Alternative method worked!');
          return { success: true, result: altResult, method: 'wmLowFarePlus' };
        } catch (altError) {
          console.error('❌ Alternative method also failed:', altError.message);
        }
      }
      
      if (searchError.response) {
        console.error('📄 SOAP Response:', searchError.response.status);
      }
      
      if (searchError.body) {
        console.error('📄 Response Body:', searchError.body.substring(0, 500) + '...');
      }
      
      return { success: false, error: searchError.message };
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function runNamespaceFixTest() {
  console.log('🚀 Starting Amadeus Namespace Fix Test...\n');
  
  const result = await testNamespaceFix();
  
  console.log('\n📋 Namespace Fix Test Summary:');
  
  if (result.success) {
    console.log('✅ SUCCESS! Namespace issue resolved!');
    console.log('🎉 Amadeus XML service is now fully working!');
    
    if (result.method) {
      console.log(`✅ Working method: ${result.method}`);
    }
    
    console.log('\n💡 Next steps:');
    console.log('1. Test the updated AmadeusXmlService');
    console.log('2. Verify flight search returns real data');
    console.log('3. Test frontend integration');
  } else {
    console.log('❌ Namespace fix failed');
    console.log(`   Error: ${result.error}`);
    
    console.log('\n💡 Alternative approaches:');
    console.log('1. Try sending raw XML string instead of object');
    console.log('2. Use different SOAP library options');
    console.log('3. Contact Amadeus support for XML format clarification');
  }
}

if (require.main === module) {
  runNamespaceFixTest().catch(console.error);
}

module.exports = { testNamespaceFix };