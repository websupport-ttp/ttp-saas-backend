// v1/test/integration/affiliateDashboard.test.js
const request = require('supertest');
const { StatusCodes } = require('http-status-codes');
const app = require('../../../app');
const User = require('../../models/userModel');
const Affiliate = require('../../models/affiliateModel');
const Wallet = require('../../models/walletModel');
const WalletTransaction = require('../../models/walletTransactionModel');
const CommissionTransaction = require('../../models/commissionTransactionModel');
const Referral = require('../../models/referralModel');
const Withdrawal = require('../../models/withdrawalModel');
const testDbManager = require('../testDbManager');
const { generateToken } = require('../../utils/jwt');

// Helper functions for generating test data
const generateTestUser = async (overrides = {}) => {
  const User = require('../../models/userModel');
  const userData = {
    firstName: 'Test',
    lastName: 'User',
    email: `test${Date.now()}@example.com`,
    password: 'TestPassword123!',
    role: 'Business',
    isEmailVerified: true,
    isPhoneVerified: true,
    ...overrides
  };
  
  return await User.create(userData);
};

const generateTestAffiliate = async (overrides = {}) => {
  const Affiliate = require('../../models/affiliateModel');
  const affiliateData = {
    affiliateId: `AFF-${Date.now()}`,
    referralCode: `REF-${Date.now()}`,
    businessName: 'Test Business',
    businessEmail: 'business@example.com',
    businessPhone: '+2348012345678',
    businessAddress: {
      street: '123 Test Street',
      city: 'Lagos',
      state: 'Lagos',
      country: 'Nigeria'
    },
    status: 'active',
    commissionRates: {
      flights: 2.5,
      hotels: 3.0,
      insurance: 1.5,
      visa: 2.0
    },
    totalReferrals: 0,
    totalCommissionsEarned: 0,
    ...overrides
  };
  
  return await Affiliate.create(affiliateData);
};

