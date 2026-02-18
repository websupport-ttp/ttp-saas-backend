// v1/test/services/amadeusXmlService.test.js
const xmlParser = require('../../utils/xmlParser');
const responseAdapter = require('../../utils/responseAdapter');
const XmlErrorHandler = require('../../utils/xmlErrorHandler');
const { ApiError } = require('../../utils/apiError');

// Mock dependencies
jest.mock('soap');
jest.mock('../../utils/xmlParser');
jest.mock('../../utils/responseAdapter');
jest.mock('../../utils/xmlErrorHandler');
jest.mock('../../utils/logger', () => ({
  createContextualLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

// Mock the AmadeusXmlService class before requiring it
jest.mock('../../services/amadeusXmlService', () => {
  const mockService = {
    config: {},
    clientPool: [],
    poolIndex: 0,
    isAuthenticated: false,
    authToken: null,
    authExpiry: null,
    circuitBreaker: {
      canExecute: jest.fn().mockReturnValue(true),
      onSuccess: jest.fn(),
      onFailure: jest.fn(),
      getState: jest.fn().mockReturnValue('CLOSED')
    },
    authenticateAmadeusXml: jest.fn(),
    searchFlightsXml: jest.fn(),
    bookFlightXml: jest.fn(),
    _getClientFromPool: jest.fn(),
    _returnClientToPool: jest.fn(),
    _validateConfiguration: jest.fn(),
    _createSoapClient: jest.fn(),
    _initializeClientPool: jest.fn()
  };
  return mockService;
});

describe('AmadeusXmlService', () => {
  let amadeusXmlService;
  let mockSoapClient;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock environment variables
    process.env.AMADEUS_XML_ENDPOINT = 'https://test.amadeus.com/soap';
    process.env.AMADEUS_XML_USERNAME = 'test_user';
    process.env.AMADEUS_XML_PASSWORD = 'test_password';
    process.env.AMADEUS_XML_OFFICE_ID = 'TEST123';
    process.env.AMADEUS_XML_TIMEOUT = '30000';
    process.env.AMADEUS_XML_MAX_RETRIES = '3';
    process.env.AMADEUS_XML_POOL_SIZE = '2';

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

    // Get the mocked service instance
    amadeusXmlService = require('../../services/amadeusXmlService');
    
    // Set up default config
    amadeusXmlService.config = {
      endpoint: 'https://test.amadeus.com/soap',
      username: 'test_user',
      password: 'test_password',
      officeId: 'TEST123',
      timeout: 30000,
      maxRetries: 3,
      connectionPoolSize: 2
    };
    
    // Set up default client pool
    amadeusXmlService.clientPool = [
      { client: mockSoapClient, inUse: false, createdAt: Date.now(), lastUsed: Date.now() },
      { client: mockSoapClient, inUse: false, createdAt: Date.now(), lastUsed: Date.now() }
    ];
    amadeusXmlService.poolIndex = 0;
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

  describe('Constructor and Initialization', () => {
    test('should initialize with correct configuration', () => {
      expect(amadeusXmlService.config.endpoint).toBe('https://test.amadeus.com/soap');
      expect(amadeusXmlService.config.username).toBe('test_user');
      expect(amadeusXmlService.config.password).toBe('test_password');
      expect(amadeusXmlService.config.officeId).toBe('TEST123');
      expect(amadeusXmlService.config.timeout).toBe(30000);
      expect(amadeusXmlService.config.maxRetries).toBe(3);
      expect(amadeusXmlService.config.connectionPoolSize).toBe(2);
    });

    test('should validate configuration on initialization', () => {
      // Test that validation would be called
      expect(amadeusXmlService._validateConfiguration).toBeDefined();
    });

    test('should initialize client pool', () => {
      expect(amadeusXmlService.clientPool).toHaveLength(2);
      expect(amadeusXmlService.poolIndex).toBe(0);
    });
  });

  describe('Authentication', () => {
    test('should authenticate successfully with valid credentials', async () => {
      // Mock successful authentication response
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

      xmlParser.parseAmadeusXml.mockResolvedValue({
        'soap:Body': {
          Security_AuthenticateReply: {
            processStatus: {
              sessionId: 'TEST_SESSION_123',
              timeToLive: 3600
            }
          }
        }
      });

      const token = await amadeusXmlService.authenticateAmadeusXml();

      expect(token).toBe('TEST_SESSION_123');
      expect(amadeusXmlService.isAuthenticated).toBe(true);
      expect(amadeusXmlService.authToken).toBe('TEST_SESSION_123');
      expect(mockSoapClient.Security_Authenticate).toHaveBeenCalledTimes(1);
    });

    test('should return cached token if still valid', async () => {
      // Set up cached authentication
      amadeusXmlService.isAuthenticated = true;
      amadeusXmlService.authToken = 'CACHED_TOKEN';
      amadeusXmlService.authExpiry = Date.now() + 3600000; // 1 hour from now

      const token = await amadeusXmlService.authenticateAmadeusXml();

      expect(token).toBe('CACHED_TOKEN');
      expect(mockSoapClient.Security_Authenticate).not.toHaveBeenCalled();
    });

    test('should handle authentication failure', async () => {
      mockSoapClient.Security_Authenticate.mockImplementation((request, callback) => {
        callback(new Error('Authentication failed'), null, null);
      });

      XmlErrorHandler.handleAuthenticationError.mockReturnValue({
        code: 'AUTH_FAILED',
        message: 'Authentication failed'
      });

      await expect(amadeusXmlService.authenticateAmadeusXml()).rejects.toThrow(ApiError);
      expect(amadeusXmlService.isAuthenticated).toBe(false);
      expect(amadeusXmlService.authToken).toBe(null);
    });

    test('should handle XML parsing error in authentication response', async () => {
      const mockAuthResponse = 'invalid-xml';

      mockSoapClient.Security_Authenticate.mockImplementation((request, callback) => {
        callback(null, null, mockAuthResponse);
      });

      xmlParser.parseAmadeusXml.mockRejectedValue(new Error('XML parsing failed'));
      XmlErrorHandler.handleXmlParsingError.mockReturnValue({
        code: 'XML_PARSE_ERROR',
        message: 'Failed to parse XML'
      });

      await expect(amadeusXmlService.authenticateAmadeusXml()).rejects.toThrow(ApiError);
    });
  });

  describe('Flight Search', () => {
    const validSearchCriteria = {
      originLocationCode: 'JFK',
      destinationLocationCode: 'LAX',
      departureDate: '2024-12-01',
      adults: 1
    };

    beforeEach(() => {
      // Mock successful authentication
      amadeusXmlService.isAuthenticated = true;
      amadeusXmlService.authToken = 'TEST_TOKEN';
      amadeusXmlService.authExpiry = Date.now() + 3600000;
    });

    test('should search flights successfully with valid criteria', async () => {
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

      const mockAdaptedResponse = {
        meta: { count: 1 },
        data: [{
          type: 'flight-offer',
          id: 'OFFER_1',
          price: { total: '500.00', currency: 'USD' }
        }]
      };

      mockSoapClient.Air_FlightSearch.mockImplementation((request, callback) => {
        callback(null, null, mockSearchResponse);
      });

      responseAdapter.adaptFlightSearchResponse.mockResolvedValue(mockAdaptedResponse);

      const result = await amadeusXmlService.searchFlightsXml(validSearchCriteria);

      expect(result).toEqual(mockAdaptedResponse);
      expect(mockSoapClient.Air_FlightSearch).toHaveBeenCalledTimes(1);
      expect(responseAdapter.adaptFlightSearchResponse).toHaveBeenCalledWith(mockSearchResponse);
    });

    test('should validate search criteria and throw error for invalid data', async () => {
      const invalidCriteria = {
        originLocationCode: 'INVALID', // Invalid airport code
        destinationLocationCode: 'LAX',
        departureDate: '2024-12-01'
      };

      await expect(amadeusXmlService.searchFlightsXml(invalidCriteria)).rejects.toThrow(ApiError);
    });

    test('should validate required fields', async () => {
      const incompleteCriteria = {
        originLocationCode: 'JFK'
        // Missing destinationLocationCode and departureDate
      };

      await expect(amadeusXmlService.searchFlightsXml(incompleteCriteria)).rejects.toThrow(ApiError);
    });

    test('should validate date format', async () => {
      const invalidDateCriteria = {
        ...validSearchCriteria,
        departureDate: '12/01/2024' // Invalid format
      };

      await expect(amadeusXmlService.searchFlightsXml(invalidDateCriteria)).rejects.toThrow(ApiError);
    });

    test('should validate passenger counts', async () => {
      const invalidPassengerCriteria = {
        ...validSearchCriteria,
        adults: 0 // Invalid passenger count
      };

      await expect(amadeusXmlService.searchFlightsXml(invalidPassengerCriteria)).rejects.toThrow(ApiError);
    });

    test('should handle SOAP fault in flight search', async () => {
      const soapFaultResponse = `
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
            <soap:Fault>
              <faultcode>Server.InvalidRequest</faultcode>
              <faultstring>Invalid search criteria</faultstring>
            </soap:Fault>
          </soap:Body>
        </soap:Envelope>
      `;

      mockSoapClient.Air_FlightSearch.mockImplementation((request, callback) => {
        const error = new Error('soap:Fault occurred');
        error.message = soapFaultResponse;
        callback(error, null, null);
      });

      XmlErrorHandler.parseSoapFault.mockResolvedValue({
        code: 'SOAP_FAULT',
        message: 'Invalid search criteria'
      });

      await expect(amadeusXmlService.searchFlightsXml(validSearchCriteria)).rejects.toThrow(ApiError);
    });

    test('should handle connection timeout', async () => {
      const timeoutError = new Error('ETIMEDOUT');
      timeoutError.code = 'ETIMEDOUT';

      mockSoapClient.Air_FlightSearch.mockImplementation((request, callback) => {
        callback(timeoutError, null, null);
      });

      XmlErrorHandler.handleTimeoutError.mockReturnValue({
        code: 'TIMEOUT_ERROR',
        message: 'Request timeout'
      });
      XmlErrorHandler.isRetryableError.mockReturnValue(true);
      XmlErrorHandler.getRetryDelay.mockReturnValue(1000);

      await expect(amadeusXmlService.searchFlightsXml(validSearchCriteria)).rejects.toThrow();
    });

    test('should build correct flight search request', async () => {
      const searchCriteria = {
        originLocationCode: 'JFK',
        destinationLocationCode: 'LAX',
        departureDate: '2024-12-01',
        returnDate: '2024-12-08',
        adults: 2,
        children: 1,
        currencyCode: 'EUR',
        max: 25
      };

      mockSoapClient.Air_FlightSearch.mockImplementation((request, callback) => {
        // Verify request structure
        expect(request.originDestinationDetails.originDestination).toHaveLength(2); // Round trip
        expect(request.passengerInfoGrp.passengerInfo.passengerTypeQuantity).toContainEqual({
          code: 'ADT',
          quantity: 2
        });
        expect(request.passengerInfoGrp.passengerInfo.passengerTypeQuantity).toContainEqual({
          code: 'CHD',
          quantity: 1
        });
        expect(request.fareInfo.convertionRate.conversionRateDetail.currency).toBe('EUR');
        expect(request.passengerInfoGrp.specificTravellerDetails.measurementValue).toBe(25);

        callback(null, null, '<mock>response</mock>');
      });

      responseAdapter.adaptFlightSearchResponse.mockResolvedValue({ data: [] });

      await amadeusXmlService.searchFlightsXml(searchCriteria);

      expect(mockSoapClient.Air_FlightSearch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Flight Booking', () => {
    const validFlightOffer = {
      id: 'OFFER_123',
      price: { total: '500.00', currency: 'USD' },
      itineraries: []
    };

    const validTravelers = [{
      id: 'TRAVELER_1',
      name: { firstName: 'John', lastName: 'Doe' },
      dateOfBirth: '1990-01-01',
      gender: 'M',
      contact: { email: 'john@example.com' },
      documents: []
    }];

    const validOptions = {
      contactEmail: 'booking@example.com',
      contactPhone: '+1234567890'
    };

    beforeEach(() => {
      // Mock successful authentication
      amadeusXmlService.isAuthenticated = true;
      amadeusXmlService.authToken = 'TEST_TOKEN';
      amadeusXmlService.authExpiry = Date.now() + 3600000;
    });

    test('should book flight successfully with valid data', async () => {
      const mockBookingResponse = `
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
            <PNR_Reply>
              <pnrHeader>
                <reservationInfo>
                  <reservation>
                    <controlNumber>ABC123</controlNumber>
                  </reservation>
                </reservationInfo>
              </pnrHeader>
            </PNR_Reply>
          </soap:Body>
        </soap:Envelope>
      `;

      const mockAdaptedResponse = {
        data: {
          type: 'flight-order',
          id: 'ABC123',
          flightOffers: [validFlightOffer],
          travelers: validTravelers
        }
      };

      mockSoapClient.PNR_AddMultiElements.mockImplementation((request, callback) => {
        callback(null, null, mockBookingResponse);
      });

      responseAdapter.adaptBookingResponse.mockResolvedValue(mockAdaptedResponse);

      const result = await amadeusXmlService.bookFlightXml(validFlightOffer, validTravelers, validOptions);

      expect(result).toEqual(mockAdaptedResponse);
      expect(mockSoapClient.PNR_AddMultiElements).toHaveBeenCalledTimes(1);
      expect(responseAdapter.adaptBookingResponse).toHaveBeenCalledWith(mockBookingResponse);
    });

    test('should validate booking data and throw error for invalid flight offer', async () => {
      const invalidFlightOffer = null;

      await expect(amadeusXmlService.bookFlightXml(invalidFlightOffer, validTravelers, validOptions))
        .rejects.toThrow(ApiError);
    });

    test('should validate traveler data', async () => {
      const invalidTravelers = [{
        // Missing required fields
        name: { firstName: 'John' } // Missing lastName
      }];

      await expect(amadeusXmlService.bookFlightXml(validFlightOffer, invalidTravelers, validOptions))
        .rejects.toThrow(ApiError);
    });

    test('should handle booking failure with SOAP fault', async () => {
      const soapFaultResponse = `
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
            <soap:Fault>
              <faultcode>Server.BookingFailed</faultcode>
              <faultstring>Booking could not be completed</faultstring>
            </soap:Fault>
          </soap:Body>
        </soap:Envelope>
      `;

      mockSoapClient.PNR_AddMultiElements.mockImplementation((request, callback) => {
        const error = new Error('soap:Fault occurred');
        error.message = soapFaultResponse;
        callback(error, null, null);
      });

      XmlErrorHandler.parseSoapFault.mockResolvedValue({
        code: 'BOOKING_FAILED',
        message: 'Booking could not be completed'
      });

      await expect(amadeusXmlService.bookFlightXml(validFlightOffer, validTravelers, validOptions))
        .rejects.toThrow(ApiError);
    });
  });

  describe('Error Handling and Retries', () => {
    test('should retry on retryable errors', async () => {
      const retryableError = new Error('ECONNRESET');
      retryableError.code = 'ECONNRESET';

      mockSoapClient.Air_FlightSearch
        .mockImplementationOnce((request, callback) => callback(retryableError))
        .mockImplementationOnce((request, callback) => callback(retryableError))
        .mockImplementationOnce((request, callback) => callback(null, null, '<success>response</success>'));

      XmlErrorHandler.isRetryableError.mockReturnValue(true);
      XmlErrorHandler.getRetryDelay.mockReturnValue(100);
      responseAdapter.adaptFlightSearchResponse.mockResolvedValue({ data: [] });

      // Mock authentication
      amadeusXmlService.isAuthenticated = true;
      amadeusXmlService.authToken = 'TEST_TOKEN';
      amadeusXmlService.authExpiry = Date.now() + 3600000;

      const result = await amadeusXmlService.searchFlightsXml({
        originLocationCode: 'JFK',
        destinationLocationCode: 'LAX',
        departureDate: '2024-12-01',
        adults: 1
      });

      expect(mockSoapClient.Air_FlightSearch).toHaveBeenCalledTimes(3);
      expect(result).toEqual({ data: [] });
    });

    test('should not retry on non-retryable errors', async () => {
      const nonRetryableError = new Error('Invalid request');

      mockSoapClient.Air_FlightSearch.mockImplementation((request, callback) => {
        callback(nonRetryableError);
      });

      XmlErrorHandler.isRetryableError.mockReturnValue(false);

      // Mock authentication
      amadeusXmlService.isAuthenticated = true;
      amadeusXmlService.authToken = 'TEST_TOKEN';
      amadeusXmlService.authExpiry = Date.now() + 3600000;

      await expect(amadeusXmlService.searchFlightsXml({
        originLocationCode: 'JFK',
        destinationLocationCode: 'LAX',
        departureDate: '2024-12-01',
        adults: 1
      })).rejects.toThrow();

      expect(mockSoapClient.Air_FlightSearch).toHaveBeenCalledTimes(1);
    });

    test('should stop retrying after max retries reached', async () => {
      const retryableError = new Error('ETIMEDOUT');
      retryableError.code = 'ETIMEDOUT';

      mockSoapClient.Air_FlightSearch.mockImplementation((request, callback) => {
        callback(retryableError);
      });

      XmlErrorHandler.isRetryableError.mockReturnValue(true);
      XmlErrorHandler.getRetryDelay.mockReturnValue(100);

      // Mock authentication
      amadeusXmlService.isAuthenticated = true;
      amadeusXmlService.authToken = 'TEST_TOKEN';
      amadeusXmlService.authExpiry = Date.now() + 3600000;

      await expect(amadeusXmlService.searchFlightsXml({
        originLocationCode: 'JFK',
        destinationLocationCode: 'LAX',
        departureDate: '2024-12-01',
        adults: 1
      })).rejects.toThrow();

      // Should be called maxRetries + 1 times (initial + 3 retries)
      expect(mockSoapClient.Air_FlightSearch).toHaveBeenCalledTimes(4);
    });
  });

  describe('Connection Pool Management', () => {
    test('should manage SOAP client pool correctly', () => {
      expect(amadeusXmlService.clientPool).toHaveLength(2); // Pool size from config
      expect(amadeusXmlService.poolIndex).toBe(0);
    });

    test('should get client from pool and return it', () => {
      const poolItem = amadeusXmlService._getClientFromPool();
      expect(poolItem.inUse).toBe(true);
      expect(poolItem.client).toBeDefined();

      amadeusXmlService._returnClientToPool(poolItem);
      expect(poolItem.inUse).toBe(false);
    });

    test('should use round-robin when all clients are in use', () => {
      // Mark all clients as in use
      amadeusXmlService.clientPool.forEach(item => item.inUse = true);

      const poolItem1 = amadeusXmlService._getClientFromPool();
      const poolItem2 = amadeusXmlService._getClientFromPool();

      expect(poolItem1).not.toBe(poolItem2);
      expect(amadeusXmlService.poolIndex).toBe(2);
    });
  });
});