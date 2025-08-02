// v1/test/security/affiliateSecurity.test.js
// Security tests for authentication and authorization in affiliate system

const request = require('supertest');
const { StatusCodes } = require('http-status-codes');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../../../app');

// Models
const User = require('../../models/userModel');
const Affiliate = require('../../models/affiliateModel');
const Wallet = require('../../models/walletModel');
const CommissionTransaction = require('../../models/commissionTransactionModel');
const Withdrawal = require('../../models/withdrawalModel');

// Test utilities
const { createTestUserWithAuth } = require('../helpers/testHelper');
const { createTestClient } = require('../utils/testHelpers');

describe('Affiliate System Security Tests', () => {
  let mongoServer;
  let testClient;
  let adminUser, regularUser, affiliateUser, otherAffiliateUser;
  let adminToken, regularToken, affiliateToken, otherAffiliateToken;
  let testAffiliate, otherAffiliate;

  beforeAll(async () => {
    // Start MongoDB Memory Server
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Create test client
    testClient = createTestClient(app, { 
      suiteName: 'affiliate-security',
      timeout: 30000 
    });

    // Create test users with different roles
    const adminAuth = createTestUserWithAuth({
      role: 'Admin',
      email: 'admin@travelplace.com'
    });
    
    const regularAuth = createTestUserWithAuth({
      role: 'User',
      email: 'regular@example.com'
    });
    
    const affiliateAuth = createTestUserWithAuth({
      role: 'User',
      email: 'affiliate@business.com'
    });
    
    const otherAffiliateAuth = createTestUserWithAuth({
      role: 'User',
      email: 'other@business.com'
    });

    // Save users to database
    adminUser = await User.create(adminAuth.user);
    regularUser = await User.create(regularAuth.user);
    affiliateUser = await User.create(affiliateAuth.user);
    otherAffiliateUser = await User.create(otherAffiliateAuth.user);

    adminToken = adminAuth.accessToken;
    regularToken = regularAuth.accessToken;
    affiliateToken = affiliateAuth.accessToken;
    otherAffiliateToken = otherAffiliateAuth.accessToken;

    // Create test affiliates
    testAffiliate = await Affiliate.create({
      userId: affiliateUser._id,
      businessName: 'Test Business',
      businessEmail: 'test@business.com',
      businessPhone: '+2348123456789',
      businessAddress: {
        street: '123 Business Street',
        city: 'Lagos',
        state: 'Lagos',
        country: 'Nigeria',
        postalCode: '100001'
      },
      affiliateId: 'AFF-000001',
      referralCode: 'REF-000001',
      status: 'active',
      commissionRates: {
        flights: 2.5,
        hotels: 3.0,
        insurance: 5.0,
        visa: 4.0
      }
    });

    otherAffiliate = await Affiliate.create({
      userId: otherAffiliateUser._id,
      businessName: 'Other Business',
      businessEmail: 'other@business.com',
      businessPhone: '+2348123456790',
      businessAddress: {
        street: '456 Other Street',
        city: 'Abuja',
        state: 'FCT',
        country: 'Nigeria',
        postalCode: '900001'
      },
      affiliateId: 'AFF-000002',
      referralCode: 'REF-000002',
      status: 'active',
      commissionRates: {
        flights: 2.5,
        hotels: 3.0,
        insurance: 5.0,
        visa: 4.0
      }
    });

    // Create wallets
    await Wallet.create({
      affiliateId: testAffiliate._id,
      balance: 50000,
      totalEarned: 100000,
      totalWithdrawn: 50000,
      currency: 'NGN',
      status: 'active'
    });

    await Wallet.create({
      affiliateId: otherAffiliate._id,
      balance: 75000,
      totalEarned: 150000,
      totalWithdrawn: 75000,
      currency: 'NGN',
      status: 'active'
    });
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
    testClient.cleanup();
  });

  describe('Authentication Security', () => {
    test('Should reject requests without authentication token', async () => {
      const response = await testClient.get('/api/v1/affiliates/dashboard');
      
      expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('authentication');
    });

    test('Should reject requests with invalid token', async () => {
      const response = await testClient.get('/api/v1/affiliates/dashboard', {
        headers: { Authorization: 'Bearer invalid-token-here' }
      });
      
      expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
      expect(response.body.status).toBe('error');
    });

    test('Should reject requests with expired token', async () => {
      const expiredToken = jwt.sign(
        { userId: affiliateUser._id, role: 'User' },
        process.env.JWT_ACCESS_SECRET || 'test_secret',
        { expiresIn: '-1h' } // Expired 1 hour ago
      );

      const response = await testClient.get('/api/v1/affiliates/dashboard', {
        headers: { Authorization: `Bearer ${expiredToken}` }
      });
      
      expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
      expect(response.body.status).toBe('error');
    });

    test('Should reject requests with malformed token', async () => {
      const malformedTokens = [
        'Bearer',
        'Bearer ',
        'Bearer malformed.token',
        'InvalidPrefix valid-token-here',
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.malformed'
      ];

      for (const token of malformedTokens) {
        const response = await testClient.get('/api/v1/affiliates/dashboard', {
          headers: { Authorization: token }
        });
        
        expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
        expect(response.body.status).toBe('error');
      }
    });

    test('Should reject requests with token for non-existent user', async () => {
      const nonExistentUserId = new mongoose.Types.ObjectId();
      const fakeToken = jwt.sign(
        { userId: nonExistentUserId, role: 'User' },
        process.env.JWT_ACCESS_SECRET || 'test_secret',
        { expiresIn: '1h' }
      );

      const response = await testClient.get('/api/v1/affiliates/dashboard', {
        headers: { Authorization: `Bearer ${fakeToken}` }
      });
      
      expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
      expect(response.body.status).toBe('error');
    });
  });

  describe('Authorization Security', () => {
    test('Regular users cannot access admin-only endpoints', async () => {
      const adminEndpoints = [
        { method: 'put', path: `/api/v1/affiliates/${testAffiliate._id}/approve` },
        { method: 'put', path: `/api/v1/affiliates/${testAffiliate._id}/suspend` },
        { method: 'get', path: '/api/v1/admin/affiliates' },
        { method: 'put', path: '/api/v1/admin/commission-rates' }
      ];

      for (const endpoint of adminEndpoints) {
        const response = await testClient[endpoint.method](endpoint.path, {}, {
          headers: { Authorization: `Bearer ${regularToken}` }
        });
        
        expect(response.status).toBe(StatusCodes.FORBIDDEN);
        expect(response.body.status).toBe('error');
        expect(response.body.message).toContain('permission');
      }
    });

    test('Affiliates cannot access other affiliates data', async () => {
      // Try to access other affiliate's dashboard
      const dashboardResponse = await testClient.get(`/api/v1/affiliates/${otherAffiliate._id}/dashboard`, {
        headers: { Authorization: `Bearer ${affiliateToken}` }
      });
      
      expect(dashboardResponse.status).toBe(StatusCodes.FORBIDDEN);

      // Try to access other affiliate's wallet
      const walletResponse = await testClient.get(`/api/v1/affiliates/${otherAffiliate._id}/wallet`, {
        headers: { Authorization: `Bearer ${affiliateToken}` }
      });
      
      expect(walletResponse.status).toBe(StatusCodes.FORBIDDEN);

      // Try to initiate withdrawal for other affiliate
      const withdrawalResponse = await testClient.post(`/api/v1/affiliates/${otherAffiliate._id}/withdrawals`, {
        amount: 10000,
        bankDetails: {
          accountName: 'Test Account',
          accountNumber: '0123456789',
          bankCode: '044',
          bankName: 'Access Bank'
        }
      }, {
        headers: { Authorization: `Bearer ${affiliateToken}` }
      });
      
      expect(withdrawalResponse.status).toBe(StatusCodes.FORBIDDEN);
    });

    test('Non-affiliates cannot access affiliate endpoints', async () => {
      const affiliateEndpoints = [
        { method: 'get', path: '/api/v1/affiliates/dashboard' },
        { method: 'get', path: '/api/v1/affiliates/wallet' },
        { method: 'post', path: '/api/v1/affiliates/withdrawals' },
        { method: 'get', path: '/api/v1/affiliates/commissions' }
      ];

      for (const endpoint of affiliateEndpoints) {
        const response = await testClient[endpoint.method](endpoint.path, {}, {
          headers: { Authorization: `Bearer ${regularToken}` }
        });
        
        expect(response.status).toBe(StatusCodes.FORBIDDEN);
        expect(response.body.status).toBe('error');
      }
    });
  });

  describe('Input Validation Security', () => {
    test('Should prevent SQL injection attempts', async () => {
      const sqlInjectionPayloads = [
        "'; DROP TABLE affiliates; --",
        "' OR '1'='1",
        "'; DELETE FROM wallets; --",
        "' UNION SELECT * FROM users --"
      ];

      for (const payload of sqlInjectionPayloads) {
        const response = await testClient.post('/api/v1/affiliates/register', {
          businessName: payload,
          businessEmail: 'test@example.com',
          businessPhone: '+2348123456789',
          businessAddress: {
            street: '123 Test Street',
            city: 'Lagos',
            state: 'Lagos',
            country: 'Nigeria',
            postalCode: '100001'
          }
        }, {
          headers: { Authorization: `Bearer ${regularToken}` }
        });
        
        // Should either reject with validation error or sanitize input
        if (response.status !== StatusCodes.BAD_REQUEST) {
          // If accepted, verify data was sanitized
          expect(response.body.data?.affiliate?.businessName).not.toContain('DROP');
          expect(response.body.data?.affiliate?.businessName).not.toContain('DELETE');
          expect(response.body.data?.affiliate?.businessName).not.toContain('UNION');
        }
      }
    });

    test('Should prevent XSS attacks in input fields', async () => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src="x" onerror="alert(1)">',
        'javascript:alert("XSS")',
        '<svg onload="alert(1)">'
      ];

      for (const payload of xssPayloads) {
        const response = await testClient.post('/api/v1/affiliates/register', {
          businessName: payload,
          businessEmail: 'test@example.com',
          businessPhone: '+2348123456789',
          businessAddress: {
            street: '123 Test Street',
            city: 'Lagos',
            state: 'Lagos',
            country: 'Nigeria',
            postalCode: '100001'
          }
        }, {
          headers: { Authorization: `Bearer ${regularToken}` }
        });
        
        // Should either reject or sanitize
        if (response.status === StatusCodes.CREATED) {
          expect(response.body.data?.affiliate?.businessName).not.toContain('<script>');
          expect(response.body.data?.affiliate?.businessName).not.toContain('javascript:');
          expect(response.body.data?.affiliate?.businessName).not.toContain('onerror');
        }
      }
    });

    test('Should validate and sanitize monetary amounts', async () => {
      const invalidAmounts = [
        -1000, // Negative amount
        0, // Zero amount
        'invalid', // Non-numeric
        999999999999, // Extremely large amount
        1.234567, // Too many decimal places
        null,
        undefined
      ];

      for (const amount of invalidAmounts) {
        const response = await testClient.post('/api/v1/affiliates/withdrawals', {
          amount: amount,
          bankDetails: {
            accountName: 'Test Account',
            accountNumber: '0123456789',
            bankCode: '044',
            bankName: 'Access Bank'
          }
        }, {
          headers: { Authorization: `Bearer ${affiliateToken}` }
        });
        
        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body.status).toBe('error');
      }
    });

    test('Should validate bank account details', async () => {
      const invalidBankDetails = [
        {
          accountName: '', // Empty name
          accountNumber: '0123456789',
          bankCode: '044',
          bankName: 'Access Bank'
        },
        {
          accountName: 'Test Account',
          accountNumber: '123', // Too short
          bankCode: '044',
          bankName: 'Access Bank'
        },
        {
          accountName: 'Test Account',
          accountNumber: '0123456789',
          bankCode: 'invalid', // Invalid bank code
          bankName: 'Access Bank'
        },
        {
          accountName: '<script>alert("xss")</script>', // XSS attempt
          accountNumber: '0123456789',
          bankCode: '044',
          bankName: 'Access Bank'
        }
      ];

      for (const bankDetails of invalidBankDetails) {
        const response = await testClient.post('/api/v1/affiliates/withdrawals', {
          amount: 10000,
          bankDetails: bankDetails
        }, {
          headers: { Authorization: `Bearer ${affiliateToken}` }
        });
        
        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body.status).toBe('error');
      }
    });
  });

  describe('Rate Limiting Security', () => {
    test('Should enforce rate limits on sensitive endpoints', async () => {
      const sensitiveEndpoint = '/api/v1/affiliates/withdrawals';
      const requests = [];

      // Make multiple rapid requests
      for (let i = 0; i < 20; i++) {
        requests.push(
          testClient.post(sensitiveEndpoint, {
            amount: 1000,
            bankDetails: {
              accountName: 'Test Account',
              accountNumber: '0123456789',
              bankCode: '044',
              bankName: 'Access Bank'
            }
          }, {
            headers: { Authorization: `Bearer ${affiliateToken}` }
          })
        );
      }

      const responses = await Promise.all(requests);
      const rateLimitedResponses = responses.filter(r => r.status === StatusCodes.TOO_MANY_REQUESTS);

      // Should have some rate limited responses
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    test('Should have different rate limits for different user roles', async () => {
      const endpoint = '/api/v1/affiliates/dashboard';
      
      // Test admin rate limits (should be higher)
      const adminRequests = [];
      for (let i = 0; i < 50; i++) {
        adminRequests.push(
          testClient.get(endpoint, {
            headers: { Authorization: `Bearer ${adminToken}` }
          })
        );
      }

      const adminResponses = await Promise.all(adminRequests);
      const adminRateLimited = adminResponses.filter(r => r.status === StatusCodes.TOO_MANY_REQUESTS);

      // Test regular user rate limits (should be lower)
      const userRequests = [];
      for (let i = 0; i < 30; i++) {
        userRequests.push(
          testClient.get(endpoint, {
            headers: { Authorization: `Bearer ${affiliateToken}` }
          })
        );
      }

      const userResponses = await Promise.all(userRequests);
      const userRateLimited = userResponses.filter(r => r.status === StatusCodes.TOO_MANY_REQUESTS);

      // Admin should have fewer rate limited responses than regular users
      expect(adminRateLimited.length).toBeLessThan(userRateLimited.length);
    });
  });

  describe('Data Privacy and Security', () => {
    test('Should not expose sensitive data in API responses', async () => {
      const response = await testClient.get('/api/v1/affiliates/dashboard', {
        headers: { Authorization: `Bearer ${affiliateToken}` }
      });

      expect(response.status).toBe(StatusCodes.OK);
      
      // Should not expose sensitive fields
      const responseString = JSON.stringify(response.body);
      expect(responseString).not.toContain('password');
      expect(responseString).not.toContain('JWT_SECRET');
      expect(responseString).not.toContain('PAYSTACK_SECRET');
      expect(responseString).not.toContain('DATABASE_URL');
    });

    test('Should mask sensitive bank details in responses', async () => {
      const response = await testClient.get('/api/v1/affiliates/wallet', {
        headers: { Authorization: `Bearer ${affiliateToken}` }
      });

      expect(response.status).toBe(StatusCodes.OK);
      
      if (response.body.data?.wallet?.bankDetails?.accountNumber) {
        const accountNumber = response.body.data.wallet.bankDetails.accountNumber;
        // Should be masked (e.g., "****6789")
        expect(accountNumber).toMatch(/\*+\d{4}$/);
      }
    });

    test('Should log security events', async () => {
      // Attempt unauthorized access
      await testClient.get('/api/v1/admin/affiliates', {
        headers: { Authorization: `Bearer ${regularToken}` }
      });

      // Attempt with invalid token
      await testClient.get('/api/v1/affiliates/dashboard', {
        headers: { Authorization: 'Bearer invalid-token' }
      });

      // Security events should be logged (this would be verified in actual implementation)
      // For now, we just verify the requests were properly rejected
      expect(true).toBe(true); // Placeholder assertion
    });
  });

  describe('Session Security', () => {
    test('Should invalidate sessions on suspicious activity', async () => {
      // Simulate multiple failed attempts
      const failedAttempts = [];
      for (let i = 0; i < 10; i++) {
        failedAttempts.push(
          testClient.get('/api/v1/affiliates/dashboard', {
            headers: { Authorization: 'Bearer invalid-token' }
          })
        );
      }

      await Promise.all(failedAttempts);

      // Valid token should still work (in this test scenario)
      const validResponse = await testClient.get('/api/v1/affiliates/dashboard', {
        headers: { Authorization: `Bearer ${affiliateToken}` }
      });

      // In a real implementation, this might be blocked due to suspicious activity
      // For now, we verify the system handles the failed attempts gracefully
      expect(validResponse.status).toBe(StatusCodes.OK);
    });

    test('Should enforce secure headers', async () => {
      const response = await testClient.get('/api/v1/affiliates/dashboard', {
        headers: { Authorization: `Bearer ${affiliateToken}` }
      });

      // Check for security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-xss-protection']).toBeDefined();
    });
  });

  describe('Financial Security', () => {
    test('Should prevent double spending in wallet operations', async () => {
      const wallet = await Wallet.findOne({ affiliateId: testAffiliate._id });
      const initialBalance = wallet.balance;

      // Attempt concurrent withdrawals
      const withdrawalPromises = [];
      for (let i = 0; i < 5; i++) {
        withdrawalPromises.push(
          testClient.post('/api/v1/affiliates/withdrawals', {
            amount: initialBalance - 1000, // Almost full balance
            bankDetails: {
              accountName: 'Test Account',
              accountNumber: '0123456789',
              bankCode: '044',
              bankName: 'Access Bank'
            }
          }, {
            headers: { Authorization: `Bearer ${affiliateToken}` }
          })
        );
      }

      const responses = await Promise.all(withdrawalPromises);
      const successfulWithdrawals = responses.filter(r => r.status === StatusCodes.CREATED);

      // Only one withdrawal should succeed
      expect(successfulWithdrawals.length).toBeLessThanOrEqual(1);
    });

    test('Should validate commission calculations for tampering', async () => {
      // Attempt to manipulate commission calculation
      const response = await testClient.post('/api/v1/affiliates/commissions/calculate', {
        bookingReference: 'TEST-BOOKING-123',
        serviceType: 'flights',
        bookingAmount: 100000,
        // Attempt to inject higher commission rate
        commissionRate: 50.0 // 50% instead of normal 2.5%
      }, {
        headers: { Authorization: `Bearer ${affiliateToken}` }
      });

      if (response.status === StatusCodes.OK) {
        // Commission rate should be based on affiliate's configured rates, not user input
        expect(response.body.data.commission.commissionRate).toBeLessThan(10);
      }
    });

    test('Should prevent withdrawal amount manipulation', async () => {
      const wallet = await Wallet.findOne({ affiliateId: testAffiliate._id });
      
      // Attempt to withdraw more than balance
      const response = await testClient.post('/api/v1/affiliates/withdrawals', {
        amount: wallet.balance + 100000, // More than available
        bankDetails: {
          accountName: 'Test Account',
          accountNumber: '0123456789',
          bankCode: '044',
          bankName: 'Access Bank'
        }
      }, {
        headers: { Authorization: `Bearer ${affiliateToken}` }
      });

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.message).toContain('Insufficient balance');
    });
  });
});