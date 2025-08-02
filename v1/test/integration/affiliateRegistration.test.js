// v1/test/integration/affiliateRegistration.test.js
const request = require('supertest');
const app = require('../../../app');
const testDbManager = require('../testDbManager');
const User = require('../../models/userModel');
const Affiliate = require('../../models/affiliateModel');
const Wallet = require('../../models/walletModel');
const { generateToken } = require('../../utils/jwt');

describe('Affiliate Registration Integration Tests', () => {
  let testUser;
  let adminUser;
  let userToken;
  let adminToken;

  beforeAll(async () => {
    // Set test environment variables
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-affiliate-tests';
    process.env.NODE_ENV = 'test';
    
    // Ensure test database connection
    await testDbManager.ensureConnection();
  });

  afterAll(async () => {
    await testDbManager.disconnect();
  });

  beforeEach(async () => {
    // Clean database before each test
    await testDbManager.cleanDatabase();

    // Create test user
    testUser = await User.create({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phoneNumber: '+2348123456789',
      password: 'Password123!',
      role: 'User',
      isEmailVerified: true,
      isPhoneVerified: true
    });

    // Create admin user
    adminUser = await User.create({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@example.com',
      phoneNumber: '+2348987654321',
      password: 'AdminPass123!',
      role: 'Admin',
      isEmailVerified: true,
      isPhoneVerified: true
    });

    // Generate tokens
    userToken = generateToken({ userId: testUser._id, role: testUser.role }, process.env.JWT_SECRET, '1h');
    adminToken = generateToken({ userId: adminUser._id, role: adminUser.role }, process.env.JWT_SECRET, '1h');
  });

  describe('POST /api/v1/affiliates/register', () => {
    const validRegistrationData = {
      businessName: 'Test Travel Agency',
      businessEmail: 'business@testtravelagency.com',
      businessPhone: '+2348111222333',
      businessAddress: {
        street: '123 Business Street',
        city: 'Lagos',
        state: 'Lagos State',
        country: 'Nigeria',
        postalCode: '100001'
      }
    };

    it('should successfully register a new affiliate', async () => {
      const response = await request(app)
        .post('/api/v1/affiliates/register')
        .set('Authorization', `Bearer ${userToken}`)
        .send(validRegistrationData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('pending approval');
      expect(response.body.data).toHaveProperty('affiliateId');
      expect(response.body.data).toHaveProperty('referralCode');
      expect(response.body.data.status).toBe('pending');
      expect(response.body.data.businessName).toBe(validRegistrationData.businessName);

      // Verify affiliate was created in database
      const affiliate = await Affiliate.findOne({ userId: testUser._id });
      expect(affiliate).toBeTruthy();
      expect(affiliate.status).toBe('pending');
      expect(affiliate.affiliateId).toMatch(/^AFF-\d{6}$/);
      expect(affiliate.referralCode).toMatch(/^[A-Z0-9]+-\d{3}$/);

      // Verify wallet was created
      const wallet = await Wallet.findOne({ affiliateId: affiliate._id });
      expect(wallet).toBeTruthy();
      expect(wallet.balance).toBe(0);
      expect(wallet.status).toBe('active');
    });

    it('should prevent duplicate affiliate registration for same user', async () => {
      // First registration
      await request(app)
        .post('/api/v1/affiliates/register')
        .set('Authorization', `Bearer ${userToken}`)
        .send(validRegistrationData)
        .expect(201);

      // Second registration attempt
      const response = await request(app)
        .post('/api/v1/affiliates/register')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          ...validRegistrationData,
          businessName: 'Different Business Name',
          businessEmail: 'different@email.com'
        })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already registered as an affiliate');
    });

    it('should prevent duplicate business email registration', async () => {
      // First registration
      await request(app)
        .post('/api/v1/affiliates/register')
        .set('Authorization', `Bearer ${userToken}`)
        .send(validRegistrationData)
        .expect(201);

      // Create another user
      const anotherUser = await User.create({
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',
        phoneNumber: '+2348555666777',
        password: 'Password123!',
        role: 'User',
        isEmailVerified: true,
        isPhoneVerified: true
      });

      const anotherUserToken = generateToken({ userId: anotherUser._id, role: anotherUser.role }, process.env.JWT_SECRET, '1h');

      // Second registration with same business email
      const response = await request(app)
        .post('/api/v1/affiliates/register')
        .set('Authorization', `Bearer ${anotherUserToken}`)
        .send({
          ...validRegistrationData,
          businessName: 'Different Business Name'
        })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Business email is already registered');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/v1/affiliates/register')
        .send(validRegistrationData)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/v1/affiliates/register')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          businessName: 'Test Business'
          // Missing required fields
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation failed');
    });

    it('should validate business email format', async () => {
      const response = await request(app)
        .post('/api/v1/affiliates/register')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          ...validRegistrationData,
          businessEmail: 'invalid-email'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('valid business email');
    });

    it('should validate business phone format', async () => {
      const response = await request(app)
        .post('/api/v1/affiliates/register')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          ...validRegistrationData,
          businessPhone: 'invalid-phone'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('valid business phone');
    });

    it('should validate business address fields', async () => {
      const response = await request(app)
        .post('/api/v1/affiliates/register')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          ...validRegistrationData,
          businessAddress: {
            street: 'A', // Too short
            city: 'Lagos',
            state: 'Lagos State',
            country: 'Nigeria'
          }
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('at least 5 characters');
    });
  });

  describe('PATCH /api/v1/affiliates/:affiliateId/approve', () => {
    let affiliate;

    beforeEach(async () => {
      // Create a pending affiliate
      affiliate = await Affiliate.create({
        userId: testUser._id,
        businessName: 'Test Travel Agency',
        businessEmail: 'business@testtravelagency.com',
        businessPhone: '+2348111222333',
        businessAddress: {
          street: '123 Business Street',
          city: 'Lagos',
          state: 'Lagos State',
          country: 'Nigeria'
        },
        status: 'pending'
      });

      // Create wallet for the affiliate
      await Wallet.create({
        affiliateId: affiliate._id,
        balance: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
        currency: 'NGN',
        status: 'active'
      });
    });

    it('should successfully approve a pending affiliate', async () => {
      const response = await request(app)
        .patch(`/api/v1/affiliates/${affiliate.affiliateId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('approved successfully');
      expect(response.body.data.status).toBe('active');
      expect(response.body.data.approvedBy).toBeTruthy();
      expect(response.body.data.approvedAt).toBeTruthy();

      // Verify in database
      const updatedAffiliate = await Affiliate.findById(affiliate._id);
      expect(updatedAffiliate.status).toBe('active');
      expect(updatedAffiliate.approvedBy.toString()).toBe(adminUser._id.toString());
      expect(updatedAffiliate.approvedAt).toBeTruthy();
    });

    it('should require admin role', async () => {
      const response = await request(app)
        .patch(`/api/v1/affiliates/${affiliate.affiliateId}/approve`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should return 404 for non-existent affiliate', async () => {
      const response = await request(app)
        .patch('/api/v1/affiliates/AFF-999999/approve')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });

    it('should prevent approving non-pending affiliates', async () => {
      // First approve the affiliate
      await affiliate.approve(adminUser._id);

      // Try to approve again
      const response = await request(app)
        .patch(`/api/v1/affiliates/${affiliate.affiliateId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Only pending affiliates can be approved');
    });
  });

  describe('PATCH /api/v1/affiliates/:affiliateId/suspend', () => {
    let affiliate;

    beforeEach(async () => {
      // Create an active affiliate
      affiliate = await Affiliate.create({
        userId: testUser._id,
        businessName: 'Test Travel Agency',
        businessEmail: 'business@testtravelagency.com',
        businessPhone: '+2348111222333',
        businessAddress: {
          street: '123 Business Street',
          city: 'Lagos',
          state: 'Lagos State',
          country: 'Nigeria'
        },
        status: 'active',
        approvedBy: adminUser._id,
        approvedAt: new Date()
      });

      // Create wallet for the affiliate
      await Wallet.create({
        affiliateId: affiliate._id,
        balance: 1000,
        totalEarned: 1000,
        totalWithdrawn: 0,
        currency: 'NGN',
        status: 'active'
      });
    });

    it('should successfully suspend an active affiliate', async () => {
      const suspensionReason = 'Violation of terms and conditions';

      const response = await request(app)
        .patch(`/api/v1/affiliates/${affiliate.affiliateId}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: suspensionReason })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('suspended successfully');
      expect(response.body.data.status).toBe('suspended');
      expect(response.body.data.suspensionReason).toBe(suspensionReason);

      // Verify in database
      const updatedAffiliate = await Affiliate.findById(affiliate._id);
      expect(updatedAffiliate.status).toBe('suspended');
      expect(updatedAffiliate.suspensionReason).toBe(suspensionReason);
      expect(updatedAffiliate.suspendedAt).toBeTruthy();

      // Verify wallet is frozen
      const wallet = await Wallet.findOne({ affiliateId: affiliate._id });
      expect(wallet.status).toBe('frozen');
    });

    it('should require suspension reason', async () => {
      const response = await request(app)
        .patch(`/api/v1/affiliates/${affiliate.affiliateId}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Suspension reason is required');
    });

    it('should validate suspension reason length', async () => {
      const response = await request(app)
        .patch(`/api/v1/affiliates/${affiliate.affiliateId}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Short' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('at least 10 characters');
    });

    it('should require admin role', async () => {
      const response = await request(app)
        .patch(`/api/v1/affiliates/${affiliate.affiliateId}/suspend`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ reason: 'Valid suspension reason here' })
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PATCH /api/v1/affiliates/:affiliateId/reactivate', () => {
    let affiliate;

    beforeEach(async () => {
      // Create a suspended affiliate
      affiliate = await Affiliate.create({
        userId: testUser._id,
        businessName: 'Test Travel Agency',
        businessEmail: 'business@testtravelagency.com',
        businessPhone: '+2348111222333',
        businessAddress: {
          street: '123 Business Street',
          city: 'Lagos',
          state: 'Lagos State',
          country: 'Nigeria'
        },
        status: 'suspended',
        suspensionReason: 'Previous violation',
        suspendedAt: new Date()
      });

      // Create frozen wallet for the affiliate
      await Wallet.create({
        affiliateId: affiliate._id,
        balance: 1000,
        totalEarned: 1000,
        totalWithdrawn: 0,
        currency: 'NGN',
        status: 'frozen'
      });
    });

    it('should successfully reactivate a suspended affiliate', async () => {
      const response = await request(app)
        .patch(`/api/v1/affiliates/${affiliate.affiliateId}/reactivate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('reactivated successfully');
      expect(response.body.data.status).toBe('active');

      // Verify in database
      const updatedAffiliate = await Affiliate.findById(affiliate._id);
      expect(updatedAffiliate.status).toBe('active');
      expect(updatedAffiliate.suspensionReason).toBeNull();
      expect(updatedAffiliate.suspendedAt).toBeNull();

      // Verify wallet is unfrozen
      const wallet = await Wallet.findOne({ affiliateId: affiliate._id });
      expect(wallet.status).toBe('active');
    });

    it('should prevent reactivating non-suspended affiliates', async () => {
      // Change status to active
      affiliate.status = 'active';
      await affiliate.save();

      const response = await request(app)
        .patch(`/api/v1/affiliates/${affiliate.affiliateId}/reactivate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Only suspended affiliates can be reactivated');
    });

    it('should require admin role', async () => {
      const response = await request(app)
        .patch(`/api/v1/affiliates/${affiliate.affiliateId}/reactivate`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/affiliates/me', () => {
    let affiliate;

    beforeEach(async () => {
      // Create an affiliate for the test user
      affiliate = await Affiliate.create({
        userId: testUser._id,
        businessName: 'Test Travel Agency',
        businessEmail: 'business@testtravelagency.com',
        businessPhone: '+2348111222333',
        businessAddress: {
          street: '123 Business Street',
          city: 'Lagos',
          state: 'Lagos State',
          country: 'Nigeria'
        },
        status: 'active'
      });
    });

    it('should return current user affiliate account', async () => {
      const response = await request(app)
        .get('/api/v1/affiliates/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.affiliateId).toBe(affiliate.affiliateId);
      expect(response.body.data.businessName).toBe(affiliate.businessName);
      expect(response.body.data.userId).toBeTruthy();
    });

    it('should return 404 if user has no affiliate account', async () => {
      // Create another user without affiliate account
      const anotherUser = await User.create({
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',
        phoneNumber: '+2348555666777',
        password: 'Password123!',
        role: 'User',
        isEmailVerified: true,
        isPhoneVerified: true
      });

      const anotherUserToken = generateToken({ userId: anotherUser._id, role: anotherUser.role }, process.env.JWT_SECRET, '1h');

      const response = await request(app)
        .get('/api/v1/affiliates/me')
        .set('Authorization', `Bearer ${anotherUserToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found for this user');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/v1/affiliates/me')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/affiliates/validate-referral/:referralCode', () => {
    let affiliate;

    beforeEach(async () => {
      // Create an active affiliate
      affiliate = await Affiliate.create({
        userId: testUser._id,
        businessName: 'Test Travel Agency',
        businessEmail: 'business@testtravelagency.com',
        businessPhone: '+2348111222333',
        businessAddress: {
          street: '123 Business Street',
          city: 'Lagos',
          state: 'Lagos State',
          country: 'Nigeria'
        },
        status: 'active'
      });
    });

    it('should validate active referral code', async () => {
      const response = await request(app)
        .get(`/api/v1/affiliates/validate-referral/${affiliate.referralCode}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isValid).toBe(true);
      expect(response.body.data.affiliateId).toBe(affiliate.affiliateId);
      expect(response.body.data.referralCode).toBe(affiliate.referralCode);
      expect(response.body.data.businessName).toBe(affiliate.businessName);
    });

    it('should reject inactive referral code', async () => {
      // Suspend the affiliate
      affiliate.status = 'suspended';
      await affiliate.save();

      const response = await request(app)
        .get(`/api/v1/affiliates/validate-referral/${affiliate.referralCode}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid or inactive referral code');
    });

    it('should reject non-existent referral code', async () => {
      const response = await request(app)
        .get('/api/v1/affiliates/validate-referral/INVALID-123')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid or inactive referral code');
    });

    it('should be accessible without authentication', async () => {
      const response = await request(app)
        .get(`/api/v1/affiliates/validate-referral/${affiliate.referralCode}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});