// v1/test/productBooking.test.js
const request = require('supertest');
const app = require('../../app');
const { testDb, testAuth, testData, mockResponses, testAssertions } = require('./testSetup');
const User = require('../models/userModel');
const Ledger = require('../models/ledgerModel');
const Post = require('../models/postModel');

// Mock external services
jest.mock('../services/paystackService');
jest.mock('../services/amadeusService');
jest.mock('../services/allianzService');
jest.mock('../services/ratehawkService');
jest.mock('../config/redis');

const paystackService = require('../services/paystackService');
const amadeusService = require('../services/amadeusService');
const allianzService = require('../services/allianzService');
const ratehawkService = require('../services/ratehawkService');
const redisClient = require('../config/redis');

describe('Product Booking Flows', () => {
  let testUser;
  let authToken;
  let cookieString;

  beforeAll(async () => {
    // Setup test environment
    process.env.NODE_ENV = 'test';
    process.env.JWT_ACCESS_SECRET = 'test_access_secret_key_for_testing_purposes_only';
    process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_key_for_testing_purposes_only';
    process.env.COOKIE_SECRET = 'test-cookie-secret-for-testing';
    
    // Wait for database to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  beforeEach(async () => {
    // Clear database using global testDB utility
    if (global.testDatabase && global.testDatabase.isConnected) {
      await global.testDatabase.clean();
    } else if (global.testDB) {
      await global.testDB.clean();
    } else {
      await testDb.clearDatabase();
    }

    // Wait a bit for database to be ready
    await new Promise(resolve => setTimeout(resolve, 100));

    // Create test user
    const userData = testData.createUser();
    testUser = await User.create(userData);
    
    // Generate auth token
    authToken = testAuth.generateTestToken({ userId: testUser._id, role: testUser.role });
    cookieString = testAuth.createSignedCookieString(authToken);

    // Mock Redis service charges
    redisClient.hGet.mockImplementation((key, field) => {
      const serviceCharges = {
        'FLIGHT_BOOKING_CHARGES': '5000',
        'HOTEL_RESERVATION_CHARGES': '3000',
        'TRAVEL_INSURANCE_CHARGES': '1000',
        'PACKAGE_CHARGES': '2000',
        'VISA_PROCESSING_CHARGES': '7500'
      };
      return Promise.resolve(serviceCharges[field] || '0');
    });

    redisClient.hGetAll.mockResolvedValue({
      'FLIGHT_BOOKING_CHARGES': '5000',
      'HOTEL_RESERVATION_CHARGES': '3000',
      'TRAVEL_INSURANCE_CHARGES': '1000',
      'PACKAGE_CHARGES': '2000',
      'VISA_PROCESSING_CHARGES': '7500'
    });
  });

  afterEach(async () => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await testDb.closeDatabase();
  });

  describe('Flight Booking Flow', () => {
    beforeEach(() => {
      // Mock Amadeus service
      amadeusService.searchFlights.mockResolvedValue(mockResponses.amadeus.searchFlights);
      amadeusService.bookFlight.mockResolvedValue(mockResponses.amadeus.bookFlight);
      
      // Mock Paystack service
      paystackService.initializePayment.mockResolvedValue(mockResponses.paystack.initializePayment);
      paystackService.verifyPayment.mockResolvedValue(mockResponses.paystack.verifyPayment);
    });

    test('should search for flights successfully', async () => {
      const searchCriteria = {
        origin: 'LOS',
        destination: 'JFK',
        departureDate: '2024-12-01',
        returnDate: '2024-12-15',
        passengers: 1
      };

      const response = await request(app)
        .post('/api/v1/products/flights/search')
        .send(searchCriteria);

      testAssertions.assertSuccessResponse(response, 200);
      expect(response.body.data).toHaveProperty('flights');
      expect(Array.isArray(response.body.data.flights)).toBe(true);
      expect(amadeusService.searchFlights).not.toHaveBeenCalled(); // Mock returns data directly
    });

    test('should initiate flight booking for authenticated user', async () => {
      const bookingData = {
        flightDetails: {
          id: 'FL123',
          price: 500000,
          departure: 'LOS',
          arrival: 'JFK'
        },
        passengerDetails: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          phoneNumber: '+1234567890'
        }
      };

      const response = await request(app)
        .post('/api/v1/products/flights/book')
        .set('Cookie', cookieString)
        .send(bookingData);

      testAssertions.assertSuccessResponse(response, 200);
      expect(response.body.data).toHaveProperty('authorizationUrl');
      expect(response.body.data).toHaveProperty('reference');
      expect(response.body.data).toHaveProperty('amount');
      expect(response.body.data.amount).toBe(505000); // Base price + service charge

      // Verify ledger entry was created
      const ledgerEntry = await Ledger.findOne({ 
        transactionReference: response.body.data.reference 
      });
      expect(ledgerEntry).toBeTruthy();
      expect(ledgerEntry.productType).toBe('Flight Booking');
      expect(ledgerEntry.status).toBe('Pending');
    });

    test('should handle flight booking for guest user', async () => {
      const bookingData = {
        flightDetails: {
          id: 'FL123',
          price: 500000,
          departure: 'LOS',
          arrival: 'JFK'
        },
        passengerDetails: {
          firstName: 'Jane',
          lastName: 'Guest',
          email: 'jane.guest@example.com',
          phoneNumber: '+1234567891'
        }
      };

      const response = await request(app)
        .post('/api/v1/products/flights/book')
        .send(bookingData);

      testAssertions.assertSuccessResponse(response, 200);
      expect(response.body.data).toHaveProperty('authorizationUrl');

      // Verify ledger entry was created with guest details
      const ledgerEntry = await Ledger.findOne({ 
        guestEmail: bookingData.passengerDetails.email 
      });
      expect(ledgerEntry).toBeTruthy();
      expect(ledgerEntry.guestEmail).toBe(bookingData.passengerDetails.email);
      expect(ledgerEntry.userId).toBeNull();
    });

    test('should validate required fields for flight booking', async () => {
      const incompleteBookingData = {
        flightDetails: {
          id: 'FL123'
          // Missing price
        }
      };

      const response = await request(app)
        .post('/api/v1/products/flights/book')
        .set('Cookie', cookieString)
        .send(incompleteBookingData);

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Hotel Booking Flow', () => {
    beforeEach(() => {
      // Mock Ratehawk service
      ratehawkService.searchHotels.mockResolvedValue(mockResponses.ratehawk.searchHotels);
      ratehawkService.bookHotel.mockResolvedValue(mockResponses.ratehawk.bookHotel);
      
      // Mock Paystack service
      paystackService.initializePayment.mockResolvedValue(mockResponses.paystack.initializePayment);
    });

    test('should search for hotels successfully', async () => {
      const searchCriteria = {
        destination: 'Lagos',
        checkIn: '2024-12-01',
        checkOut: '2024-12-03',
        guests: 2
      };

      const response = await request(app)
        .post('/api/v1/products/hotels/search')
        .send(searchCriteria);

      testAssertions.assertSuccessResponse(response, 200);
      expect(response.body.data).toHaveProperty('hotels');
      expect(Array.isArray(response.body.data.hotels)).toBe(true);
    });

    test('should initiate hotel booking successfully', async () => {
      const bookingData = {
        hotelDetails: {
          id: 'HTL001',
          name: 'Test Hotel Lagos',
          price: 150000
        },
        guestDetails: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          phoneNumber: '+1234567890'
        }
      };

      const response = await request(app)
        .post('/api/v1/products/hotels/book')
        .set('Cookie', cookieString)
        .send(bookingData);

      testAssertions.assertSuccessResponse(response, 200);
      expect(response.body.data).toHaveProperty('authorizationUrl');
      expect(response.body.data.amount).toBe(153000); // Base price + service charge

      // Verify ledger entry
      const ledgerEntry = await Ledger.findOne({ 
        productType: 'Hotel Reservation',
        userId: testUser._id 
      });
      expect(ledgerEntry).toBeTruthy();
      expect(ledgerEntry.amount).toBe(150000);
      expect(ledgerEntry.markupApplied).toBe(3000);
    });
  });

  describe('Travel Insurance Flow', () => {
    beforeEach(() => {
      // Mock Allianz service
      allianzService.getQuote.mockResolvedValue(mockResponses.allianz.getQuote);
      allianzService.purchaseIndividual.mockResolvedValue(mockResponses.allianz.purchasePolicy);
      
      // Mock Paystack service
      paystackService.initializePayment.mockResolvedValue(mockResponses.paystack.initializePayment);
    });

    test('should get travel insurance lookup data', async () => {
      const response = await request(app)
        .get('/api/v1/products/travel-insurance/lookup/countries');

      testAssertions.assertSuccessResponse(response, 200);
      expect(response.body.data).toHaveProperty('data');
      expect(Array.isArray(response.body.data.data)).toBe(true);
    });

    test('should get travel insurance quote', async () => {
      const quoteRequest = {
        destination: 'USA',
        travelDates: {
          departure: '2024-12-01',
          return: '2024-12-15'
        },
        travelers: 1
      };

      const response = await request(app)
        .post('/api/v1/products/travel-insurance/quote')
        .send(quoteRequest);

      testAssertions.assertSuccessResponse(response, 200);
      expect(response.body.data).toHaveProperty('QuoteRequestId');
      expect(response.body.data).toHaveProperty('Amount');
    });

    test('should initiate individual travel insurance purchase', async () => {
      const purchaseData = {
        quoteId: 'QUOTE123',
        customerDetails: {
          Email: 'john.doe@example.com',
          Telephone: '+1234567890',
          FirstName: 'John',
          LastName: 'Doe'
        }
      };

      const response = await request(app)
        .post('/api/v1/products/travel-insurance/purchase/individual')
        .set('Cookie', cookieString)
        .send(purchaseData);

      testAssertions.assertSuccessResponse(response, 200);
      expect(response.body.data).toHaveProperty('authorizationUrl');
      expect(response.body.data).toHaveProperty('amount');

      // Verify ledger entry
      const ledgerEntry = await Ledger.findOne({ 
        productType: 'Travel Insurance',
        userId: testUser._id 
      });
      expect(ledgerEntry).toBeTruthy();
      expect(ledgerEntry.markupApplied).toBe(1000);
    });

    test('should initiate family travel insurance purchase', async () => {
      const purchaseData = {
        quoteId: 'QUOTE456',
        familyMembersDetails: [
          {
            Email: 'john.doe@example.com',
            Telephone: '+1234567890',
            FirstName: 'John',
            LastName: 'Doe'
          },
          {
            Email: 'jane.doe@example.com',
            Telephone: '+1234567891',
            FirstName: 'Jane',
            LastName: 'Doe'
          }
        ]
      };

      const response = await request(app)
        .post('/api/v1/products/travel-insurance/purchase/family')
        .set('Cookie', cookieString)
        .send(purchaseData);

      testAssertions.assertSuccessResponse(response, 200);
      expect(response.body.data).toHaveProperty('authorizationUrl');

      // Verify ledger entry for family insurance
      const ledgerEntry = await Ledger.findOne({ 
        productType: 'Travel Insurance',
        guestEmail: purchaseData.familyMembersDetails[0].Email 
      });
      expect(ledgerEntry).toBeTruthy();
    });
  });

  describe('Package Purchase Flow', () => {
    let testPackage;

    beforeEach(async () => {
      // Create a test package
      const packageData = testData.createPost({
        postType: 'Packages',
        price: 250000,
        currency: 'NGN',
        metadata: {
          duration: '7 days',
          location: 'Dubai',
          maxParticipants: 10,
          difficulty: 'Easy',
          inclusions: ['Flights', 'Hotels', 'Tours'],
          exclusions: ['Meals', 'Personal expenses']
        },
        availability: {
          isAvailable: true,
          startDate: new Date(Date.now() - 86400000), // Yesterday
          endDate: new Date(Date.now() + 86400000 * 30) // 30 days from now
        },
        author: testUser._id
      });

      testPackage = await Post.create(packageData);

      // Mock Paystack service
      paystackService.initializePayment.mockResolvedValue(mockResponses.paystack.initializePayment);
      paystackService.verifyPayment.mockResolvedValue(mockResponses.paystack.verifyPayment);
    });

    test('should get available packages', async () => {
      const response = await request(app)
        .get('/api/v1/products/packages');

      testAssertions.assertSuccessResponse(response, 200);
      expect(response.body.data).toHaveProperty('packages');
      expect(response.body.data).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data.packages)).toBe(true);
      expect(response.body.data.packages.length).toBeGreaterThan(0);
    });

    test('should get package details by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/products/packages/${testPackage._id}`);

      testAssertions.assertSuccessResponse(response, 200);
      expect(response.body.data.package).toHaveProperty('title');
      expect(response.body.data.package).toHaveProperty('price');
      expect(response.body.data.package.postType).toBe('Packages');
    });

    test('should get package details by slug', async () => {
      const response = await request(app)
        .get(`/api/v1/products/packages/${testPackage.slug}`);

      testAssertions.assertSuccessResponse(response, 200);
      expect(response.body.data.package.slug).toBe(testPackage.slug);
    });

    test('should initiate package purchase for authenticated user', async () => {
      const purchaseData = {
        participants: 2,
        customerDetails: {
          email: 'john.doe@example.com',
          phoneNumber: '+1234567890'
        },
        specialRequests: 'Vegetarian meals preferred'
      };

      const response = await request(app)
        .post(`/api/v1/products/packages/${testPackage._id}/purchase`)
        .set('Cookie', cookieString)
        .send(purchaseData);

      testAssertions.assertSuccessResponse(response, 200);
      expect(response.body.data).toHaveProperty('authorizationUrl');
      expect(response.body.data).toHaveProperty('packageDetails');
      expect(response.body.data.packageDetails.participants).toBe(2);
      expect(response.body.data.packageDetails.totalAmount).toBe(502000); // (250000 * 2) + 2000

      // Verify ledger entry
      const ledgerEntry = await Ledger.findOne({ 
        packageId: testPackage._id,
        userId: testUser._id 
      });
      expect(ledgerEntry).toBeTruthy();
      expect(ledgerEntry.itemType).toBe('Package');
      expect(ledgerEntry.productDetails.participants).toBe(2);
      expect(ledgerEntry.productDetails.specialRequests).toBe('Vegetarian meals preferred');
    });

    test('should initiate package purchase for guest user', async () => {
      const purchaseData = {
        participants: 1,
        customerDetails: {
          email: 'guest@example.com',
          phoneNumber: '+1234567890',
          firstName: 'Guest',
          lastName: 'User'
        }
      };

      const response = await request(app)
        .post(`/api/v1/products/packages/${testPackage._id}/purchase`)
        .send(purchaseData);

      testAssertions.assertSuccessResponse(response, 200);
      expect(response.body.data.packageDetails.totalAmount).toBe(252000); // 250000 + 2000

      // Verify guest ledger entry
      const ledgerEntry = await Ledger.findOne({ 
        packageId: testPackage._id,
        guestEmail: 'guest@example.com' 
      });
      expect(ledgerEntry).toBeTruthy();
      expect(ledgerEntry.userId).toBeNull();
      expect(ledgerEntry.guestEmail).toBe('guest@example.com');
    });

    test('should verify package payment successfully', async () => {
      // First create a pending transaction
      const ledgerEntry = await Ledger.create({
        userId: testUser._id,
        transactionReference: 'TTP-PKG-TEST-123',
        amount: 250000,
        currency: 'NGN',
        status: 'Pending',
        paymentGateway: 'Paystack',
        productType: 'Package',
        itemType: 'Package',
        packageId: testPackage._id,
        markupApplied: 2000,
        totalAmountPaid: 252000,
        productDetails: {
          packageTitle: testPackage.title,
          participants: 1
        }
      });

      const response = await request(app)
        .post('/api/v1/products/packages/verify-payment')
        .send({ reference: 'TTP-PKG-TEST-123' });

      testAssertions.assertSuccessResponse(response, 200);
      expect(response.body.data.status).toBe('Completed');
      expect(response.body.data.transactionReference).toBe('TTP-PKG-TEST-123');

      // Verify ledger was updated
      const updatedLedger = await Ledger.findById(ledgerEntry._id);
      expect(updatedLedger.status).toBe('Completed');
    });

    test('should validate maximum participants limit', async () => {
      const purchaseData = {
        participants: 15, // Exceeds maxParticipants (10)
        customerDetails: {
          email: 'john.doe@example.com',
          phoneNumber: '+1234567890'
        }
      };

      const response = await request(app)
        .post(`/api/v1/products/packages/${testPackage._id}/purchase`)
        .set('Cookie', cookieString)
        .send(purchaseData);

      testAssertions.assertErrorResponse(response, 400);
      expect(response.body.message).toContain('Maximum 10 participants allowed');
    });

    test('should handle package not found', async () => {
      const fakePackageId = '507f1f77bcf86cd799439011';
      
      const response = await request(app)
        .get(`/api/v1/products/packages/${fakePackageId}`);

      testAssertions.assertErrorResponse(response, 404);
      expect(response.body.message).toContain('Package not found');
    });
  });

  describe('Payment Verification Flow', () => {
    test('should handle payment verification failure', async () => {
      // Mock failed payment verification
      paystackService.verifyPayment.mockResolvedValue({
        data: {
          status: 'failed',
          reference: 'TTP-TEST-FAILED-123'
        }
      });

      // Create a pending transaction
      await Ledger.create({
        userId: testUser._id,
        transactionReference: 'TTP-TEST-FAILED-123',
        amount: 100000,
        currency: 'NGN',
        status: 'Pending',
        paymentGateway: 'Paystack',
        productType: 'Flight Booking',
        itemType: 'Flight'
      });

      const response = await request(app)
        .post('/api/v1/products/packages/verify-payment')
        .send({ reference: 'TTP-TEST-FAILED-123' });

      // Should handle failed payment gracefully
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    test('should handle missing payment reference', async () => {
      const response = await request(app)
        .post('/api/v1/products/packages/verify-payment')
        .send({});

      testAssertions.assertErrorResponse(response, 400);
      expect(response.body.message).toContain('Payment reference is required');
    });
  });
});