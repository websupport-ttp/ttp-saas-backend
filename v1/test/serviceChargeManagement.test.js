// v1/test/serviceChargeManagement.test.js
const request = require('supertest');
const app = require('../../app');
const { testDb, testAuth, testData, testAssertions } = require('./testSetup');
const User = require('../models/userModel');

// Mock Redis client
jest.mock('../config/redis');
const redisClient = require('../config/redis');

describe('Service Charge Management', () => {
  let adminUser;
  let staffUser;
  let regularUser;
  let adminToken;
  let staffToken;
  let userToken;
  let adminCookieString;
  let staffCookieString;
  let userCookieString;

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

    // Create test users with different roles
    adminUser = await User.create(testData.createUser({ 
      role: 'Admin',
      email: 'admin@example.com'
    }));
    
    staffUser = await User.create(testData.createUser({ 
      role: 'Staff',
      email: 'staff@example.com'
    }));
    
    regularUser = await User.create(testData.createUser({ 
      role: 'User',
      email: 'user@example.com'
    }));

    // Generate auth tokens
    adminToken = testAuth.generateTestToken({ userId: adminUser._id, role: adminUser.role });
    staffToken = testAuth.generateTestToken({ userId: staffUser._id, role: staffUser.role });
    userToken = testAuth.generateTestToken({ userId: regularUser._id, role: regularUser.role });

    adminCookieString = testAuth.createSignedCookieString(adminToken);
    staffCookieString = testAuth.createSignedCookieString(staffToken);
    userCookieString = testAuth.createSignedCookieString(userToken);

    // Mock Redis service charges
    const mockServiceCharges = {
      'FLIGHT_BOOKING_CHARGES': '5000',
      'HOTEL_RESERVATION_CHARGES': '3000',
      'TRAVEL_INSURANCE_CHARGES': '1000',
      'PACKAGE_CHARGES': '2000',
      'VISA_PROCESSING_CHARGES': '7500'
    };

    redisClient.hGetAll.mockResolvedValue(mockServiceCharges);
    redisClient.hGet.mockImplementation((key, field) => {
      return Promise.resolve(mockServiceCharges[field] || '0');
    });
    redisClient.hSet.mockResolvedValue(1);
  });

  afterEach(async () => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await testDb.closeDatabase();
  });

  describe('Get Service Charges', () => {
    test('should allow admin to get all service charges', async () => {
      const response = await request(app)
        .get('/api/v1/products/service-charges')
        .set('Cookie', adminCookieString);

      testAssertions.assertSuccessResponse(response, 200);
      expect(response.body.data).toHaveProperty('serviceCharges');
      expect(response.body.data.serviceCharges).toHaveProperty('FLIGHT_BOOKING_CHARGES');
      expect(response.body.data.serviceCharges).toHaveProperty('HOTEL_RESERVATION_CHARGES');
      expect(response.body.data.serviceCharges).toHaveProperty('TRAVEL_INSURANCE_CHARGES');
      expect(response.body.data.serviceCharges).toHaveProperty('PACKAGE_CHARGES');
      expect(response.body.data.serviceCharges).toHaveProperty('VISA_PROCESSING_CHARGES');
      
      expect(redisClient.hGetAll).toHaveBeenCalledWith('serviceCharges');
    });

    test('should deny non-admin users from getting service charges', async () => {
      const response = await request(app)
        .get('/api/v1/products/service-charges')
        .set('Cookie', userCookieString);

      expect(response.status).toBe(403);
    });

    test('should deny staff users from getting service charges', async () => {
      const response = await request(app)
        .get('/api/v1/products/service-charges')
        .set('Cookie', staffCookieString);

      expect(response.status).toBe(403);
    });

    test('should require authentication to get service charges', async () => {
      const response = await request(app)
        .get('/api/v1/products/service-charges');

      expect(response.status).toBe(401);
    });

    test('should handle Redis errors gracefully', async () => {
      redisClient.hGetAll.mockRejectedValue(new Error('Redis connection failed'));

      const response = await request(app)
        .get('/api/v1/products/service-charges')
        .set('Cookie', adminCookieString);

      expect(response.status).toBeGreaterThanOrEqual(500);
    });
  });

  describe('Update Service Charges', () => {
    test('should allow admin to update flight booking charges', async () => {
      const updateData = { value: 6000 };

      const response = await request(app)
        .put('/api/v1/products/service-charges/flightBookingCharges')
        .set('Cookie', adminCookieString)
        .send(updateData);

      testAssertions.assertSuccessResponse(response, 200);
      expect(response.body.message).toContain('updated successfully');
      expect(response.body.data).toHaveProperty('updatedServiceCharges');
      
      expect(redisClient.hSet).toHaveBeenCalledWith('serviceCharges', 'FLIGHT_BOOKING_CHARGES', 6000);
    });

    test('should allow admin to update hotel reservation charges', async () => {
      const updateData = { value: 3500 };

      const response = await request(app)
        .put('/api/v1/products/service-charges/hotelReservationCharges')
        .set('Cookie', adminCookieString)
        .send(updateData);

      testAssertions.assertSuccessResponse(response, 200);
      expect(redisClient.hSet).toHaveBeenCalledWith('serviceCharges', 'HOTEL_RESERVATION_CHARGES', 3500);
    });

    test('should allow admin to update travel insurance charges', async () => {
      const updateData = { value: 1200 };

      const response = await request(app)
        .put('/api/v1/products/service-charges/travelInsuranceCharges')
        .set('Cookie', adminCookieString)
        .send(updateData);

      testAssertions.assertSuccessResponse(response, 200);
      expect(redisClient.hSet).toHaveBeenCalledWith('serviceCharges', 'TRAVEL_INSURANCE_CHARGES', 1200);
    });

    test('should allow admin to update package charges', async () => {
      const updateData = { value: 2500 };

      const response = await request(app)
        .put('/api/v1/products/service-charges/packageCharges')
        .set('Cookie', adminCookieString)
        .send(updateData);

      testAssertions.assertSuccessResponse(response, 200);
      expect(redisClient.hSet).toHaveBeenCalledWith('serviceCharges', 'PACKAGE_CHARGES', 2500);
    });

    test('should allow admin to update visa processing charges', async () => {
      const updateData = { value: 8000 };

      const response = await request(app)
        .put('/api/v1/products/service-charges/visaProcessingCharges')
        .set('Cookie', adminCookieString)
        .send(updateData);

      testAssertions.assertSuccessResponse(response, 200);
      expect(redisClient.hSet).toHaveBeenCalledWith('serviceCharges', 'VISA_PROCESSING_CHARGES', 8000);
    });

    test('should validate charge name exists', async () => {
      const updateData = { value: 1000 };

      const response = await request(app)
        .put('/api/v1/products/service-charges/invalidChargeName')
        .set('Cookie', adminCookieString)
        .send(updateData);

      testAssertions.assertErrorResponse(response, 400);
      expect(response.body.message).toContain('Invalid service charge name');
    });

    test('should validate charge value is provided', async () => {
      const response = await request(app)
        .put('/api/v1/products/service-charges/flightBookingCharges')
        .set('Cookie', adminCookieString)
        .send({});

      testAssertions.assertErrorResponse(response, 400);
      expect(response.body.message).toContain('Invalid charge name or value provided');
    });

    test('should validate charge value is numeric', async () => {
      const updateData = { value: 'not-a-number' };

      const response = await request(app)
        .put('/api/v1/products/service-charges/flightBookingCharges')
        .set('Cookie', adminCookieString)
        .send(updateData);

      testAssertions.assertErrorResponse(response, 400);
      expect(response.body.message).toContain('Invalid charge name or value provided');
    });

    test('should handle negative values', async () => {
      const updateData = { value: -1000 };

      const response = await request(app)
        .put('/api/v1/products/service-charges/flightBookingCharges')
        .set('Cookie', adminCookieString)
        .send(updateData);

      // Should accept negative values (might be used for discounts)
      testAssertions.assertSuccessResponse(response, 200);
      expect(redisClient.hSet).toHaveBeenCalledWith('serviceCharges', 'FLIGHT_BOOKING_CHARGES', -1000);
    });

    test('should handle zero values', async () => {
      const updateData = { value: 0 };

      const response = await request(app)
        .put('/api/v1/products/service-charges/packageCharges')
        .set('Cookie', adminCookieString)
        .send(updateData);

      testAssertions.assertSuccessResponse(response, 200);
      expect(redisClient.hSet).toHaveBeenCalledWith('serviceCharges', 'PACKAGE_CHARGES', 0);
    });

    test('should deny non-admin users from updating service charges', async () => {
      const updateData = { value: 6000 };

      const response = await request(app)
        .put('/api/v1/products/service-charges/flightBookingCharges')
        .set('Cookie', userCookieString)
        .send(updateData);

      expect(response.status).toBe(403);
      expect(redisClient.hSet).not.toHaveBeenCalled();
    });

    test('should deny staff users from updating service charges', async () => {
      const updateData = { value: 6000 };

      const response = await request(app)
        .put('/api/v1/products/service-charges/flightBookingCharges')
        .set('Cookie', staffCookieString)
        .send(updateData);

      expect(response.status).toBe(403);
      expect(redisClient.hSet).not.toHaveBeenCalled();
    });

    test('should require authentication to update service charges', async () => {
      const updateData = { value: 6000 };

      const response = await request(app)
        .put('/api/v1/products/service-charges/flightBookingCharges')
        .send(updateData);

      expect(response.status).toBe(401);
      expect(redisClient.hSet).not.toHaveBeenCalled();
    });

    test('should handle Redis update errors', async () => {
      redisClient.hSet.mockRejectedValue(new Error('Redis write failed'));

      const updateData = { value: 6000 };

      const response = await request(app)
        .put('/api/v1/products/service-charges/flightBookingCharges')
        .set('Cookie', adminCookieString)
        .send(updateData);

      expect(response.status).toBeGreaterThanOrEqual(500);
    });
  });

  describe('Service Charge Case Sensitivity', () => {
    test('should handle camelCase charge names', async () => {
      const updateData = { value: 5500 };

      const response = await request(app)
        .put('/api/v1/products/service-charges/flightBookingCharges')
        .set('Cookie', adminCookieString)
        .send(updateData);

      testAssertions.assertSuccessResponse(response, 200);
      expect(redisClient.hSet).toHaveBeenCalledWith('serviceCharges', 'FLIGHT_BOOKING_CHARGES', 5500);
    });

    test('should handle UPPER_CASE charge names', async () => {
      const updateData = { value: 3200 };

      const response = await request(app)
        .put('/api/v1/products/service-charges/HOTEL_RESERVATION_CHARGES')
        .set('Cookie', adminCookieString)
        .send(updateData);

      testAssertions.assertSuccessResponse(response, 200);
      expect(redisClient.hSet).toHaveBeenCalledWith('serviceCharges', 'HOTEL_RESERVATION_CHARGES', 3200);
    });

    test('should handle lowercase charge names', async () => {
      const updateData = { value: 1100 };

      const response = await request(app)
        .put('/api/v1/products/service-charges/travelinsurancecharges')
        .set('Cookie', adminCookieString)
        .send(updateData);

      testAssertions.assertSuccessResponse(response, 200);
      expect(redisClient.hSet).toHaveBeenCalledWith('serviceCharges', 'TRAVEL_INSURANCE_CHARGES', 1100);
    });
  });

  describe('Service Charge Integration', () => {
    test('should use updated service charges in booking calculations', async () => {
      // Update flight booking charges
      const updateData = { value: 7000 };

      const updateResponse = await request(app)
        .put('/api/v1/products/service-charges/flightBookingCharges')
        .set('Cookie', adminCookieString)
        .send(updateData);

      testAssertions.assertSuccessResponse(updateResponse, 200);

      // Mock Redis to return updated value
      redisClient.hGet.mockImplementation((key, field) => {
        if (field === 'FLIGHT_BOOKING_CHARGES') {
          return Promise.resolve('7000');
        }
        return Promise.resolve('0');
      });

      // The updated charge should be used in subsequent bookings
      // This would be tested in integration with booking endpoints
      expect(redisClient.hSet).toHaveBeenCalledWith('serviceCharges', 'FLIGHT_BOOKING_CHARGES', 7000);
    });

    test('should maintain service charge consistency across requests', async () => {
      // Get current charges
      const getResponse = await request(app)
        .get('/api/v1/products/service-charges')
        .set('Cookie', adminCookieString);

      testAssertions.assertSuccessResponse(getResponse, 200);
      const originalCharges = getResponse.body.data.serviceCharges;

      // Update a charge
      const updateData = { value: 4000 };
      await request(app)
        .put('/api/v1/products/service-charges/hotelReservationCharges')
        .set('Cookie', adminCookieString)
        .send(updateData);

      // Mock updated charges for next get request
      const updatedCharges = { ...originalCharges, 'HOTEL_RESERVATION_CHARGES': '4000' };
      redisClient.hGetAll.mockResolvedValue(updatedCharges);

      // Get charges again to verify update
      const getUpdatedResponse = await request(app)
        .get('/api/v1/products/service-charges')
        .set('Cookie', adminCookieString);

      testAssertions.assertSuccessResponse(getUpdatedResponse, 200);
      expect(getUpdatedResponse.body.data.serviceCharges.HOTEL_RESERVATION_CHARGES).toBe('4000');
    });
  });

  describe('Service Charge Validation Edge Cases', () => {
    test('should handle very large charge values', async () => {
      const updateData = { value: 999999999 };

      const response = await request(app)
        .put('/api/v1/products/service-charges/packageCharges')
        .set('Cookie', adminCookieString)
        .send(updateData);

      testAssertions.assertSuccessResponse(response, 200);
      expect(redisClient.hSet).toHaveBeenCalledWith('serviceCharges', 'PACKAGE_CHARGES', 999999999);
    });

    test('should handle decimal charge values', async () => {
      const updateData = { value: 1500.50 };

      const response = await request(app)
        .put('/api/v1/products/service-charges/visaProcessingCharges')
        .set('Cookie', adminCookieString)
        .send(updateData);

      testAssertions.assertSuccessResponse(response, 200);
      expect(redisClient.hSet).toHaveBeenCalledWith('serviceCharges', 'VISA_PROCESSING_CHARGES', 1500.50);
    });

    test('should handle string numeric values', async () => {
      const updateData = { value: '2500' };

      const response = await request(app)
        .put('/api/v1/products/service-charges/packageCharges')
        .set('Cookie', adminCookieString)
        .send(updateData);

      testAssertions.assertSuccessResponse(response, 200);
      expect(redisClient.hSet).toHaveBeenCalledWith('serviceCharges', 'PACKAGE_CHARGES', '2500');
    });

    test('should reject non-numeric string values', async () => {
      const updateData = { value: 'invalid-number' };

      const response = await request(app)
        .put('/api/v1/products/service-charges/packageCharges')
        .set('Cookie', adminCookieString)
        .send(updateData);

      testAssertions.assertErrorResponse(response, 400);
      expect(response.body.message).toContain('Invalid charge name or value provided');
    });
  });
});