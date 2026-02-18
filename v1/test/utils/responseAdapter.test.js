// v1/test/utils/responseAdapter.test.js
const responseAdapter = require('../../utils/responseAdapter');
const xmlParser = require('../../utils/xmlParser');
const { ApiError } = require('../../utils/apiError');

// Mock dependencies
jest.mock('../../utils/xmlParser');
jest.mock('../../utils/logger', () => ({
  createContextualLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

describe('ResponseAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('adaptFlightSearchResponse', () => {
    test('should adapt XML flight search response to JSON format', async () => {
      const mockXmlResponse = `
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
            <flightOffersSearchResponse>
              <flightOffers>
                <offer id="OFFER_1">
                  <price>
                    <total>500.00</total>
                    <currency>USD</currency>
                  </price>
                  <itineraries>
                    <segments>
                      <departure>
                        <iataCode>JFK</iataCode>
                        <at>2024-12-01T10:00:00</at>
                      </departure>
                      <arrival>
                        <iataCode>LAX</iataCode>
                        <at>2024-12-01T15:00:00</at>
                      </arrival>
                      <carrierCode>AA</carrierCode>
                      <number>123</number>
                    </segments>
                  </itineraries>
                </offer>
              </flightOffers>
            </flightOffersSearchResponse>
          </soap:Body>
        </soap:Envelope>
      `;

      const mockParsedXml = {
        'soap:Body': {
          flightOffersSearchResponse: {
            flightOffers: [{
              id: 'OFFER_1',
              price: {
                total: '500.00',
                currency: 'USD'
              },
              itineraries: [{
                segments: [{
                  departure: {
                    iataCode: 'JFK',
                    at: '2024-12-01T10:00:00'
                  },
                  arrival: {
                    iataCode: 'LAX',
                    at: '2024-12-01T15:00:00'
                  },
                  carrierCode: 'AA',
                  number: '123'
                }]
              }]
            }]
          }
        }
      };

      xmlParser.parseAmadeusXml.mockResolvedValue(mockParsedXml);

      const result = await responseAdapter.adaptFlightSearchResponse(mockXmlResponse);

      expect(result).toHaveProperty('meta');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('dictionaries');
      expect(result.meta.count).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toHaveProperty('type', 'flight-offer');
      expect(result.data[0]).toHaveProperty('id', 'OFFER_1');
      expect(result.data[0].price.total).toBe('500.00');
      expect(result.data[0].price.currency).toBe('USD');
    });

    test('should handle already parsed XML object', async () => {
      const mockParsedXml = {
        'soap:Body': {
          flightOffersSearchResponse: {
            flightOffers: [{
              id: 'OFFER_1',
              price: { total: '300.00', currency: 'EUR' }
            }]
          }
        }
      };

      const result = await responseAdapter.adaptFlightSearchResponse(mockParsedXml);

      expect(xmlParser.parseAmadeusXml).not.toHaveBeenCalled();
      expect(result.data).toHaveLength(1);
      expect(result.data[0].price.currency).toBe('EUR');
    });

    test('should handle empty flight offers', async () => {
      const mockParsedXml = {
        'soap:Body': {
          flightOffersSearchResponse: {
            flightOffers: []
          }
        }
      };

      const result = await responseAdapter.adaptFlightSearchResponse(mockParsedXml);

      expect(result.meta.count).toBe(0);
      expect(result.data).toHaveLength(0);
    });

    test('should handle single flight offer (not array)', async () => {
      const mockParsedXml = {
        'soap:Body': {
          flightOffersSearchResponse: {
            flightOffers: {
              id: 'OFFER_1',
              price: { total: '400.00', currency: 'GBP' }
            }
          }
        }
      };

      const result = await responseAdapter.adaptFlightSearchResponse(mockParsedXml);

      expect(result.meta.count).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].price.currency).toBe('GBP');
    });

    test('should include raw XML in debug mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const mockXmlResponse = '<test>xml</test>';
      const mockParsedXml = {
        'soap:Body': {
          flightOffersSearchResponse: { flightOffers: [] }
        }
      };

      xmlParser.parseAmadeusXml.mockResolvedValue(mockParsedXml);

      const result = await responseAdapter.adaptFlightSearchResponse(
        mockXmlResponse, 
        { includeRawXml: true }
      );

      expect(result._debug).toBeDefined();
      expect(result._debug.rawXml).toBe(mockXmlResponse);

      process.env.NODE_ENV = originalEnv;
    });

    test('should not include raw XML in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const mockXmlResponse = '<test>xml</test>';
      const mockParsedXml = {
        'soap:Body': {
          flightOffersSearchResponse: { flightOffers: [] }
        }
      };

      xmlParser.parseAmadeusXml.mockResolvedValue(mockParsedXml);

      const result = await responseAdapter.adaptFlightSearchResponse(
        mockXmlResponse, 
        { includeRawXml: true }
      );

      expect(result._debug).toBeUndefined();

      process.env.NODE_ENV = originalEnv;
    });

    test('should handle XML parsing errors', async () => {
      const mockXmlResponse = 'invalid xml';
      xmlParser.parseAmadeusXml.mockRejectedValue(new Error('XML parsing failed'));

      await expect(responseAdapter.adaptFlightSearchResponse(mockXmlResponse))
        .rejects.toThrow(ApiError);
    });

    test('should handle different XML response structures', async () => {
      const mockParsedXml = {
        'soap:Body': {
          airFlightSearchResponse: {
            flightOffers: [{
              id: 'OFFER_2',
              price: { total: '600.00', currency: 'CAD' }
            }]
          }
        }
      };

      const result = await responseAdapter.adaptFlightSearchResponse(mockParsedXml);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('OFFER_2');
    });
  });

  describe('adaptBookingResponse', () => {
    test('should adapt XML booking response to JSON format', async () => {
      const mockXmlResponse = `
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
            <flightOrderCreateResponse>
              <id>BOOKING_123</id>
              <reference>ABC123</reference>
              <flightOffers>
                <offer id="OFFER_1">
                  <price>
                    <total>500.00</total>
                    <currency>USD</currency>
                  </price>
                </offer>
              </flightOffers>
              <travelers>
                <traveler id="TRAVELER_1">
                  <name>
                    <firstName>John</firstName>
                    <lastName>Doe</lastName>
                  </name>
                  <dateOfBirth>1990-01-01</dateOfBirth>
                </traveler>
              </travelers>
            </flightOrderCreateResponse>
          </soap:Body>
        </soap:Envelope>
      `;

      const mockParsedXml = {
        'soap:Body': {
          flightOrderCreateResponse: {
            id: 'BOOKING_123',
            reference: 'ABC123',
            flightOffers: [{
              id: 'OFFER_1',
              price: { total: '500.00', currency: 'USD' }
            }],
            travelers: [{
              id: 'TRAVELER_1',
              name: { firstName: 'John', lastName: 'Doe' },
              dateOfBirth: '1990-01-01'
            }]
          }
        }
      };

      xmlParser.parseAmadeusXml.mockResolvedValue(mockParsedXml);

      const result = await responseAdapter.adaptBookingResponse(mockXmlResponse);

      expect(result).toHaveProperty('data');
      expect(result.data.type).toBe('flight-order');
      expect(result.data.id).toBe('BOOKING_123');
      expect(result.data.flightOffers).toHaveLength(1);
      expect(result.data.travelers).toHaveLength(1);
      expect(result.data.travelers[0].name.firstName).toBe('John');
    });

    test('should handle different booking response structures', async () => {
      const mockParsedXml = {
        'soap:Body': {
          airBookingResponse: {
            reference: 'DEF456',
            passengers: [{
              id: 'PASSENGER_1',
              firstName: 'Jane',
              lastName: 'Smith'
            }]
          }
        }
      };

      const result = await responseAdapter.adaptBookingResponse(mockParsedXml);

      expect(result.data.id).toBe('DEF456');
      expect(result.data.travelers).toHaveLength(1);
    });

    test('should handle missing booking data gracefully', async () => {
      const mockParsedXml = {
        'soap:Body': {}
      };

      const result = await responseAdapter.adaptBookingResponse(mockParsedXml);

      expect(result.data.type).toBe('flight-order');
      expect(result.data.flightOffers).toEqual([]);
      expect(result.data.travelers).toEqual([]);
    });

    test('should transform travelers correctly', async () => {
      const mockParsedXml = {
        'soap:Body': {
          bookingResponse: {
            travelers: [{
              id: 'T1',
              firstName: 'Alice',
              lastName: 'Johnson',
              dateOfBirth: '1985-05-15',
              gender: 'F',
              contact: { email: 'alice@example.com' },
              documents: [{ type: 'passport', number: '123456789' }]
            }]
          }
        }
      };

      const result = await responseAdapter.adaptBookingResponse(mockParsedXml);

      const traveler = result.data.travelers[0];
      expect(traveler.id).toBe('T1');
      expect(traveler.name.firstName).toBe('Alice');
      expect(traveler.name.lastName).toBe('Johnson');
      expect(traveler.dateOfBirth).toBe('1985-05-15');
      expect(traveler.gender).toBe('F');
    });
  });

  describe('adaptErrorResponse', () => {
    test('should adapt SOAP fault to ApiError', async () => {
      const mockSoapFaultXml = `
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
            <soap:Fault>
              <faultcode>Server.AuthenticationFailed</faultcode>
              <faultstring>Invalid credentials</faultstring>
              <detail>
                <errorCode>401</errorCode>
              </detail>
            </soap:Fault>
          </soap:Body>
        </soap:Envelope>
      `;

      const mockParsedXml = {
        'soap:Body': {
          'soap:Fault': {
            faultcode: 'Server.AuthenticationFailed',
            faultstring: 'Invalid credentials',
            detail: { errorCode: '401' }
          }
        }
      };

      xmlParser.parseAmadeusXml.mockResolvedValue(mockParsedXml);

      const result = await responseAdapter.adaptErrorResponse(mockSoapFaultXml);

      expect(result).toBeInstanceOf(ApiError);
      expect(result.message).toContain('Invalid credentials');
    });

    test('should adapt application errors to ApiError', async () => {
      const mockErrorXml = {
        'soap:Body': {
          errors: [{
            code: 'VALIDATION_ERROR',
            detail: 'Invalid flight search criteria',
            message: 'Validation failed'
          }]
        }
      };

      const result = await responseAdapter.adaptErrorResponse(mockErrorXml);

      expect(result).toBeInstanceOf(ApiError);
    });

    test('should handle authentication errors specifically', async () => {
      const mockErrorXml = {
        'soap:Body': {
          error: {
            code: 'AUTHENTICATION_FAILED',
            message: 'Authentication required'
          }
        }
      };

      const result = await responseAdapter.adaptErrorResponse(mockErrorXml);

      expect(result).toBeInstanceOf(ApiError);
      expect(result.statusCode).toBe(401);
    });

    test('should handle authorization errors specifically', async () => {
      const mockErrorXml = {
        'soap:Body': {
          error: {
            code: 'AUTHORIZATION_DENIED',
            message: 'Access denied'
          }
        }
      };

      const result = await responseAdapter.adaptErrorResponse(mockErrorXml);

      expect(result).toBeInstanceOf(ApiError);
      expect(result.statusCode).toBe(403);
    });

    test('should handle not found errors specifically', async () => {
      const mockErrorXml = {
        'soap:Body': {
          error: {
            code: 'NOT_FOUND',
            message: 'Flight not found'
          }
        }
      };

      const result = await responseAdapter.adaptErrorResponse(mockErrorXml);

      expect(result).toBeInstanceOf(ApiError);
      expect(result.statusCode).toBe(404);
    });

    test('should handle validation errors specifically', async () => {
      const mockErrorXml = {
        'soap:Body': {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input data'
          }
        }
      };

      const result = await responseAdapter.adaptErrorResponse(mockErrorXml);

      expect(result).toBeInstanceOf(ApiError);
      expect(result.statusCode).toBe(400);
    });

    test('should handle unknown errors gracefully', async () => {
      const mockErrorXml = {
        'soap:Body': {
          unknownStructure: {
            someError: 'Unknown error occurred'
          }
        }
      };

      const result = await responseAdapter.adaptErrorResponse(mockErrorXml);

      expect(result).toBeInstanceOf(ApiError);
    });

    test('should handle error adaptation failures', async () => {
      const mockErrorXml = 'invalid xml';
      xmlParser.parseAmadeusXml.mockRejectedValue(new Error('Parse failed'));

      const result = await responseAdapter.adaptErrorResponse(mockErrorXml);

      expect(result).toBeInstanceOf(ApiError);
    });
  });

  describe('Flight Offer Transformation', () => {
    test('should transform complete flight offer', () => {
      const xmlOffer = {
        id: 'OFFER_123',
        source: 'GDS',
        instantTicketingRequired: true,
        oneWay: false,
        lastTicketingDate: '2024-12-01',
        numberOfBookableSeats: 5,
        price: {
          total: '750.00',
          currency: 'USD',
          base: '650.00',
          fees: [{ type: 'service', amount: '50.00' }],
          taxes: [{ type: 'tax', amount: '50.00' }]
        },
        itineraries: [{
          duration: 'PT5H30M',
          segments: [{
            departure: { iataCode: 'JFK', at: '2024-12-01T10:00:00' },
            arrival: { iataCode: 'LAX', at: '2024-12-01T15:30:00' },
            carrierCode: 'AA',
            number: '123',
            aircraft: { code: '737' }
          }]
        }],
        validatingAirline: 'AA'
      };

      const result = responseAdapter._transformFlightOffer(xmlOffer);

      expect(result.type).toBe('flight-offer');
      expect(result.id).toBe('OFFER_123');
      expect(result.source).toBe('GDS');
      expect(result.instantTicketingRequired).toBe(true);
      expect(result.oneWay).toBe(false);
      expect(result.numberOfBookableSeats).toBe(5);
      expect(result.price.total).toBe('750.00');
      expect(result.price.currency).toBe('USD');
      expect(result.itineraries).toHaveLength(1);
      expect(result.itineraries[0].segments).toHaveLength(1);
    });

    test('should handle minimal flight offer data', () => {
      const xmlOffer = {
        id: 'MINIMAL_OFFER'
      };

      const result = responseAdapter._transformFlightOffer(xmlOffer);

      expect(result.type).toBe('flight-offer');
      expect(result.id).toBe('MINIMAL_OFFER');
      expect(result.source).toBe('GDS');
      expect(result.price.total).toBe('0');
      expect(result.itineraries).toEqual([]);
    });

    test('should generate ID when missing', () => {
      const xmlOffer = {};

      const result = responseAdapter._transformFlightOffer(xmlOffer);

      expect(result.id).toMatch(/^OFFER_\d+_[a-z0-9]{5}$/);
    });

    test('should handle transformation errors gracefully', () => {
      const xmlOffer = {
        id: 'ERROR_OFFER',
        price: null // This might cause transformation issues
      };

      const result = responseAdapter._transformFlightOffer(xmlOffer);

      expect(result.type).toBe('flight-offer');
      expect(result.id).toBe('ERROR_OFFER');
      expect(result.price.total).toBe('0');
    });
  });

  describe('Traveler Transformation', () => {
    test('should transform complete traveler data', () => {
      const xmlTraveler = {
        id: 'TRAVELER_123',
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        gender: 'M',
        contact: {
          email: 'john@example.com',
          phone: '+1234567890'
        },
        documents: [{
          type: 'passport',
          number: '123456789',
          expiryDate: '2030-01-01'
        }]
      };

      const result = responseAdapter._transformTraveler(xmlTraveler);

      expect(result.id).toBe('TRAVELER_123');
      expect(result.name.firstName).toBe('John');
      expect(result.name.lastName).toBe('Doe');
      expect(result.dateOfBirth).toBe('1990-01-01');
      expect(result.gender).toBe('M');
      expect(result.contact.email).toBe('john@example.com');
      expect(result.documents).toHaveLength(1);
    });

    test('should handle nested name structure', () => {
      const xmlTraveler = {
        id: 'TRAVELER_456',
        name: {
          firstName: 'Jane',
          lastName: 'Smith'
        }
      };

      const result = responseAdapter._transformTraveler(xmlTraveler);

      expect(result.name.firstName).toBe('Jane');
      expect(result.name.lastName).toBe('Smith');
    });

    test('should generate ID when missing', () => {
      const xmlTraveler = {
        firstName: 'Anonymous',
        lastName: 'Traveler'
      };

      const result = responseAdapter._transformTraveler(xmlTraveler);

      expect(result.id).toMatch(/^TRAVELER_\d+_[a-z0-9]{5}$/);
    });

    test('should handle transformation errors gracefully', () => {
      const xmlTraveler = {
        // Missing required fields
      };

      const result = responseAdapter._transformTraveler(xmlTraveler);

      expect(result.name.firstName).toBe('Unknown');
      expect(result.name.lastName).toBe('Traveler');
    });
  });

  describe('Price Transformation', () => {
    test('should transform complete price data', () => {
      const xmlPrice = {
        currency: 'EUR',
        total: '850.00',
        base: '750.00',
        fees: [{ type: 'service', amount: '50.00' }],
        taxes: [{ type: 'vat', amount: '50.00' }],
        refundableTaxes: '25.00'
      };

      const result = responseAdapter._transformPrice(xmlPrice);

      expect(result.currency).toBe('EUR');
      expect(result.total).toBe('850.00');
      expect(result.base).toBe('750.00');
      expect(result.refundableTaxes).toBe('25.00');
    });

    test('should handle alternative field names', () => {
      const xmlPrice = {
        currencyCode: 'GBP',
        totalAmount: '600.00',
        baseAmount: '500.00'
      };

      const result = responseAdapter._transformPrice(xmlPrice);

      expect(result.currency).toBe('GBP');
      expect(result.total).toBe('600.00');
      expect(result.base).toBe('500.00');
    });

    test('should provide defaults for missing data', () => {
      const xmlPrice = {};

      const result = responseAdapter._transformPrice(xmlPrice);

      expect(result.currency).toBe('USD');
      expect(result.total).toBe('0');
      expect(result.base).toBe('0');
    });

    test('should handle transformation errors gracefully', () => {
      const xmlPrice = null;

      const result = responseAdapter._transformPrice(xmlPrice);

      expect(result.currency).toBe('USD');
      expect(result.total).toBe('0');
    });
  });

  describe('Helper Methods', () => {
    test('should extract SOAP body from different structures', () => {
      const soapEnvelope1 = { 'soap:Body': { content: 'test1' } };
      const soapEnvelope2 = { Body: { content: 'test2' } };
      const soapEnvelope3 = { body: { content: 'test3' } };
      const directBody = { content: 'test4' };

      expect(responseAdapter._getSOAPBody(soapEnvelope1)).toEqual({ content: 'test1' });
      expect(responseAdapter._getSOAPBody(soapEnvelope2)).toEqual({ content: 'test2' });
      expect(responseAdapter._getSOAPBody(soapEnvelope3)).toEqual({ content: 'test3' });
      expect(responseAdapter._getSOAPBody(directBody)).toEqual({ content: 'test4' });
      expect(responseAdapter._getSOAPBody(null)).toEqual({});
    });

    test('should generate unique IDs', () => {
      const offerId1 = responseAdapter._generateOfferId();
      const offerId2 = responseAdapter._generateOfferId();
      const travelerId1 = responseAdapter._generateTravelerId();
      const segmentId1 = responseAdapter._generateSegmentId();

      expect(offerId1).toMatch(/^OFFER_\d+_[a-z0-9]{5}$/);
      expect(travelerId1).toMatch(/^TRAVELER_\d+_[a-z0-9]{5}$/);
      expect(segmentId1).toMatch(/^SEGMENT_\d+_[a-z0-9]{5}$/);
      expect(offerId1).not.toBe(offerId2);
    });

    test('should transform itineraries correctly', () => {
      const xmlItineraries = [{
        duration: 'PT6H15M',
        segments: [{
          departure: { iataCode: 'NYC', at: '2024-12-01T08:00:00' },
          arrival: { iataCode: 'LON', at: '2024-12-01T20:15:00' },
          carrierCode: 'BA',
          number: '456'
        }]
      }];

      const result = responseAdapter._transformItineraries(xmlItineraries);

      expect(result).toHaveLength(1);
      expect(result[0].duration).toBe('PT6H15M');
      expect(result[0].segments).toHaveLength(1);
      expect(result[0].segments[0].departure.iataCode).toBe('NYC');
      expect(result[0].segments[0].carrierCode).toBe('BA');
    });

    test('should handle single itinerary (not array)', () => {
      const xmlItinerary = {
        duration: 'PT3H30M',
        segments: [{
          departure: { iataCode: 'LAX' },
          arrival: { iataCode: 'SFO' }
        }]
      };

      const result = responseAdapter._transformItineraries(xmlItinerary);

      expect(result).toHaveLength(1);
      expect(result[0].duration).toBe('PT3H30M');
    });
  });
});