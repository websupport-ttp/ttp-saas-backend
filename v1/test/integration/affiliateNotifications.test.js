// v1/test/integration/affiliateNotifications.test.js
const request = require('supertest');
const app = require('./testApp');
const testDbManager = require('../testDbManager');
const User = require('../../models/userModel');
const Affiliate = require('../../models/affiliateModel');
const CommissionTransaction = require('../../models/commissionTransactionModel');
const Withdrawal = require('../../models/withdrawalModel');
const Wallet = require('../../models/walletModel');
const AffiliateNotificationService = require('../../services/affiliateNotificationService');
const MonthlyStatementService = require('../../services/monthlyStatementService');

// Mock external services
jest.mock('../../utils/emailService');
jest.mock('../../utils/smsService');

describe('Affiliate Notifications Integration Tests', () => {
  let testUser, testAffiliate, testWallet, authToken;

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

    // Create test wallet
    testWallet = await Wallet.create({
      affiliateId: testAffiliate._id,
      balance: 10000,
      totalEarned: 50000,
      totalWithdrawn: 40000,
      currency: 'NGN',
      status: 'active'
    });

    // Generate auth token directly
    const { generateToken } = require('../../utils/jwt');
    authToken = generateToken({ userId: testUser._id, role: testUser.role }, 'test-jwt-secret', '1h');
  });

  describe('Notification Preferences API', () => {
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

      it('should handle invalid affiliate ID', async () => {
        const response = await request(app)
          .get('/api/v1/affiliate-notifications/invalid-id/preferences')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400);

        expect(response.body.success).toBe(false);
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

  describe('Monthly Statements API', () => {
    beforeEach(async () => {
      // Create test referral first
      const testReferral = await require('../../models/referralModel').create({
        affiliateId: testAffiliate._id,
        customerId: testUser._id,
        referralCode: testAffiliate.referralCode,
        referralSource: 'link',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        status: 'active'
      });

      // Create test commission transactions
      await CommissionTransaction.create([
        {
          affiliateId: testAffiliate._id,
          referralId: testReferral._id,
          bookingReference: 'BK001',
          serviceType: 'flight',
          bookingAmount: 100000,
          commissionRate: 2.5,
          commissionAmount: 2500,
          status: 'approved',
          createdAt: new Date('2024-01-15')
        },
        {
          affiliateId: testAffiliate._id,
          referralId: testReferral._id,
          bookingReference: 'BK002',
          serviceType: 'hotel',
          bookingAmount: 80000,
          commissionRate: 3.0,
          commissionAmount: 2400,
          status: 'paid',
          createdAt: new Date('2024-01-20')
        }
      ]);

      // Create test withdrawals
      await Withdrawal.create([
        {
          affiliateId: testAffiliate._id,
          walletId: testWallet._id,
          amount: 3000,
          currency: 'NGN',
          bankDetails: {
            accountName: 'Test Business',
            accountNumber: '1234567890',
            bankCode: '044',
            bankName: 'Access Bank'
          },
          status: 'completed',
          createdAt: new Date('2024-01-25')
        }
      ]);
    });

    describe('GET /api/v1/affiliate-notifications/:affiliateId/statements', () => {
      it('should get monthly statement successfully', async () => {
        const response = await request(app)
          .get(`/api/v1/affiliate-notifications/${testAffiliate._id}/statements`)
          .query({ year: 2024, month: 1 })
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(expect.objectContaining({
          month: 'January',
          year: 2024,
          totalCommissions: 4900, // 2500 + 2400
          totalWithdrawals: 3000,
          successfulBookings: 2
        }));
      });

      it('should require year and month parameters', async () => {
        const response = await request(app)
          .get(`/api/v1/affiliate-notifications/${testAffiliate._id}/statements`)
          .query({ year: 2024 }) // Missing month
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('Year and month are required');
      });

      it('should validate year and month format', async () => {
        const response = await request(app)
          .get(`/api/v1/affiliate-notifications/${testAffiliate._id}/statements`)
          .query({ year: 'invalid', month: 13 })
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('Invalid year or month format');
      });
    });

    describe('GET /api/v1/affiliate-notifications/:affiliateId/statements/available', () => {
      it('should get available statement months successfully', async () => {
        const response = await request(app)
          .get(`/api/v1/affiliate-notifications/${testAffiliate._id}/statements/available`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual(expect.arrayContaining([
          expect.objectContaining({
            year: 2024,
            month: 1,
            monthName: 'January'
          })
        ]));
      });
    });
  });

  describe('Notification Service Integration', () => {
    describe('Commission Earned Notifications', () => {
      it('should send commission earned notification', async () => {
        const commissionData = {
          _id: 'commission123',
          commissionAmount: 5000,
          serviceType: 'flight',
          bookingReference: 'BK123456',
          commissionRate: 2.5,
          bookingAmount: 200000
        };

        // This should not throw an error
        await expect(
          AffiliateNotificationService.sendCommissionEarnedNotification(commissionData, testAffiliate)
        ).resolves.not.toThrow();
      });

      it('should respect notification preferences', async () => {
        // Update affiliate to disable email notifications
        await Affiliate.findByIdAndUpdate(testAffiliate._id, {
          notificationPreferences: {
            email: false,
            sms: false,
            monthlyStatements: true
          }
        });

        const commissionData = {
          _id: 'commission123',
          commissionAmount: 5000,
          serviceType: 'flight',
          bookingReference: 'BK123456',
          commissionRate: 2.5,
          bookingAmount: 200000
        };

        const updatedAffiliate = await Affiliate.findById(testAffiliate._id);
        
        // Should not throw error even with notifications disabled
        await expect(
          AffiliateNotificationService.sendCommissionEarnedNotification(commissionData, updatedAffiliate)
        ).resolves.not.toThrow();
      });
    });

    describe('Account Status Change Notifications', () => {
      it('should send account status change notification', async () => {
        await expect(
          AffiliateNotificationService.sendAccountStatusChangeNotification(testAffiliate, 'pending', 'active')
        ).resolves.not.toThrow();
      });
    });

    describe('Monthly Statement Generation', () => {
      beforeEach(async () => {
        // Create test referral first
        const testReferral = await require('../../models/referralModel').create({
          affiliateId: testAffiliate._id,
          customerId: testUser._id,
          referralCode: testAffiliate.referralCode,
          referralSource: 'link',
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent',
          status: 'active'
        });

        // Create test data for statement generation
        await CommissionTransaction.create({
          affiliateId: testAffiliate._id,
          referralId: testReferral._id,
          bookingReference: 'BK001',
          serviceType: 'flight',
          bookingAmount: 100000,
          commissionRate: 2.5,
          commissionAmount: 2500,
          status: 'approved',
          createdAt: new Date('2024-01-15')
        });
      });

      it('should generate statement data correctly', async () => {
        const statementData = await MonthlyStatementService.generateStatementData(
          testAffiliate._id,
          2024,
          1
        );

        expect(statementData).toEqual(expect.objectContaining({
          affiliateId: testAffiliate._id,
          affiliateName: testAffiliate.businessName,
          month: 'January',
          year: 2024,
          totalCommissions: 2500,
          currentBalance: 10000
        }));
      });

      it('should send monthly statement', async () => {
        await expect(
          MonthlyStatementService.generateAndSendStatement(testAffiliate._id, 2024, 1)
        ).resolves.not.toThrow();
      });
    });
  });

  describe('Notification Preferences Management', () => {
    it('should update and retrieve preferences correctly', async () => {
      const newPreferences = {
        email: false,
        sms: true,
        monthlyStatements: false
      };

      // Update preferences
      const updatedPreferences = await AffiliateNotificationService.updateNotificationPreferences(
        testAffiliate._id,
        newPreferences
      );

      expect(updatedPreferences).toEqual(newPreferences);

      // Retrieve preferences
      const retrievedPreferences = await AffiliateNotificationService.getNotificationPreferences(
        testAffiliate._id
      );

      expect(retrievedPreferences).toEqual(newPreferences);
    });

    it('should return default preferences when none exist', async () => {
      // Create affiliate without preferences
      const affiliateWithoutPreferences = await Affiliate.create({
        userId: testUser._id,
        businessName: 'Test Business 2',
        businessEmail: 'business2@test.com',
        businessPhone: '+2348123456790',
        businessAddress: {
          street: '123 Test Street',
          city: 'Lagos',
          state: 'Lagos',
          country: 'Nigeria'
        },
        affiliateId: 'AFF-TEST-002',
        referralCode: 'TEST-REF-002',
        status: 'active'
        // No notificationPreferences field
      });

      const preferences = await AffiliateNotificationService.getNotificationPreferences(
        affiliateWithoutPreferences._id
      );

      expect(preferences).toEqual({
        email: true,
        sms: false,
        monthlyStatements: true
      });
    });
  });
});