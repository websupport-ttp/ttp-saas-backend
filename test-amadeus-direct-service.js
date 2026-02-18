// Direct test of Amadeus service bypassing client pool
const soap = require('soap');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Import response adapter to test the full flow
const responseAdapter = require('./v1/utils/responseAdapter');

async function testDirectAmadeusService() {
  console.log('🎯 Testing Direct Amadeus Service Call...\n');
  
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
    
    // Create SOAP client directly (like our working test)
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
    
    // Build request with proper XML attributes (from our working test)
    const searchRequest = {
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
    
    console.log('\n✈️ Making flight search request...');
    const startTime = Date.now();
    
    // Use the working method
    const rawResponse = await client.wmLowFarePlusXmlAsync(searchRequest);
    const duration = Date.now() - startTime;
    
    console.log(`✅ SOAP call completed in ${duration}ms`);
    console.log('📄 Raw response type:', typeof rawResponse);
    console.log('📄 Raw response keys:', Object.keys(rawResponse[0] || {}));
    
    // Try to parse the response
    if (rawResponse && rawResponse[0] && rawResponse[0].wmLowFarePlusXmlResult) {
      const xmlResult = rawResponse[0].wmLowFarePlusXmlResult;
      console.log('✅ Got XML result from Amadeus');
      
      // Try to parse the XML result
      try {
        console.log('\n🔄 Attempting to parse XML response...');
        
        // The response might be XML string that needs parsing
        if (typeof xmlResult === 'string') {
          console.log('📄 Response is XML string, length:', xmlResult.length);
          console.log('📄 XML preview:', xmlResult.substring(0, 200) + '...');
          
          // Try to parse with xml2js or similar
          const xml2js = require('xml2js');
          const parser = new xml2js.Parser({ explicitArray: false });
          const parsedXml = await parser.parseStringPromise(xmlResult);
          
          console.log('✅ XML parsed successfully');
          console.log('📋 Parsed XML keys:', Object.keys(parsedXml));
          
          if (parsedXml.OTA_AirLowFareSearchPlusRS) {
            const response = parsedXml.OTA_AirLowFareSearchPlusRS;
            console.log('✅ Found OTA_AirLowFareSearchPlusRS');
            
            if (response.PricedItineraries) {
              console.log('🎉 SUCCESS! Found flight itineraries!');
              const itineraries = Array.isArray(response.PricedItineraries.PricedItinerary) 
                ? response.PricedItineraries.PricedItinerary 
                : [response.PricedItineraries.PricedItinerary];
              
              console.log(`📊 Number of itineraries: ${itineraries.length}`);
              
              if (itineraries.length > 0) {
                const firstItinerary = itineraries[0];
                console.log('\n📋 First Itinerary Details:');
                
                if (firstItinerary.AirItineraryPricingInfo) {
                  const pricing = firstItinerary.AirItineraryPricingInfo;
                  if (pricing.ItinTotalFare) {
                    console.log(`💰 Total Fare: ${pricing.ItinTotalFare.TotalFare?.Amount} ${pricing.ItinTotalFare.TotalFare?.CurrencyCode}`);
                    console.log(`💰 Base Fare: ${pricing.ItinTotalFare.BaseFare?.Amount} ${pricing.ItinTotalFare.BaseFare?.CurrencyCode}`);
                  }
                }
                
                if (firstItinerary.AirItinerary?.OriginDestinationOptions) {
                  console.log('✈️ Flight segments found');
                }
              }
              
              return { success: true, itineraries: itineraries.length, rawResponse: parsedXml };
            }
            
            if (response.Errors) {
              console.log('⚠️  Response contains errors:', response.Errors);
              return { success: false, error: 'Amadeus returned errors', details: response.Errors };
            }
          }
        } else {
          console.log('📄 Response is object:', typeof xmlResult);
          console.log('📄 Object keys:', Object.keys(xmlResult));
        }
        
      } catch (parseError) {
        console.error('❌ Failed to parse XML response:', parseError.message);
        return { success: false, error: 'XML parsing failed', details: parseError.message };
      }
    }
    
    return { success: true, message: 'SOAP call successful but no flight data found' };
    
  } catch (error) {
    console.error('\n❌ Direct service test failed:', error.message);
    
    if (error.response) {
      console.error('📄 SOAP Response Status:', error.response.status);
      console.error('📄 SOAP Response Headers:', JSON.stringify(error.response.headers, null, 2));
    }
    
    if (error.body) {
      console.error('📄 Full Response Body:');
      console.error(error.body);
    }
    
    if (error.request) {
      console.error('📤 Request that was sent:');
      console.error(error.request.data?.substring(0, 1000) + '...');
    }
    
    return { success: false, error: error.message };
  }
}

async function runDirectServiceTest() {
  console.log('🚀 Starting Direct Amadeus Service Test...\n');
  
  const result = await testDirectAmadeusService();
  
  console.log('\n📋 Direct Service Test Summary:');
  
  if (result.success) {
    console.log('✅ SUCCESS! Direct Amadeus service call worked!');
    
    if (result.itineraries) {
      console.log(`🎉 Found ${result.itineraries} flight itineraries!`);
      console.log('💡 Amadeus is returning real flight data!');
    }
    
    console.log('\n💡 Next steps:');
    console.log('1. Fix the AmadeusXmlService client pool issue');
    console.log('2. Update response parsing to handle Amadeus XML format');
    console.log('3. Test full integration');
  } else {
    console.log('❌ Direct service test failed');
    console.log(`   Error: ${result.error}`);
    
    if (result.details) {
      console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`);
    }
  }
}

if (require.main === module) {
  runDirectServiceTest().catch(console.error);
}

module.exports = { testDirectAmadeusService };