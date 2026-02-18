// v1/test/integration/backwardCompatibility.test.js
const request = require('supertest');
const app = require('../../../app');
const AmadeusXmlService = require('../../services/amadeusXmlService');
const CloudflareService = require('../../services/cloudflareService');

// Mock services to test API contract compatibility
jest.mock('../../services/amadeusXmlService');
jest.mock('../../services/cloudflareService');
jest.mock('../../utils/logger', () => ({
  createContextualLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

describe('Backward Compatibility Integration Tests', () => {
  let mockAmadeusXmlService;
  let mockCloudflareService;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock AmadeusXmlService
    mockAmadeusXmlService = {
      searchFlightsXml: jest.fn(),
      bookFlightXml: jest.fn(),
      authenticateAmadeusXml: jest.fn()
    };
    AmadeusXmlService.mockImplementation(() => mockAmadeusXmlService);

    // Mock CloudflareService
    mockCloudflareService = {
      uploadFile: jest.fn(),
      deleteFile: jest.fn(),
      getImageUrl: jest.fn(),
      getFileMetadata: jest.fn()
    };
    CloudflareService.mockImplementation(() => mockCloudflareService);
  });

  describe('Flight Search API Backward Compatibility', () => {
    test('should maintain existing flight search response format', async () => {
      // Mock XML service response in expected JSON format
      const mockFlightSearchResponse = {
        meta: {
          count: 2,
          links: {
            self: 'https://api.example.com/v1/shopping/flight-offers'
          }
        },
        data: [
          {
            type: 'flight-offer',
            id: 'OFFER_1',
            source: 'GDS',
            instantTicketingRequired: false,
            nonHomogeneous: false,
            oneWay: false,
            lastTicketingDate: '2024-12-01',
            numberOfBookableSeats: 5,
            itineraries: [
              {
                duration: 'PT5H30M',
                segments: [
                  {
                    departure: {
                      iataCode: 'JFK',
                      terminal: '4',
                      at: '2024-12-01T10:00:00'
                    },
                    arrival: {
                      iataCode: 'LAX',
                      terminal: '1',
                      at: '2024-12-01T15:30:00'
                    },
                    carrierCode: 'AA',
                    number: '123',
                    aircraft: {
                      code: '737'
                    },
                    operating: {
                      carrierCode: 'AA'
                    },
                    duration: 'PT5H30M',
                    id: 'SEGMENT_1',
                    numberOfStops: 0,
                    blacklistedInEU: false
                  }
                ]
              }
            ],
            price: {
              currency: 'USD',
              total: '750.00',
              base: '650.00',
              fees: [
                {
                  amount: '50.00',
                  type: 'SUPPLIER'
                }
              ],
              taxes: [
                {
                  amount: '50.00',
                  code: 'US'
                }
              ],
              refundableTaxes: '25.00'
            },
            pricingOptions: {
              fareType: ['PUBLISHED'],
              includedCheckedBagsOnly: true
            },
            validatingAirlineCodes: ['AA'],
            travelerPricings: [
              {
                travelerId: '1',
                fareOption: 'STANDARD',
                travelerType: 'ADULT',
                price: {
                  currency: 'USD',
                  total: '750.00',
                  base: '650.00'
                },
                fareDetailsBySegment: [
                  {
                    segmentId: 'SEGMENT_1',
                    cabin: 'ECONOMY',
                    fareBasis: 'Y',
                    brandedFare: 'BASIC',
                    class: 'Y',
                    includedCheckedBags: {
                      quantity: 1
                    }
                  }
                ]
              }
            ]
          },
          {
            type: 'flight-offer',
            id: 'OFFER_2',
            source: 'GDS',
            instantTicketingRequired: false,
            nonHomogeneous: false,
            oneWay: false,
            lastTicketingDate: '2024-12-01',
            numberOfBookableSeats: 3,
            itineraries: [
              {
                duration: 'PT7H15M',
                segments: [
                  {
                    departure: {
                      iataCode: 'JFK',
                      terminal: '4',
                      at: '2024-12-01T14:00:00'
                    },
                    arrival: {
                      iataCode: 'DEN',
                      terminal: 'A',
                      at: '2024-12-01T17:00:00'
                    },
                    carrierCode: 'UA',
                    number: '456',
                    aircraft: {
                      code: '737'
                    },
                    duration: 'PT3H00M',
                    id: 'SEGMENT_2',
                    numberOfStops: 0
                  },
                  {
                    departure: {
                      iataCode: 'DEN',
                      terminal: 'A',
                      at: '2024-12-01T18:30:00'
                    },
                    arrival: {
                      iataCode: 'LAX',
                      terminal: '1',
                      at: '2024-12-01T19:15:00'
                    },
                    carrierCode: 'UA',
                    number: '789',
                    aircraft: {
                      code: '737'
                    },
                    duration: 'PT2H45M',
                    id: 'SEGMENT_3',
                    numberOfStops: 0
                  }
                ]
              }
            ],
            price: {
              currency: 'USD',
              total: '850.00',
              base: '750.00',
              fees: [
                {
                  amount: '50.00',
                  type: 'SUPPLIER'
                }
              ],
              taxes: [
                {
                  amount: '50.00',
                  code: 'US'
                }
              ]
            },
            validatingAirlineCodes: ['UA'],
            travelerPricings: [
              {
                travelerId: '1',
                fareOption: 'STANDARD',
                travelerType: 'ADULT',
                price: {
                  currency: 'USD',
                  total: '850.00',
                  base: '750.00'
                }
              }
            ]
          }
        ],
        dictionaries: {
          locations: {
            JFK: {
              cityCode: 'NYC',
              countryCode: 'US'
            },
            LAX: {
              cityCode: 'LAX',
              countryCode: 'US'
            },
            DEN: {
              cityCode: 'DEN',
              countryCode: 'US'
            }
          },
          currencies: {
            USD: 'US Dollar'
          },
          carriers: {
            AA: 'American Airlines',
            UA: 'United Airlines'
          },
          aircraft: {
            '737': 'Boeing 737'
          }
        }
      };

      mockAmadeusXmlService.searchFlightsXml.mockResolvedValue(mockFlightSearchResponse);

      const response = await request(app)
        .get('/v1/flights/search')
        .query({
          originLocationCode: 'JFK',
          destinationLocationCode: 'LAX',
          departureDate: '2024-12-01',
          adults: 1
        })
        .expect(200);

      // Verify response structure matches existing API contract
      expect(response.body).toHaveProperty('meta');
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('dictionaries');

      expect(response.body.meta.count).toBe(2);
      expect(response.body.data).toHaveLength(2);

      // Verify first offer structure
      const firstOffer = response.body.data[0];
      expect(firstOffer.type).toBe('flight-offer');
      expect(firstOffer.id).toBe('OFFER_1');
      expect(firstOffer.source).toBe('GDS');
      expect(firstOffer.price.currency).toBe('USD');
      expect(firstOffer.price.total).toBe('750.00');
      expect(firstOffer.itineraries).toHaveLength(1);
      expect(firstOffer.itineraries[0].segments).toHaveLength(1);

      // Verify segment structure
      const segment = firstOffer.itineraries[0].segments[0];
      expect(segment.departure.iataCode).toBe('JFK');
      expect(segment.arrival.iataCode).toBe('LAX');
      expect(segment.carrierCode).toBe('AA');
      expect(segment.number).toBe('123');

      // Verify second offer (connection flight)
      const secondOffer = response.body.data[1];
      expect(secondOffer.itineraries[0].segments).toHaveLength(2);
      expect(secondOffer.price.total).toBe('850.00');

      // Verify dictionaries
      expect(response.body.dictionaries.locations.JFK.cityCode).toBe('NYC');
      expect(response.body.dictionaries.carriers.AA).toBe('American Airlines');

      expect(mockAmadeusXmlService.searchFlightsXml).toHaveBeenCalledWith({
        originLocationCode: 'JFK',
        destinationLocationCode: 'LAX',
        departureDate: '2024-12-01',
        adults: 1
      });
    });

    test('should handle flight search with all optional parameters', async () => {
      const mockResponse = {
        meta: { count: 1 },
        data: [{
          type: 'flight-offer',
          id: 'OFFER_1',
          price: { currency: 'EUR', total: '650.00' },
          itineraries: []
        }],
        dictionaries: {}
      };

      mockAmadeusXmlService.searchFlightsXml.mockResolvedValue(mockResponse);

      const response = await request(app)
        .get('/v1/flights/search')
        .query({
          originLocationCode: 'CDG',
          destinationLocationCode: 'FCO',
          departureDate: '2024-12-01',
          returnDate: '2024-12-08',
          adults: 2,
          children: 1,
          infants: 0,
          travelClass: 'BUSINESS',
          currencyCode: 'EUR',
          max: 25
        })
        .expect(200);

      expect(response.body.data[0].price.currency).toBe('EUR');
      expect(mockAmadeusXmlService.searchFlightsXml).toHaveBeenCalledWith({
        originLocationCode: 'CDG',
        destinationLocationCode: 'FCO',
        departureDate: '2024-12-01',
        returnDate: '2024-12-08',
        adults: 2,
        children: 1,
        infants: 0,
        travelClass: 'BUSINESS',
        currencyCode: 'EUR',
        max: 25
      });
    });

    test('should maintain error response format for flight search', async () => {
      mockAmadeusXmlService.searchFlightsXml.mockRejectedValue(
        new Error('Invalid search criteria')
      );

      const response = await request(app)
        .get('/v1/flights/search')
        .query({
          originLocationCode: 'INVALID',
          destinationLocationCode: 'LAX',
          departureDate: '2024-12-01'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('message');
      expect(response.body.error).toHaveProperty('code');
    });
  });

  describe('Flight Booking API Backward Compatibility', () => {
    test('should maintain existing flight booking response format', async () => {
      const mockBookingResponse = {
        data: {
          type: 'flight-order',
          id: 'BOOKING_123',
          associatedRecords: [
            {
              reference: 'ABC123',
              creationDate: '2024-01-01T10:00:00.000Z',
              originSystemCode: 'GDS',
              flightOfferId: 'OFFER_1'
            }
          ],
          flightOffers: [
            {
              type: 'flight-offer',
              id: 'OFFER_1',
              source: 'GDS',
              price: {
                currency: 'USD',
                total: '750.00',
                base: '650.00'
              },
              itineraries: [
                {
                  duration: 'PT5H30M',
                  segments: [
                    {
                      departure: {
                        iataCode: 'JFK',
                        at: '2024-12-01T10:00:00'
                      },
                      arrival: {
                        iataCode: 'LAX',
                        at: '2024-12-01T15:30:00'
                      },
                      carrierCode: 'AA',
                      number: '123'
                    }
                  ]
                }
              ]
            }
          ],
          travelers: [
            {
              id: '1',
              dateOfBirth: '1990-01-01',
              gender: 'MALE',
              name: {
                firstName: 'JOHN',
                lastName: 'DOE'
              },
              documents: [
                {
                  documentType: 'PASSPORT',
                  number: '123456789',
                  expiryDate: '2030-01-01',
                  issuanceCountry: 'US',
                  validityCountry: 'US',
                  nationality: 'US',
                  holder: true
                }
              ],
              contact: {
                emailAddress: 'john.doe@email.com',
                phones: [
                  {
                    deviceType: 'MOBILE',
                    countryCallingCode: '1',
                    number: '2345678901'
                  }
                ]
              }
            }
          ],
          contacts: [
            {
              addresseeName: {
                firstName: 'JOHN',
                lastName: 'DOE'
              },
              companyName: 'ACME Corp',
              purpose: 'STANDARD',
              phones: [
                {
                  deviceType: 'MOBILE',
                  countryCallingCode: '1',
                  number: '2345678901'
                }
              ],
              emailAddress: 'john.doe@email.com',
              address: {
                lines: ['123 Main St'],
                postalCode: '12345',
                cityName: 'New York',
                countryCode: 'US'
              }
            }
          ],
          ticketingAgreement: {
            option: 'DELAY_TO_CANCEL',
            delay: '6D'
          },
          automatedProcess: [
            {
              code: 'IMMEDIATE',
              queue: {
                number: '10',
                category: '0'
              },
              officeId: 'NYCAA1234'
            }
          ]
        }
      };

      mockAmadeusXmlService.bookFlightXml.mockResolvedValue(mockBookingResponse);

      const bookingRequest = {
        data: {
          type: 'flight-order',
          flightOffers: [
            {
              type: 'flight-offer',
              id: 'OFFER_1',
              source: 'GDS',
              price: {
                currency: 'USD',
                total: '750.00'
              }
            }
          ],
          travelers: [
            {
              id: '1',
              dateOfBirth: '1990-01-01',
              gender: 'MALE',
              name: {
                firstName: 'John',
                lastName: 'Doe'
              },
              documents: [
                {
                  documentType: 'PASSPORT',
                  number: '123456789',
                  expiryDate: '2030-01-01',
                  issuanceCountry: 'US'
                }
              ],
              contact: {
                emailAddress: 'john.doe@email.com',
                phones: [
                  {
                    deviceType: 'MOBILE',
                    countryCallingCode: '1',
                    number: '2345678901'
                  }
                ]
              }
            }
          ]
        }
      };

      const response = await request(app)
        .post('/v1/flights/book')
        .send(bookingRequest)
        .expect(201);

      // Verify response structure matches existing API contract
      expect(response.body).toHaveProperty('data');
      expect(response.body.data.type).toBe('flight-order');
      expect(response.body.data.id).toBe('BOOKING_123');
      expect(response.body.data.flightOffers).toHaveLength(1);
      expect(response.body.data.travelers).toHaveLength(1);
      expect(response.body.data.contacts).toHaveLength(1);

      // Verify traveler information
      const traveler = response.body.data.travelers[0];
      expect(traveler.name.firstName).toBe('JOHN');
      expect(traveler.name.lastName).toBe('DOE');
      expect(traveler.documents[0].documentType).toBe('PASSPORT');

      // Verify flight offer information
      const flightOffer = response.body.data.flightOffers[0];
      expect(flightOffer.price.total).toBe('750.00');
      expect(flightOffer.itineraries[0].segments[0].carrierCode).toBe('AA');

      expect(mockAmadeusXmlService.bookFlightXml).toHaveBeenCalledWith(
        bookingRequest.data.flightOffers[0],
        bookingRequest.data.travelers,
        expect.any(Object)
      );
    });

    test('should handle booking validation errors with consistent format', async () => {
      mockAmadeusXmlService.bookFlightXml.mockRejectedValue(
        new Error('Invalid traveler information')
      );

      const invalidBookingRequest = {
        data: {
          type: 'flight-order',
          flightOffers: [{ id: 'OFFER_1' }],
          travelers: [
            {
              // Missing required fields
              name: { firstName: 'John' }
            }
          ]
        }
      };

      const response = await request(app)
        .post('/v1/flights/book')
        .send(invalidBookingRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('message');
      expect(response.body.error).toHaveProperty('code');
    });
  });

  describe('File Upload API Backward Compatibility', () => {
    test('should maintain existing file upload response format', async () => {
      const mockUploadResponse = {
        id: 'cloudflare-id-123',
        filename: 'test-image.jpg',
        uploaded: '2024-01-01T10:00:00Z',
        requireSignedURLs: false,
        variants: ['public', 'thumbnail'],
        meta: {
          userId: '12345',
          category: 'profile'
        },
        url: 'https://imagedelivery.net/test-hash/cloudflare-id-123/public'
      };

      mockCloudflareService.uploadFile.mockResolvedValue(mockUploadResponse);

      const response = await request(app)
        .post('/v1/files/upload')
        .attach('file', Buffer.from('test image content'), 'test-image.jpg')
        .field('metadata', JSON.stringify({ userId: '12345', category: 'profile' }))
        .expect(200);

      // Verify response structure matches existing API contract
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('filename');
      expect(response.body).toHaveProperty('url');
      expect(response.body).toHaveProperty('uploaded');
      expect(response.body).toHaveProperty('meta');

      expect(response.body.id).toBe('cloudflare-id-123');
      expect(response.body.filename).toBe('test-image.jpg');
      expect(response.body.url).toContain('imagedelivery.net');
      expect(response.body.meta.userId).toBe('12345');

      expect(mockCloudflareService.uploadFile).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({
          filename: 'test-image.jpg',
          metadata: { userId: '12345', category: 'profile' }
        })
      );
    });

    test('should maintain file URL generation compatibility', async () => {
      mockCloudflareService.getImageUrl.mockImplementation((imageId, transformations) => {
        const baseUrl = `https://imagedelivery.net/test-hash/${imageId}`;
        if (transformations && Object.keys(transformations).length > 0) {
          const params = new URLSearchParams();
          if (transformations.width) params.append('w', transformations.width);
          if (transformations.height) params.append('h', transformations.height);
          if (transformations.format) params.append('f', transformations.format);
          return `${baseUrl}/public?${params.toString()}`;
        }
        return `${baseUrl}/public`;
      });

      // Test basic URL generation
      const response1 = await request(app)
        .get('/v1/files/cloudflare-id-123/url')
        .expect(200);

      expect(response1.body.url).toBe('https://imagedelivery.net/test-hash/cloudflare-id-123/public');

      // Test URL generation with transformations
      const response2 = await request(app)
        .get('/v1/files/cloudflare-id-123/url')
        .query({
          width: 300,
          height: 200,
          format: 'webp'
        })
        .expect(200);

      expect(response2.body.url).toBe('https://imagedelivery.net/test-hash/cloudflare-id-123/public?w=300&h=200&f=webp');

      expect(mockCloudflareService.getImageUrl).toHaveBeenCalledTimes(2);
    });

    test('should maintain file deletion response format', async () => {
      mockCloudflareService.deleteFile.mockResolvedValue(true);

      const response = await request(app)
        .delete('/v1/files/cloudflare-id-123')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');

      expect(mockCloudflareService.deleteFile).toHaveBeenCalledWith('cloudflare-id-123');
    });
  });

  describe('Error Response Backward Compatibility', () => {
    test('should maintain consistent error response format across all endpoints', async () => {
      // Test flight search error
      mockAmadeusXmlService.searchFlightsXml.mockRejectedValue(
        new Error('Service unavailable')
      );

      const flightSearchError = await request(app)
        .get('/v1/flights/search')
        .query({ originLocationCode: 'JFK', destinationLocationCode: 'LAX' })
        .expect(500);

      expect(flightSearchError.body).toHaveProperty('error');
      expect(flightSearchError.body.error).toHaveProperty('message');
      expect(flightSearchError.body.error).toHaveProperty('code');
      expect(flightSearchError.body.error).toHaveProperty('timestamp');

      // Test file upload error
      mockCloudflareService.uploadFile.mockRejectedValue(
        new Error('Upload failed')
      );

      const fileUploadError = await request(app)
        .post('/v1/files/upload')
        .attach('file', Buffer.from('test'), 'test.jpg')
        .expect(500);

      expect(fileUploadError.body).toHaveProperty('error');
      expect(fileUploadError.body.error).toHaveProperty('message');
      expect(fileUploadError.body.error).toHaveProperty('code');
      expect(fileUploadError.body.error).toHaveProperty('timestamp');

      // Verify error format consistency
      expect(flightSearchError.body.error).toMatchObject({
        message: expect.any(String),
        code: expect.any(String),
        timestamp: expect.any(String)
      });

      expect(fileUploadError.body.error).toMatchObject({
        message: expect.any(String),
        code: expect.any(String),
        timestamp: expect.any(String)
      });
    });

    test('should maintain validation error format', async () => {
      // Test missing required parameters
      const response = await request(app)
        .get('/v1/flights/search')
        .query({
          // Missing required parameters
          originLocationCode: 'JFK'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('message');
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('details');
      expect(response.body.error.details).toBeInstanceOf(Array);
    });
  });

  describe('Response Headers and Metadata Compatibility', () => {
    test('should maintain consistent response headers', async () => {
      const mockResponse = {
        meta: { count: 1 },
        data: [{ type: 'flight-offer', id: 'OFFER_1' }],
        dictionaries: {}
      };

      mockAmadeusXmlService.searchFlightsXml.mockResolvedValue(mockResponse);

      const response = await request(app)
        .get('/v1/flights/search')
        .query({
          originLocationCode: 'JFK',
          destinationLocationCode: 'LAX',
          departureDate: '2024-12-01'
        })
        .expect(200);

      // Verify standard headers are present
      expect(response.headers).toHaveProperty('content-type');
      expect(response.headers['content-type']).toContain('application/json');
      expect(response.headers).toHaveProperty('x-response-time');
      expect(response.headers).toHaveProperty('x-request-id');
    });

    test('should maintain pagination metadata format', async () => {
      const mockResponse = {
        meta: {
          count: 50,
          links: {
            self: 'https://api.example.com/v1/flights/search?page=1',
            next: 'https://api.example.com/v1/flights/search?page=2',
            last: 'https://api.example.com/v1/flights/search?page=5'
          }
        },
        data: Array.from({ length: 50 }, (_, i) => ({
          type: 'flight-offer',
          id: `OFFER_${i + 1}`
        })),
        dictionaries: {}
      };

      mockAmadeusXmlService.searchFlightsXml.mockResolvedValue(mockResponse);

      const response = await request(app)
        .get('/v1/flights/search')
        .query({
          originLocationCode: 'JFK',
          destinationLocationCode: 'LAX',
          departureDate: '2024-12-01',
          max: 50
        })
        .expect(200);

      expect(response.body.meta).toHaveProperty('count', 50);
      expect(response.body.meta).toHaveProperty('links');
      expect(response.body.meta.links).toHaveProperty('self');
      expect(response.body.meta.links).toHaveProperty('next');
      expect(response.body.meta.links).toHaveProperty('last');
    });
  });

  describe('Content Type and Encoding Compatibility', () => {
    test('should handle various content types for file uploads', async () => {
      const mockUploadResponse = {
        id: 'test-id',
        filename: 'test.jpg',
        url: 'https://imagedelivery.net/hash/test-id/public'
      };

      mockCloudflareService.uploadFile.mockResolvedValue(mockUploadResponse);

      // Test JPEG upload
      const jpegResponse = await request(app)
        .post('/v1/files/upload')
        .attach('file', Buffer.from('jpeg content'), {
          filename: 'test.jpg',
          contentType: 'image/jpeg'
        })
        .expect(200);

      expect(jpegResponse.body.filename).toBe('test.jpg');

      // Test PNG upload
      const pngResponse = await request(app)
        .post('/v1/files/upload')
        .attach('file', Buffer.from('png content'), {
          filename: 'test.png',
          contentType: 'image/png'
        })
        .expect(200);

      expect(pngResponse.body.filename).toBe('test.png');
    });

    test('should maintain JSON response encoding', async () => {
      const mockResponse = {
        meta: { count: 1 },
        data: [{
          type: 'flight-offer',
          id: 'OFFER_1',
          // Test unicode characters
          description: 'Flight from New York to Los Angeles ✈️'
        }],
        dictionaries: {}
      };

      mockAmadeusXmlService.searchFlightsXml.mockResolvedValue(mockResponse);

      const response = await request(app)
        .get('/v1/flights/search')
        .query({
          originLocationCode: 'JFK',
          destinationLocationCode: 'LAX',
          departureDate: '2024-12-01'
        })
        .expect(200);

      expect(response.headers['content-type']).toContain('charset=utf-8');
      expect(response.body.data[0].description).toBe('Flight from New York to Los Angeles ✈️');
    });
  });
});