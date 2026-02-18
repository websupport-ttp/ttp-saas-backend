// Test Amadeus with complete request format
const soap = require('soap');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function testCompleteRequest() {
  console.log('🎯 Testing Amadeus with Complete Request Format...\n');
  
  const config = {
    endpoint: process.env.AMADEUS_XML_ENDPOINT,
    username: process.env.AMADEUS_XML_USERNAME,
    password: process.env.AMADEUS_XML_PASSWORD,
    officeId: process.env.AMADEUS_XML_OFFICE_ID
  };
  
  try {
    const wsdlUrl = `${config.endpoint}/wsLowFarePlus.asmx?WSDL`;
    console.log(`🔍 WSDL URL: ${wsdlUrl}`);
    
    const client = await soap.createClientAsync(wsdlUrl, {
      timeout: 30000,
      connection_timeout: 30000,
      forceSoap12Headers: false,
      preserveWhitespace: true,
      strict: false,
      ignoreBaseNameSpaces: false
    });
    
    console.log('✅ SOAP client created successfully!');
    
    // Complete request based on documentation example
    const completeRequest = {
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
        'OriginDestinationInformation': [
          {
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
          }
        ],
        'TravelPreferences': {
          'CabinPref': {
            attributes: {
              'Cabin': 'Economy'
            }
          }
        },
        'TravelerInfoSummary': {
          'SeatsRequested': '1',
          'AirTravelerAvail': [
            {
              'PassengerTypeQuantity': {
                attributes: {
                  'Code': 'ADT',
                  'Quantity': '1'
                }
              }
            }
          ]
        }
      }
    };
    
    console.log('\n✈️ Making complete flight search request...');
    
    const result = await client.wmLowFarePlusXmlAsync(completeRequest);
    console.log('\n📄 Raw Response:', JSON.stringify(result, null, 2));
    
    // Parse the XML response
    if (result && result[0] && result[0].wmLowFarePlusXmlResult) {
      const xmlResult = result[0].wmLowFarePlusXmlResult;
      console.log('\n🔄 Parsing XML response...');
      
      const xml2js = require('xml2js');
      const parser = new xml2js.Parser({ explicitArray: false });
      const parsedXml = await parser.parseStringPromise(xmlResult);
      
      console.log('📋 Parsed XML:', JSON.stringify(parsedXml, null, 2));
      
      if (parsedXml.OTA_AirLowFareSearchPlusRS) {
        const response = parsedXml.OTA_AirLowFareSearchPlusRS;
        
        if (response.Errors) {
          console.log('⚠️  Amadeus returned errors:');
          const errors = Array.isArray(response.Errors.Error) ? response.Errors.Error : [response.Errors.Error];
          errors.forEach(error => {
            console.log(`   - Type: ${error.$.Type}, Message: ${error._}`);
          });
          
          // Try a simpler request format
          console.log('\n🔄 Trying simpler request format...');
          
          const simpleRequest = {
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
                    'LocationCode': 'MIA'  // Use MIA like in documentation
                  }
                },
                'DestinationLocation': {
                  attributes: {
                    'LocationCode': 'NCE'  // Use NCE like in documentation
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
          
          try {
            const simpleResult = await client.wmLowFarePlusXmlAsync(simpleRequest);
            console.log('✅ Simple request worked!');
            
            if (simpleResult && simpleResult[0] && simpleResult[0].wmLowFarePlusXmlResult) {
              const simpleXmlResult = simpleResult[0].wmLowFarePlusXmlResult;
              const simpleParsedXml = await parser.parseStringPromise(simpleXmlResult);
              
              console.log('📋 Simple Response:', JSON.stringify(simpleParsedXml, null, 2));
              
              if (simpleParsedXml.OTA_AirLowFareSearchPlusRS && simpleParsedXml.OTA_AirLowFareSearchPlusRS.PricedItineraries) {
                console.log('🎉 SUCCESS! Got flight itineraries!');
                return { success: true, result: simpleParsedXml, format: 'simple' };
              }
            }
            
          } catch (simpleError) {
            console.error('❌ Simple request also failed:', simpleError.message);
          }
          
        } else if (response.PricedItineraries) {
          console.log('🎉 SUCCESS! Got flight itineraries!');
          return { success: true, result: parsedXml };
        }
      }
    }
    
    return { success: false, error: 'No flight data found' };
    
  } catch (error) {
    console.error('\n❌ Complete request test failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function runCompleteTest() {
  console.log('🚀 Starting Complete Request Test...\n');
  
  const result = await testCompleteRequest();
  
  console.log('\n📋 Complete Request Test Summary:');
  
  if (result.success) {
    console.log('✅ SUCCESS! Complete request worked!');
    
    if (result.format) {
      console.log(`✅ Working format: ${result.format}`);
    }
    
    console.log('🎉 Amadeus is returning real flight data!');
    console.log('\n💡 Next steps:');
    console.log('1. Update AmadeusXmlService with working request format');
    console.log('2. Implement proper response parsing');
    console.log('3. Test full integration');
  } else {
    console.log('❌ Complete request test failed');
    console.log(`   Error: ${result.error}`);
    
    console.log('\n💡 The SOAP connection is working, but request format needs refinement');
    console.log('💡 May need to adjust specific fields or use different airport codes');
  }
}

if (require.main === module) {
  runCompleteTest().catch(console.error);
}

module.exports = { testCompleteRequest };