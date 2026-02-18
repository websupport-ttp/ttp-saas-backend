// Test Amadeus with exact XML format from documentation
const soap = require('soap');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function testExactFormat() {
  console.log('📋 Testing Amadeus with Exact Documentation Format...\n');
  
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
    
    // Build request exactly like the documentation example
    const exactRequest = {
      'OTA_AirLowFareSearchPlusRQ': {
        'POS': {
          'Source': {
            attributes: {
              'PseudoCityCode': config.officeId
            },
            'RequestorID': {
              attributes: {
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
        'OriginDestinationInformation': {
          'DepartureDateTime': '2024-12-15T00:00:00',
          'OriginLocation': {
            attributes: {
              'LocationCode': 'LOS'
            }
          },
          'DestinationLocation': {
            attributes: {
              'LocationCode': 'JFK'
            }
          }
        },
        'TravelPreferences': {
          'CabinPref': {
            attributes: {
              'Cabin': 'Economy'
            }
          }
        },
        'TravelerInfoSummary': {
          'SeatsRequested': '1',
          'AirTravelerAvail': {
            'PassengerTypeQuantity': {
              attributes: {
                'Code': 'ADT',
                'Quantity': '1'
              }
            }
          }
        }
      }
    };
    
    console.log('\n✈️ Making flight search request with exact format...');
    console.log('📤 Request structure:', JSON.stringify(exactRequest, null, 2));
    
    try {
      const result = await client.wmLowFarePlusXmlAsync(exactRequest);
      console.log('\n🎉 SUCCESS! Request accepted by Amadeus!');
      console.log('📄 Response:', JSON.stringify(result, null, 2));
      return { success: true, result };
      
    } catch (searchError) {
      console.error('\n❌ Search failed:', searchError.message);
      
      // Try alternative attribute format
      console.log('\n🔄 Trying alternative attribute format...');
      
      const altRequest = {
        'OTA_AirLowFareSearchPlusRQ': {
          'POS': {
            'Source': {
              '$': {
                'PseudoCityCode': config.officeId
              },
              'RequestorID': {
                '$': {
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
          'OriginDestinationInformation': {
            'DepartureDateTime': '2024-12-15T00:00:00',
            'OriginLocation': {
              '$': {
                'LocationCode': 'LOS'
              }
            },
            'DestinationLocation': {
              '$': {
                'LocationCode': 'JFK'
              }
            }
          },
          'TravelPreferences': {
            'CabinPref': {
              '$': {
                'Cabin': 'Economy'
              }
            }
          },
          'TravelerInfoSummary': {
            'SeatsRequested': '1',
            'AirTravelerAvail': {
              'PassengerTypeQuantity': {
                '$': {
                  'Code': 'ADT',
                  'Quantity': '1'
                }
              }
            }
          }
        }
      };
      
      try {
        const altResult = await client.wmLowFarePlusXmlAsync(altRequest);
        console.log('✅ Alternative format worked!');
        console.log('📄 Response:', JSON.stringify(altResult, null, 2));
        return { success: true, result: altResult, format: 'alternative' };
        
      } catch (altError) {
        console.error('❌ Alternative format also failed:', altError.message);
        
        if (altError.response) {
          console.error('📄 Response Status:', altError.response.status);
          console.error('📄 Response Headers:', JSON.stringify(altError.response.headers, null, 2));
        }
        
        if (altError.body) {
          console.error('📄 Response Body:', altError.body);
        }
        
        return { success: false, error: altError.message };
      }
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function runExactFormatTest() {
  console.log('🚀 Starting Exact Format Test...\n');
  
  const result = await testExactFormat();
  
  console.log('\n📋 Exact Format Test Summary:');
  
  if (result.success) {
    console.log('✅ SUCCESS! Exact format worked!');
    
    if (result.format) {
      console.log(`✅ Working format: ${result.format}`);
    }
    
    console.log('\n💡 Next steps:');
    console.log('1. Update AmadeusXmlService with working format');
    console.log('2. Fix client pool issue');
    console.log('3. Test full integration');
  } else {
    console.log('❌ Exact format test failed');
    console.log(`   Error: ${result.error}`);
    
    console.log('\n💡 This suggests the request format still needs adjustment');
    console.log('💡 May need to contact Amadeus support for exact XML format requirements');
  }
}

if (require.main === module) {
  runExactFormatTest().catch(console.error);
}

module.exports = { testExactFormat };