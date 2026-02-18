// v1/test/integration/xmlFlightWorkflow.test.js
const AmadeusXmlService = require('../../services/amadeusXmlService');
const responseAdapter = require('../../utils/responseAdapter');
const xmlParser = require('../../utils/xmlParser');
const XmlErrorHandler = require('../../utils/xmlErrorHandler');

// Mock external dependencies but test real integration between our services
jest.mock('soap');
jest.mock('../../utils/logger', () => ({
  createContextualLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

describe('XML Flight Workflow Integration Tests', () => {
  let amadeusXmlService;
  let mockSoapClient;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock environment variables
    process.env.AMADEUS_XML_ENDPOINT = 'https://test.amadeus.com/soap';
    process.env.AMADEUS_XML_USERNAME = 'test_user';
    process.env.AMADEUS_XML_PASSWORD = 'test_password';
    process.env.AMADEUS_XML_OFFICE_ID = 'TEST123';
    process.env.AMADEUS_XML_TIMEOUT = '30000';
    process.env.AMADEUS_XML_MAX_RETRIES = '2';
    process.env.AMADEUS_XML_POOL_SIZE = '1';

    // Mock SOAP client
    mockSoapClient = {
      setSecurity: jest.fn(),
      Security_Authenticate: jest.fn(),
      Air_FlightSearch: jest.fn(),
      PNR_AddMultiElements: jest.fn()
    };

    // Mock soap module
    const soap = require('soap');
    soap.createClientAsync = jest.fn().mockResolvedValue(mockSoapClient);
    soap.BasicAuthSecurity = jest.fn();

    // Create service instance
    amadeusXmlService = new AmadeusXmlService();
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.AMADEUS_XML_ENDPOINT;
    delete process.env.AMADEUS_XML_USERNAME;
    delete process.env.AMADEUS_XML_PASSWORD;
    delete process.env.AMADEUS_XML_OFFICE_ID;
    delete process.env.AMADEUS_XML_TIMEOUT;
    delete process.env.AMADEUS_XML_MAX_RETRIES;
    delete process.env.AMADEUS_XML_POOL_SIZE;
  });

  describe('End-to-End Flight Search Workflow', () => {
    test('should complete full flight search workflow from XML to JSON', async () => {
      // Mock authentication response
      const mockAuthResponse = `
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
            <Security_AuthenticateReply>
              <processStatus>
                <sessionId>TEST_SESSION_123</sessionId>
                <timeToLive>3600</timeToLive>
              </processStatus>
            </Security_AuthenticateReply>
          </soap:Body>
        </soap:Envelope>
      `;

      // Mock flight search response
      const mockFlightSearchResponse = `
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
            <Air_FlightSearchReply>
              <flightOffers>
                <offer id="OFFER_1">
                  <source>GDS</source>
                  <instantTicketingRequired>false</instantTicketingRequired>
                  <oneWay>false</oneWay>
                  <lastTicketingDate>2024-12-01</lastTicketingDate>
                  <numberOfBookableSeats>5</numberOfBookableSeats>
                  <price>
                    <total>750.00</total>
                    <currency>USD</currency>
                    <base>650.00</base>
                    <fees>
                      <fee type="service" amount="50.00" />
                    </fees>
                    <taxes>
                      <tax type="airport" amount="50.00" />
                    </taxes>
                  </price>
                  <itineraries>
                    <itinerary>
                      <duration>PT5H30M</duration>
                      <segments>
                        <segment>
                          <departure>
                            <iataCode>JFK</iataCode>
                            <terminal>4</terminal>
                            <at>2024-12-01T10:00:00</at>
                          </departure>
                          <arrival>
                            <iataCode>LAX</iataCode>
                            <terminal>1</terminal>
                            <at>2024-12-01T15:30:00</at>
                          </arrival>
                          <carrierCode>AA</carrierCode>
                          <number>123</number>
                          <aircraft>
                            <code>737</code>
                          </aircraft>
                          <duration>PT5H30M</duration>
                          <numberOfStops>0</numberOfStops>
                        </segment>
                      </segments>
                    </itinerary>
                  </itineraries>
                  <validatingAirline>AA</validatingAirline>
                  <travelerPricings>
                    <pricing passengerType="ADT">
                      <price>
                        <total>750.00</total>
                        <currency>USD</currency>
                      </price>
                    </pricing>
                  </travelerPricings>
                </offer>
                <offer id="OFFER_2">
                  <source>GDS</source>
                  <price>
                    <total>850.00</total>
                    <currency>USD</currency>
                    <base>750.00</base>
                  </price>
                  <itineraries>
                    <itinerary>
                      <duration>PT7H15M</duration>
                      <segments>
                        <segment>
                          <departure>
                            <iataCode>JFK</iataCode>
                            <at>2024-12-01T14:00:00</at>
                          </departure>
                          <arrival>
                            <iataCode>DEN</iataCode>
                            <at>2024-12-01T17:00:00</at>
                          </arrival>
                          <carrierCode>UA</carrierCode>
                          <number>456</number>
                        </segment>
                        <segment>
                          <departure>
                            <iataCode>DEN</iataCode>
                            <at>2024-12-01T18:30:00</at>
                          </departure>
                          <arrival>
                            <iataCode>LAX</iataCode>
                            <at>2024-12-01T19:15:00</at>
                          </arrival>
                          <carrierCode>UA</carrierCode>
                          <number>789</number>
                        </segment>
                      </segments>
                    </itinerary>
                  </itineraries>
                </offer>
              </flightOffers>
              <dictionaries>
                <locations>
                  <JFK>
                    <cityCode>NYC</cityCode>
                    <countryCode>US</countryCode>
                  </JFK>
                  <LAX>
                    <cityCode>LAX</cityCode>
                    <countryCode>US</countryCode>
                  </LAX>
                </locations>
                <carriers>
                  <AA>American Airlines</AA>
                  <UA>United Airlines</UA>
                </carriers>
              </dictionaries>
            </Air_FlightSearchReply>
          </soap:Body>
        </soap:Envelope>
      `;

      // Setup SOAP client mocks
      mockSoapClient.Security_Authenticate.mockImplementation((request, callback) => {
        callback(null, null, mockAuthResponse);
      });

      mockSoapClient.Air_FlightSearch.mockImplementation((request, callback) => {
        // Verify the request structure
        expect(request.originDestinationDetails.originDestination).toHaveLength(1);
        expect(request.originDestinationDetails.originDestination[0].departureLocation.locationId).toBe('JFK');
        expect(request.originDestinationDetails.originDestination[0].arrivalLocation.locationId).toBe('LAX');
        expect(request.passengerInfoGrp.passengerInfo.passengerTypeQuantity).toContainEqual({
          code: 'ADT',
          quantity: 1
        });

        callback(null, null, mockFlightSearchResponse);
      });

      // Execute the full workflow
      const searchCriteria = {
        originLocationCode: 'JFK',
        destinationLocationCode: 'LAX',
        departureDate: '2024-12-01',
        adults: 1
      };

      const result = await amadeusXmlService.searchFlightsXml(searchCriteria);

      // Verify the complete workflow
      expect(mockSoapClient.Security_Authenticate).toHaveBeenCalledTimes(1);
      expect(mockSoapClient.Air_FlightSearch).toHaveBeenCalledTimes(1);

      // Verify the final JSON response structure
      expect(result).toHaveProperty('meta');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('dictionaries');

      expect(result.meta.count).toBe(2);
      expect(result.data).toHaveLength(2);

      // Verify first offer transformation
      const firstOffer = result.data[0];
      expect(firstOffer.type).toBe('flight-offer');
      expect(firstOffer.id).toBe('OFFER_1');
      expect(firstOffer.source).toBe('GDS');
      expect(firstOffer.price.total).toBe('750.00');
      expect(firstOffer.price.currency).toBe('USD');
      expect(firstOffer.itineraries).toHaveLength(1);
      expect(firstOffer.itineraries[0].segments).toHaveLength(1);
      expect(firstOffer.itineraries[0].segments[0].departure.iataCode).toBe('JFK');
      expect(firstOffer.itineraries[0].segments[0].arrival.iataCode).toBe('LAX');

      // Verify second offer (with connection)
      const secondOffer = result.data[1];
      expect(secondOffer.id).toBe('OFFER_2');
      expect(secondOffer.itineraries[0].segments).toHaveLength(2); // Connection flight
      expect(secondOffer.itineraries[0].segments[0].arrival.iataCode).toBe('DEN');
      expect(secondOffer.itineraries[0].segments[1].departure.iataCode).toBe('DEN');
    });

    test('should handle authentication failure in workflow', async () => {
      const authError = new Error('Authentication failed');
      mockSoapClient.Security_Authenticate.mockImplementation((request, callback) => {
        callback(authError, null, null);
      });

      const searchCriteria = {
        originLocationCode: 'JFK',
        destinationLocationCode: 'LAX',
        departureDate: '2024-12-01',
        adults: 1
      };

      await expect(amadeusXmlService.searchFlightsXml(searchCriteria)).rejects.toThrow();
      expect(mockSoapClient.Air_FlightSearch).not.toHaveBeenCalled();
    });

    test('should handle SOAP fault in search workflow', async () => {
      // Mock successful authentication
      const mockAuthResponse = `
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
            <Security_AuthenticateReply>
              <processStatus>
                <sessionId>TEST_SESSION_123</sessionId>
                <timeToLive>3600</timeToLive>
              </processStatus>
            </Security_AuthenticateReply>
          </soap:Body>
        </soap:Envelope>
      `;

      mockSoapClient.Security_Authenticate.mockImplementation((request, callback) => {
        callback(null, null, mockAuthResponse);
      });

      // Mock SOAP fault response
      const soapFaultResponse = `
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
            <soap:Fault>
              <faultcode>Server.InvalidRequest</faultcode>
              <faultstring>Invalid search criteria: Origin and destination cannot be the same</faultstring>
              <detail>
                <errorCode>INVALID_ROUTE</errorCode>
                <errorMessage>Origin JFK and destination JFK are identical</errorMessage>
              </detail>
            </soap:Fault>
          </soap:Body>
        </soap:Envelope>
      `;

      mockSoapClient.Air_FlightSearch.mockImplementation((request, callback) => {
        const error = new Error('soap:Fault occurred');
        error.message = soapFaultResponse;
        callback(error, null, null);
      });

      const searchCriteria = {
        originLocationCode: 'JFK',
        destinationLocationCode: 'JFK', // Same origin and destination
        departureDate: '2024-12-01',
        adults: 1
      };

      await expect(amadeusXmlService.searchFlightsXml(searchCriteria)).rejects.toThrow();
    });

    test('should handle empty search results', async () => {
      // Mock authentication
      const mockAuthResponse = `
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
            <Security_AuthenticateReply>
              <processStatus>
                <sessionId>TEST_SESSION_123</sessionId>
                <timeToLive>3600</timeToLive>
              </processStatus>
            </Security_AuthenticateReply>
          </soap:Body>
        </soap:Envelope>
      `;

      // Mock empty search response
      const emptySearchResponse = `
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
            <Air_FlightSearchReply>
              <flightOffers></flightOffers>
              <dictionaries></dictionaries>
            </Air_FlightSearchReply>
          </soap:Body>
        </soap:Envelope>
      `;

      mockSoapClient.Security_Authenticate.mockImplementation((request, callback) => {
        callback(null, null, mockAuthResponse);
      });

      mockSoapClient.Air_FlightSearch.mockImplementation((request, callback) => {
        callback(null, null, emptySearchResponse);
      });

      const searchCriteria = {
        originLocationCode: 'JFK',
        destinationLocationCode: 'XYZ', // Non-existent destination
        departureDate: '2024-12-01',
        adults: 1
      };

      const result = await amadeusXmlService.searchFlightsXml(searchCriteria);

      expect(result.meta.count).toBe(0);
      expect(result.data).toHaveLength(0);
    });
  });

  describe('End-to-End Flight Booking Workflow', () => {
    test('should complete full flight booking workflow from XML to JSON', async () => {
      // Mock authentication response
      const mockAuthResponse = `
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
            <Security_AuthenticateReply>
              <processStatus>
                <sessionId>TEST_SESSION_123</sessionId>
                <timeToLive>3600</timeToLive>
              </processStatus>
            </Security_AuthenticateReply>
          </soap:Body>
        </soap:Envelope>
      `;

      // Mock booking response
      const mockBookingResponse = `
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
            <PNR_Reply>
              <pnrHeader>
                <reservationInfo>
                  <reservation>
                    <controlNumber>ABC123DEF</controlNumber>
                    <date>2024-01-01</date>
                    <time>10:00</time>
                    <status>OK</status>
                  </reservation>
                </reservationInfo>
              </pnrHeader>
              <originDestinationDetails>
                <itineraryInfo>
                  <elementManagementItinerary>
                    <reference>
                      <qualifier>OT</qualifier>
                      <number>1</number>
                    </reference>
                  </elementManagementItinerary>
                  <airAuxItinerary>
                    <travelProduct>
                      <boardpointDetail>
                        <cityCode>JFK</cityCode>
                      </boardpointDetail>
                      <offpointDetail>
                        <cityCode>LAX</cityCode>
                      </offpointDetail>
                      <companyDetail>
                        <identification>AA</identification>
                      </companyDetail>
                      <productDetails>
                        <identification>123</identification>
                        <classOfService>Y</classOfService>
                      </productDetails>
                      <typeDetail>
                        <detail>Flight</detail>
                      </typeDetail>
                    </travelProduct>
                  </airAuxItinerary>
                </itineraryInfo>
              </originDestinationDetails>
              <travellerInfo>
                <elementManagementPassenger>
                  <reference>
                    <qualifier>PR</qualifier>
                    <number>1</number>
                  </reference>
                </elementManagementPassenger>
                <passengerData>
                  <travellerInformation>
                    <traveller>
                      <surname>DOE</surname>
                      <quantity>1</quantity>
                    </traveller>
                    <passenger>
                      <firstName>JOHN</firstName>
                      <type>ADT</type>
                    </passenger>
                  </travellerInformation>
                </passengerData>
              </travellerInfo>
              <dataElementsMaster>
                <marker1>
                  <elementManagementData>
                    <reference>
                      <qualifier>OT</qualifier>
                      <number>2</number>
                    </reference>
                  </elementManagementData>
                  <dataElementsIndiv>
                    <elementManagementData>
                      <segmentName>AP</segmentName>
                    </elementManagementData>
                    <miscellaneousRemark>
                      <remarks>
                        <type>P</type>
                        <category>CTCP</category>
                        <freetext>JOHN.DOE@EMAIL.COM</freetext>
                      </remarks>
                    </miscellaneousRemark>
                  </dataElementsIndiv>
                </marker1>
              </dataElementsMaster>
            </PNR_Reply>
          </soap:Body>
        </soap:Envelope>
      `;

      // Setup SOAP client mocks
      mockSoapClient.Security_Authenticate.mockImplementation((request, callback) => {
        callback(null, null, mockAuthResponse);
      });

      mockSoapClient.PNR_AddMultiElements.mockImplementation((request, callback) => {
        // Verify the booking request structure
        expect(request.pnrActions).toBeDefined();
        expect(request.travellerInfo).toBeDefined();
        expect(request.originDestinationDetails).toBeDefined();

        callback(null, null, mockBookingResponse);
      });

      // Execute the full booking workflow
      const flightOffer = {
        id: 'OFFER_123',
        price: { total: '750.00', currency: 'USD' },
        itineraries: [{
          segments: [{
            departure: { iataCode: 'JFK', at: '2024-12-01T10:00:00' },
            arrival: { iataCode: 'LAX', at: '2024-12-01T15:30:00' },
            carrierCode: 'AA',
            number: '123'
          }]
        }]
      };

      const travelers = [{
        id: 'TRAVELER_1',
        name: { firstName: 'John', lastName: 'Doe' },
        dateOfBirth: '1990-01-01',
        gender: 'M',
        contact: { email: 'john.doe@email.com' },
        documents: [{
          type: 'passport',
          number: '123456789',
          expiryDate: '2030-01-01',
          issuanceCountry: 'US'
        }]
      }];

      const options = {
        contactEmail: 'booking@example.com',
        contactPhone: '+1234567890'
      };

      const result = await amadeusXmlService.bookFlightXml(flightOffer, travelers, options);

      // Verify the complete workflow
      expect(mockSoapClient.Security_Authenticate).toHaveBeenCalledTimes(1);
      expect(mockSoapClient.PNR_AddMultiElements).toHaveBeenCalledTimes(1);

      // Verify the final JSON response structure
      expect(result).toHaveProperty('data');
      expect(result.data.type).toBe('flight-order');
      expect(result.data.id).toBe('ABC123DEF');
      expect(result.data.flightOffers).toHaveLength(1);
      expect(result.data.travelers).toHaveLength(1);

      // Verify traveler information
      const resultTraveler = result.data.travelers[0];
      expect(resultTraveler.name.firstName).toBe('JOHN');
      expect(resultTraveler.name.lastName).toBe('DOE');
    });

    test('should handle booking validation errors', async () => {
      const invalidFlightOffer = null;
      const travelers = [{
        name: { firstName: 'John', lastName: 'Doe' }
      }];

      await expect(amadeusXmlService.bookFlightXml(invalidFlightOffer, travelers))
        .rejects.toThrow();

      expect(mockSoapClient.PNR_AddMultiElements).not.toHaveBeenCalled();
    });

    test('should handle booking SOAP fault', async () => {
      // Mock authentication
      const mockAuthResponse = `
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
            <Security_AuthenticateReply>
              <processStatus>
                <sessionId>TEST_SESSION_123</sessionId>
                <timeToLive>3600</timeToLive>
              </processStatus>
            </Security_AuthenticateReply>
          </soap:Body>
        </soap:Envelope>
      `;

      // Mock booking fault
      const bookingFaultResponse = `
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
            <soap:Fault>
              <faultcode>Server.BookingFailed</faultcode>
              <faultstring>Flight no longer available</faultstring>
              <detail>
                <errorCode>FLIGHT_UNAVAILABLE</errorCode>
                <errorMessage>The selected flight is no longer available for booking</errorMessage>
              </detail>
            </soap:Fault>
          </soap:Body>
        </soap:Envelope>
      `;

      mockSoapClient.Security_Authenticate.mockImplementation((request, callback) => {
        callback(null, null, mockAuthResponse);
      });

      mockSoapClient.PNR_AddMultiElements.mockImplementation((request, callback) => {
        const error = new Error('soap:Fault occurred');
        error.message = bookingFaultResponse;
        callback(error, null, null);
      });

      const flightOffer = {
        id: 'UNAVAILABLE_OFFER',
        price: { total: '750.00', currency: 'USD' },
        itineraries: []
      };

      const travelers = [{
        name: { firstName: 'John', lastName: 'Doe' },
        dateOfBirth: '1990-01-01'
      }];

      await expect(amadeusXmlService.bookFlightXml(flightOffer, travelers)).rejects.toThrow();
    });
  });

  describe('Retry and Error Recovery Workflow', () => {
    test('should retry and recover from transient errors', async () => {
      // Mock authentication (successful)
      const mockAuthResponse = `
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
            <Security_AuthenticateReply>
              <processStatus>
                <sessionId>TEST_SESSION_123</sessionId>
                <timeToLive>3600</timeToLive>
              </processStatus>
            </Security_AuthenticateReply>
          </soap:Body>
        </soap:Envelope>
      `;

      // Mock successful search response
      const mockSearchResponse = `
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
            <Air_FlightSearchReply>
              <flightOffers>
                <offer id="OFFER_1">
                  <price>
                    <total>500.00</total>
                    <currency>USD</currency>
                  </price>
                </offer>
              </flightOffers>
            </Air_FlightSearchReply>
          </soap:Body>
        </soap:Envelope>
      `;

      mockSoapClient.Security_Authenticate.mockImplementation((request, callback) => {
        callback(null, null, mockAuthResponse);
      });

      // Mock transient errors followed by success
      const timeoutError = new Error('ETIMEDOUT');
      timeoutError.code = 'ETIMEDOUT';

      mockSoapClient.Air_FlightSearch
        .mockImplementationOnce((request, callback) => callback(timeoutError))
        .mockImplementationOnce((request, callback) => callback(timeoutError))
        .mockImplementationOnce((request, callback) => callback(null, null, mockSearchResponse));

      const searchCriteria = {
        originLocationCode: 'JFK',
        destinationLocationCode: 'LAX',
        departureDate: '2024-12-01',
        adults: 1
      };

      const result = await amadeusXmlService.searchFlightsXml(searchCriteria);

      // Should have retried and eventually succeeded
      expect(mockSoapClient.Air_FlightSearch).toHaveBeenCalledTimes(3);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('OFFER_1');
    });

    test('should fail after max retries exceeded', async () => {
      // Mock authentication
      const mockAuthResponse = `
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
            <Security_AuthenticateReply>
              <processStatus>
                <sessionId>TEST_SESSION_123</sessionId>
                <timeToLive>3600</timeToLive>
              </processStatus>
            </Security_AuthenticateReply>
          </soap:Body>
        </soap:Envelope>
      `;

      mockSoapClient.Security_Authenticate.mockImplementation((request, callback) => {
        callback(null, null, mockAuthResponse);
      });

      // Mock persistent timeout errors
      const timeoutError = new Error('ETIMEDOUT');
      timeoutError.code = 'ETIMEDOUT';

      mockSoapClient.Air_FlightSearch.mockImplementation((request, callback) => {
        callback(timeoutError);
      });

      const searchCriteria = {
        originLocationCode: 'JFK',
        destinationLocationCode: 'LAX',
        departureDate: '2024-12-01',
        adults: 1
      };

      await expect(amadeusXmlService.searchFlightsXml(searchCriteria)).rejects.toThrow();

      // Should have tried maxRetries + 1 times (initial + 2 retries = 3 total)
      expect(mockSoapClient.Air_FlightSearch).toHaveBeenCalledTimes(3);
    });
  });

  describe('Complex Workflow Scenarios', () => {
    test('should handle round-trip search with multiple passengers', async () => {
      // Mock authentication
      const mockAuthResponse = `
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
            <Security_AuthenticateReply>
              <processStatus>
                <sessionId>TEST_SESSION_123</sessionId>
                <timeToLive>3600</timeToLive>
              </processStatus>
            </Security_AuthenticateReply>
          </soap:Body>
        </soap:Envelope>
      `;

      // Mock round-trip search response
      const mockRoundTripResponse = `
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
            <Air_FlightSearchReply>
              <flightOffers>
                <offer id="ROUNDTRIP_OFFER_1">
                  <price>
                    <total>1500.00</total>
                    <currency>USD</currency>
                  </price>
                  <itineraries>
                    <itinerary>
                      <segments>
                        <segment>
                          <departure>
                            <iataCode>JFK</iataCode>
                            <at>2024-12-01T10:00:00</at>
                          </departure>
                          <arrival>
                            <iataCode>LAX</iataCode>
                            <at>2024-12-01T15:30:00</at>
                          </arrival>
                          <carrierCode>AA</carrierCode>
                          <number>123</number>
                        </segment>
                      </segments>
                    </itinerary>
                    <itinerary>
                      <segments>
                        <segment>
                          <departure>
                            <iataCode>LAX</iataCode>
                            <at>2024-12-08T08:00:00</at>
                          </departure>
                          <arrival>
                            <iataCode>JFK</iataCode>
                            <at>2024-12-08T16:30:00</at>
                          </arrival>
                          <carrierCode>AA</carrierCode>
                          <number>456</number>
                        </segment>
                      </segments>
                    </itinerary>
                  </itineraries>
                  <travelerPricings>
                    <pricing passengerType="ADT">
                      <price>
                        <total>750.00</total>
                        <currency>USD</currency>
                      </price>
                    </pricing>
                    <pricing passengerType="CHD">
                      <price>
                        <total>600.00</total>
                        <currency>USD</currency>
                      </price>
                    </pricing>
                  </travelerPricings>
                </offer>
              </flightOffers>
            </Air_FlightSearchReply>
          </soap:Body>
        </soap:Envelope>
      `;

      mockSoapClient.Security_Authenticate.mockImplementation((request, callback) => {
        callback(null, null, mockAuthResponse);
      });

      mockSoapClient.Air_FlightSearch.mockImplementation((request, callback) => {
        // Verify round-trip request structure
        expect(request.originDestinationDetails.originDestination).toHaveLength(2);
        expect(request.passengerInfoGrp.passengerInfo.passengerTypeQuantity).toContainEqual({
          code: 'ADT',
          quantity: 1
        });
        expect(request.passengerInfoGrp.passengerInfo.passengerTypeQuantity).toContainEqual({
          code: 'CHD',
          quantity: 1
        });

        callback(null, null, mockRoundTripResponse);
      });

      const searchCriteria = {
        originLocationCode: 'JFK',
        destinationLocationCode: 'LAX',
        departureDate: '2024-12-01',
        returnDate: '2024-12-08',
        adults: 1,
        children: 1,
        currencyCode: 'USD'
      };

      const result = await amadeusXmlService.searchFlightsXml(searchCriteria);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].itineraries).toHaveLength(2); // Outbound and return
      expect(result.data[0].price.total).toBe('1500.00');
      expect(result.data[0].travelerPricings).toHaveLength(2); // Adult and child pricing
    });

    test('should handle session expiration and re-authentication', async () => {
      // Mock initial authentication
      const mockAuthResponse = `
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
            <Security_AuthenticateReply>
              <processStatus>
                <sessionId>EXPIRED_SESSION</sessionId>
                <timeToLive>1</timeToLive>
              </processStatus>
            </Security_AuthenticateReply>
          </soap:Body>
        </soap:Envelope>
      `;

      // Mock new authentication after expiration
      const mockNewAuthResponse = `
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
            <Security_AuthenticateReply>
              <processStatus>
                <sessionId>NEW_SESSION_123</sessionId>
                <timeToLive>3600</timeToLive>
              </processStatus>
            </Security_AuthenticateReply>
          </soap:Body>
        </soap:Envelope>
      `;

      const mockSearchResponse = `
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
            <Air_FlightSearchReply>
              <flightOffers>
                <offer id="OFFER_1">
                  <price>
                    <total>500.00</total>
                    <currency>USD</currency>
                  </price>
                </offer>
              </flightOffers>
            </Air_FlightSearchReply>
          </soap:Body>
        </soap:Envelope>
      `;

      mockSoapClient.Security_Authenticate
        .mockImplementationOnce((request, callback) => {
          callback(null, null, mockAuthResponse);
        })
        .mockImplementationOnce((request, callback) => {
          callback(null, null, mockNewAuthResponse);
        });

      mockSoapClient.Air_FlightSearch.mockImplementation((request, callback) => {
        callback(null, null, mockSearchResponse);
      });

      // First search - should use expired session
      const searchCriteria = {
        originLocationCode: 'JFK',
        destinationLocationCode: 'LAX',
        departureDate: '2024-12-01',
        adults: 1
      };

      await amadeusXmlService.searchFlightsXml(searchCriteria);

      // Wait for session to expire (simulate time passing)
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Second search - should re-authenticate
      const result = await amadeusXmlService.searchFlightsXml(searchCriteria);

      expect(mockSoapClient.Security_Authenticate).toHaveBeenCalledTimes(2);
      expect(result.data[0].id).toBe('OFFER_1');
    });
  });
});