describe('Affiliate Dashboard API Integration Tests', () => {
  let testUser;
  let testAffiliate;
  let testWallet;
  let authToken;

  beforeAll(async () => {
    // Set test environment variables
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-affiliate-dashboard-tests';
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
    testUser = await generateTestUser({
      role: 'Business'
    });

    // Create test affiliate
    testAffiliate = await generateTestAffiliate({
      userId: testUser._id,
      status: 'active'
    });

    // Create test wallet
    const Wallet = require('../../models/walletModel');
    testWallet = await Wallet.create({
      affiliateId: testAffiliate._id,
      balance: 5000,
      totalEarned: 10000,
      totalWithdrawn: 5000,
      currency: 'NGN',
      status: 'active',
      bankDetails: {
        accountName: 'Test Business',
        accountNumber: '1234567890',
        bankCode: '044',
        bankName: 'Access Bank'
      }
    });

    // Generate auth token
    authToken = generateToken({ id: testUser._id, role: testUser.role });
  });

  describe('GET /api/v1/affiliates/:affiliateId/dashboard/wallet', () => {
    it('should get affiliate wallet information successfully', async () => {
      const response = await request(app)
        .get(`/api/v1/affiliates/${testAffiliate.affiliateId}/dashboard/wallet`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(StatusCodes.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Wallet information retrieved successfully');
      expect(response.body.data).toHaveProperty('balance', 5000);
      expect(response.body.data).toHaveProperty('totalEarned', 10000);
      expect(response.body.data).toHaveProperty('totalWithdrawn', 5000);
      expect(response.body.data).toHaveProperty('currency', 'NGN');
    });

    it('should deny access to other users wallet', async () => {
      const otherUser = await generateTestUser({ role: 'Business' });
      const otherToken = generateToken({ id: otherUser._id, role: otherUser.role });

      await request(app)
        .get(`/api/v1/affiliates/${testAffiliate.affiliateId}/dashboard/wallet`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(StatusCodes.FORBIDDEN);
    });

    it('should return 404 for non-existent affiliate', async () => {
      await request(app)
        .get('/api/v1/affiliates/AFF-999999/dashboard/wallet')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(StatusCodes.NOT_FOUND);
    });
  });

  describe('GET /api/v1/affiliates/:affiliateId/dashboard/wallet/transactions', () => {
    beforeEach(async () => {
      // Create test wallet transactions
      const WalletTransaction = require('../../models/walletTransactionModel');
      await WalletTransaction.create([
        {
          walletId: testWallet._id,
          affiliateId: testAffiliate._id,
          type: 'commission_credit',
          amount: 1000,
          balance: 1000,
          description: 'Commission from flight booking',
          reference: 'COMM-001',
          status: 'completed'
        },
        {
          walletId: testWallet._id,
          affiliateId: testAffiliate._id,
          type: 'withdrawal_debit',
          amount: -500,
          balance: 500,
          description: 'Withdrawal to bank account',
          reference: 'WITH-001',
          status: 'completed'
        }
      ]);
    });

    it('should get wallet transaction history successfully', async () => {
      const response = await request(app)
        .get(`/api/v1/affiliates/${testAffiliate.affiliateId}/dashboard/wallet/transactions`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(StatusCodes.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Wallet transaction history retrieved successfully');
      expect(response.body.data).toHaveProperty('transactions');
      expect(response.body.data.transactions).toHaveLength(2);
      expect(response.body.data).toHaveProperty('pagination');
    });

    it('should filter transactions by type', async () => {
      const response = await request(app)
        .get(`/api/v1/affiliates/${testAffiliate.affiliateId}/dashboard/wallet/transactions?type=commission_credit`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(StatusCodes.OK);

      expect(response.body.data.transactions).toHaveLength(1);
      expect(response.body.data.transactions[0].type).toBe('commission_credit');
    });

    it('should paginate transaction results', async () => {
      const response = await request(app)
        .get(`/api/v1/affiliates/${testAffiliate.affiliateId}/dashboard/wallet/transactions?page=1&limit=1`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(StatusCodes.OK);

      expect(response.body.data.transactions).toHaveLength(1);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(1);
    });
  });

  describe('GET /api/v1/affiliates/:affiliateId/dashboard/commissions', () => {
    beforeEach(async () => {
      // Create test commission transactions
      const CommissionTransaction = require('../../models/commissionTransactionModel');
      await CommissionTransaction.create([
        {
          affiliateId: testAffiliate._id,
          bookingReference: 'FLIGHT-001',
          serviceType: 'flight',
          bookingAmount: 50000,
          commissionRate: 2.5,
          commissionAmount: 1250,
          status: 'approved'
        },
        {
          affiliateId: testAffiliate._id,
          bookingReference: 'HOTEL-001',
          serviceType: 'hotel',
          bookingAmount: 30000,
          commissionRate: 3.0,
          commissionAmount: 900,
          status: 'pending'
        }
      ]);
    });

    it('should get commission history successfully', async () => {
      const response = await request(app)
        .get(`/api/v1/affiliates/${testAffiliate.affiliateId}/dashboard/commissions`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(StatusCodes.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Commission history retrieved successfully');
      expect(response.body.data).toHaveProperty('commissions');
      expect(response.body.data.commissions).toHaveLength(2);
    });

    it('should filter commissions by status', async () => {
      const response = await request(app)
        .get(`/api/v1/affiliates/${testAffiliate.affiliateId}/dashboard/commissions?status=approved`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(StatusCodes.OK);

      expect(response.body.data.commissions).toHaveLength(1);
      expect(response.body.data.commissions[0].status).toBe('approved');
    });

    it('should filter commissions by service type', async () => {
      const response = await request(app)
        .get(`/api/v1/affiliates/${testAffiliate.affiliateId}/dashboard/commissions?serviceType=flight`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(StatusCodes.OK);

      expect(response.body.data.commissions).toHaveLength(1);
      expect(response.body.data.commissions[0].serviceType).toBe('flight');
    });
  });

  describe('GET /api/v1/affiliates/:affiliateId/dashboard/referrals', () => {
    beforeEach(async () => {
      // Create test referrals
      const customer1 = await generateTestUser({ role: 'Customer' });
      const customer2 = await generateTestUser({ role: 'Customer' });

      const Referral = require('../../models/referralModel');
      await Referral.create([
        {
          affiliateId: testAffiliate._id,
          customerId: customer1._id,
          referralCode: testAffiliate.referralCode,
          referralSource: 'qr_code',
          totalBookings: 2,
          totalValue: 80000,
          status: 'converted'
        },
        {
          affiliateId: testAffiliate._id,
          customerId: customer2._id,
          referralCode: testAffiliate.referralCode,
          referralSource: 'link',
          totalBookings: 1,
          totalValue: 30000,
          status: 'active'
        }
      ]);
    });

    it('should get referral tracking data successfully', async () => {
      const response = await request(app)
        .get(`/api/v1/affiliates/${testAffiliate.affiliateId}/dashboard/referrals`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(StatusCodes.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Referral tracking data retrieved successfully');
      expect(response.body.data).toHaveProperty('referrals');
      expect(response.body.data.referrals).toHaveLength(2);
    });

    it('should filter referrals by status', async () => {
      const response = await request(app)
        .get(`/api/v1/affiliates/${testAffiliate.affiliateId}/dashboard/referrals?status=converted`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(StatusCodes.OK);

      expect(response.body.data.referrals).toHaveLength(1);
      expect(response.body.data.referrals[0].status).toBe('converted');
    });
  });

  describe('POST /api/v1/affiliates/:affiliateId/dashboard/withdrawals', () => {
    it('should request withdrawal successfully', async () => {
      const withdrawalData = {
        amount: 2000,
        bankDetails: {
          accountName: 'Test Business Account',
          accountNumber: '9876543210',
          bankCode: '058',
          bankName: 'GTBank'
        }
      };

      const response = await request(app)
        .post(`/api/v1/affiliates/${testAffiliate.affiliateId}/dashboard/withdrawals`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(withdrawalData)
        .expect(StatusCodes.CREATED);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Withdrawal request submitted successfully');
      expect(response.body.data).toHaveProperty('amount', 2000);
      expect(response.body.data).toHaveProperty('status', 'pending');
      expect(response.body.data.bankDetails).toMatchObject(withdrawalData.bankDetails);
    });

    it('should reject withdrawal with insufficient balance', async () => {
      const withdrawalData = {
        amount: 10000, // More than available balance
        bankDetails: {
          accountName: 'Test Business Account',
          accountNumber: '9876543210',
          bankCode: '058',
          bankName: 'GTBank'
        }
      };

      await request(app)
        .post(`/api/v1/affiliates/${testAffiliate.affiliateId}/dashboard/withdrawals`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(withdrawalData)
        .expect(StatusCodes.BAD_REQUEST);
    });

    it('should validate withdrawal amount', async () => {
      const withdrawalData = {
        amount: 50, // Below minimum
        bankDetails: {
          accountName: 'Test Business Account',
          accountNumber: '9876543210',
          bankCode: '058',
          bankName: 'GTBank'
        }
      };

      await request(app)
        .post(`/api/v1/affiliates/${testAffiliate.affiliateId}/dashboard/withdrawals`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(withdrawalData)
        .expect(StatusCodes.BAD_REQUEST);
    });

    it('should validate bank details', async () => {
      const withdrawalData = {
        amount: 1000,
        bankDetails: {
          accountName: 'Test Business Account',
          accountNumber: '123', // Invalid account number
          bankCode: '058',
          bankName: 'GTBank'
        }
      };

      await request(app)
        .post(`/api/v1/affiliates/${testAffiliate.affiliateId}/dashboard/withdrawals`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(withdrawalData)
        .expect(StatusCodes.BAD_REQUEST);
    });
  });

  describe('GET /api/v1/affiliates/:affiliateId/dashboard/withdrawals', () => {
    beforeEach(async () => {
      // Create test withdrawals
      const Withdrawal = require('../../models/withdrawalModel');
      await Withdrawal.create([
        {
          affiliateId: testAffiliate._id,
          walletId: testWallet._id,
          amount: 2000,
          currency: 'NGN',
          bankDetails: {
            accountName: 'Test Business',
            accountNumber: '1234567890',
            bankCode: '044',
            bankName: 'Access Bank'
          },
          status: 'completed',
          processedAt: new Date()
        },
        {
          affiliateId: testAffiliate._id,
          walletId: testWallet._id,
          amount: 1500,
          currency: 'NGN',
          bankDetails: {
            accountName: 'Test Business',
            accountNumber: '1234567890',
            bankCode: '044',
            bankName: 'Access Bank'
          },
          status: 'pending'
        }
      ]);
    });

    it('should get withdrawal history successfully', async () => {
      const response = await request(app)
        .get(`/api/v1/affiliates/${testAffiliate.affiliateId}/dashboard/withdrawals`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(StatusCodes.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Withdrawal history retrieved successfully');
      expect(response.body.data).toHaveProperty('withdrawals');
      expect(response.body.data.withdrawals).toHaveLength(2);
    });

    it('should filter withdrawals by status', async () => {
      const response = await request(app)
        .get(`/api/v1/affiliates/${testAffiliate.affiliateId}/dashboard/withdrawals?status=completed`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(StatusCodes.OK);

      expect(response.body.data.withdrawals).toHaveLength(1);
      expect(response.body.data.withdrawals[0].status).toBe('completed');
    });
  });

  describe('GET /api/v1/affiliates/:affiliateId/dashboard/qr-codes', () => {
    it('should get QR codes successfully', async () => {
      const response = await request(app)
        .get(`/api/v1/affiliates/${testAffiliate.affiliateId}/dashboard/qr-codes`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(StatusCodes.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('QR codes retrieved successfully');
      expect(response.body.data).toHaveProperty('affiliate');
      expect(response.body.data).toHaveProperty('referral');
    });

    it('should handle QR code generation errors gracefully', async () => {
      // Mock QR code service to throw error
      const qrCodeService = require('../../services/qrCodeService');
      const originalGenerateAffiliateQR = qrCodeService.generateAffiliateQR;
      qrCodeService.generateAffiliateQR = jest.fn().mockRejectedValue(new Error('QR generation failed'));

      const response = await request(app)
        .get(`/api/v1/affiliates/${testAffiliate.affiliateId}/dashboard/qr-codes`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(StatusCodes.OK);

      expect(response.body.data).toHaveProperty('error');
      expect(response.body.data.error).toBe('Some QR codes could not be generated');

      // Restore original method
      qrCodeService.generateAffiliateQR = originalGenerateAffiliateQR;
    });
  });

  describe('Authorization Tests', () => {
    let adminUser;
    let adminToken;

    beforeEach(async () => {
      adminUser = await generateTestUser({ role: 'Admin' });
      adminToken = generateToken({ id: adminUser._id, role: adminUser.role });
    });

    it('should allow admin access to any affiliate dashboard', async () => {
      const response = await request(app)
        .get(`/api/v1/affiliates/${testAffiliate.affiliateId}/dashboard/wallet`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(StatusCodes.OK);

      expect(response.body.success).toBe(true);
    });

    it('should require authentication for all dashboard endpoints', async () => {
      await request(app)
        .get(`/api/v1/affiliates/${testAffiliate.affiliateId}/dashboard/wallet`)
        .expect(StatusCodes.UNAUTHORIZED);
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // Mock database error
      const Affiliate = require('../../models/affiliateModel');
      const originalFindOne = Affiliate.findOne;
      Affiliate.findOne = jest.fn().mockRejectedValue(new Error('Database connection failed'));

      await request(app)
        .get(`/api/v1/affiliates/${testAffiliate.affiliateId}/dashboard/wallet`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(StatusCodes.INTERNAL_SERVER_ERROR);

      // Restore original method
      Affiliate.findOne = originalFindOne;
    });

    it('should validate affiliate ID format', async () => {
      await request(app)
        .get('/api/v1/affiliates/invalid-id/dashboard/wallet')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(StatusCodes.NOT_FOUND);
    });
  });
});