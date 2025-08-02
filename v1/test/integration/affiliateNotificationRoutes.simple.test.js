// v1/test/integration/affiliateNotificationRoutes.simple.test.js
const request = require('supertest');
const app = require('./testApp');
const testDbManager = require('../testDbManager');
const User = require('../../models/userModel');
const Affiliate = require('../../models/affiliateModel');
const jwt = require('jsonwebtoken');

// Mock external services
jest.mock('../../utils/emailService');
jest.mock('../../utils/smsService');

describe('Affiliate Notification Routes - Simple Tests', () => {
  let testUser, testAffiliate, authToken;

  beforeAll(async () => {
    await testDbManager.connect();
  });

  afterAll(async () => {
    await testDbManager.disconnect();
  });

  beforeEach(async () => {
    await testDbManager.cleanDatabase();

    // Create test user
    testUser = await User.create({
      firstName: 'Test',
      lastName: 'Affiliate',
      email: 'affiliate@test.com',
      phoneNumber: '+2348123456789',
      password: 'password123',
      role: 'User',
      isEmailVerified: true,
      isPhoneVerified: true
    });

    // Create test affiliate
    testAffiliate = await Affiliate.create({
      userId: testUser._id,
      businessName: 'Test Business',
      businessEmail: 'business@test.com',
      businessPhone: '+2348123456789',
      businessAddress: {
        street: '123 Test Street',
        city: 'Lagos',
        state: 'Lagos',
        country: 'Nigeria'
      },
      affiliateId: 'AFF-TEST-001',
      referralCode: 'TEST-REF-001',
      status: 'active',
      notificationPreferences: {
        email: true,
        sms: false,
        monthlyStatements: true
      }
    });

    // Generate simple JWT token for testing
    authToken = jwt.sign(
      { 
        userId: testUser._id, 
        role: testUser.role 
      },
      process.env.JWT_ACCESS_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  describe('GET /api/v1/affiliate-notifications/:affiliateId/preferences', () => {
    it('should get notification preferences successfully', async () => {
      const response = await request(app)
        .get(`/api/v1/affiliate-notifications/${testAffiliate._id}/preferences`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          email: true,
          sms: false,
          monthlyStatements: true
        },
        message: 'Notification preferences retrieved successfully'
      });
    });

    it('should require authentication', async () => {
      await request(app)
        .get(`/api/v1/affiliate-notifications/${testAffiliate._id}/preferences`)
        .expect(401);
    });
  });

  describe('PUT /api/v1/affiliate-notifications/:affiliateId/preferences', () => {
    it('should update notification preferences successfully', async () => {
      const newPreferences = {
        email: false,
        sms: true,
        monthlyStatements: false
      };

      const response = await request(app)
        .put(`/api/v1/affiliate-notifications/${testAffiliate._id}/preferences`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(newPreferences)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: newPreferences,
        message: 'Notification preferences updated successfully'
      });

      // Verify preferences were updated in database
      const updatedAffiliate = await Affiliate.findById(testAffiliate._id);
      expect(updatedAffiliate.notificationPreferences).toEqual(newPreferences);
    });

    it('should validate preference keys', async () => {
      const invalidPreferences = {
        email: true,
        invalidKey: false
      };

      const response = await request(app)
        .put(`/api/v1/affiliate-notifications/${testAffiliate._id}/preferences`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidPreferences)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid preference keys');
    });

    it('should validate preference values are boolean', async () => {
      const invalidPreferences = {
        email: 'true', // Should be boolean
        sms: false
      };

      const response = await request(app)
        .put(`/api/v1/affiliate-notifications/${testAffiliate._id}/preferences`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidPreferences)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('must be a boolean value');
    });
  });
});