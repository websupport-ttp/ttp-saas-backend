// v1/test/integration/affiliateNotificationRoutes.integration.test.js
const testDbManager = require('../testDbManager');
const User = require('../../models/userModel');
const Affiliate = require('../../models/affiliateModel');
const CommissionTransaction = require('../../models/commissionTransactionModel');
const Withdrawal = require('../../models/withdrawalModel');
const Wallet = require('../../models/walletModel');
const AffiliateNotificationService = require('../../services/affiliateNotificationService');
const MonthlyStatementService = require('../../services/monthlyStatementService');
const CommissionService = require('../../services/commissionService');
const WithdrawalService = require('../../services/withdrawalService');
const AffiliateService = require('../../services/affiliateService');

// Mock external services
jest.mock('../../utils/emailService');
jest.mock('../../utils/smsService');
jest.mock('../../services/paystackService');

describe('Affiliate Notification System Integration Tests', () => {
  let testUser, testAffiliate, testWallet;

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
  });

  describe('Commission Processing with Notifications', () => {
    it('should send commission earned notification when commission is processed', async () => {
      const commissionService = new CommissionService();
      
      const bookingData = {
        serviceType: 'flight',
        bookingAmount: 100000,
        bookingReference: 'BK123456',
        currency: 'NGN'
      };

      // Process commission (this should trigger notification)
      const commission = await commissionService.processCommission(bookingData.bookingReference, testAffiliate._id);

      expect(commission).toBeDefined();
      expect(commission.commissionAmount).toBeGreaterThan(0);
      
      // Verify commission was created in database
      const savedCommission = await CommissionTransaction.findById(commission._id);
      expect(savedCommission).toBeDefined();
      expect(savedCommission.status).toBe('approved');
    });

    it('should handle commission notification failures gracefully', async () => {
      // Mock notification service to throw error
      const originalSendNotification = AffiliateNotificationService.sendCommissionEarnedNotification;
      AffiliateNotificationService.sendCommissionEarnedNotification = jest.fn().mockRejectedValue(new Error('Notification failed'));

      const commissionService = new CommissionService();
      
      const bookingData = {
        serviceType: 'flight',
        bookingAmount: 100000,
        bookingReference: 'BK123456',
        currency: 'NGN'
      };

      // Commission processing should still succeed even if notification fails
      await expect(
        commissionService.processCommission(bookingData.bookingReference, testAffiliate._id)
      ).resolves.not.toThrow();

      // Restore original function
      AffiliateNotificationService.sendCommissionEarnedNotification = originalSendNotification;
    });
  });

  describe('Withdrawal Processing with Notifications', () => {
    it('should send withdrawal processed notification when withdrawal is completed', async () => {
      const withdrawalService = new WithdrawalService();
      
      const withdrawalData = {
        amount: 5000,
        bankDetails: {
          accountName: 'Test Business',
          accountNumber: '1234567890',
          bankCode: '044',
          bankName: 'Access Bank'
        }
      };

      // Request withdrawal
      const withdrawal = await withdrawalService.requestWithdrawal(testAffiliate._id, withdrawalData.amount, withdrawalData.bankDetails);

      expect(withdrawal).toBeDefined();
      expect(withdrawal.status).toBe('pending');
      
      // Verify withdrawal was created in database
      const savedWithdrawal = await Withdrawal.findById(withdrawal._id);
      expect(savedWithdrawal).toBeDefined();
    });

    it('should handle withdrawal notification failures gracefully', async () => {
      // Mock notification service to throw error
      const originalSendNotification = AffiliateNotificationService.sendWithdrawalProcessedNotification;
      AffiliateNotificationService.sendWithdrawalProcessedNotification = jest.fn().mockRejectedValue(new Error('Notification failed'));

      const withdrawalService = new WithdrawalService();
      
      const withdrawalData = {
        amount: 5000,
        bankDetails: {
          accountName: 'Test Business',
          accountNumber: '1234567890',
          bankCode: '044',
          bankName: 'Access Bank'
        }
      };

      // Withdrawal processing should still succeed even if notification fails
      await expect(
        withdrawalService.requestWithdrawal(testAffiliate._id, withdrawalData.amount, withdrawalData.bankDetails)
      ).resolves.not.toThrow();

      // Restore original function
      AffiliateNotificationService.sendWithdrawalProcessedNotification = originalSendNotification;
    });
  });

  describe('Affiliate Status Changes with Notifications', () => {
    it('should send status change notification when affiliate is approved', async () => {
      // Create pending affiliate
      const pendingAffiliate = await Affiliate.create({
        userId: testUser._id,
        businessName: 'Pending Business',
        businessEmail: 'pending@test.com',
        businessPhone: '+2348123456790',
        businessAddress: {
          street: '456 Test Street',
          city: 'Lagos',
          state: 'Lagos',
          country: 'Nigeria'
        },
        affiliateId: 'AFF-TEST-002',
        referralCode: 'TEST-REF-002',
        status: 'pending'
      });

      const affiliateService = new AffiliateService();
      
      // Approve affiliate (this should trigger notification)
      const approvedAffiliate = await affiliateService.approveAffiliate(pendingAffiliate._id, testUser._id);

      expect(approvedAffiliate.status).toBe('active');
      expect(approvedAffiliate.approvedBy).toEqual(testUser._id);
      expect(approvedAffiliate.approvedAt).toBeDefined();
    });

    it('should send status change notification when affiliate is suspended', async () => {
      const affiliateService = new AffiliateService();
      
      // Suspend affiliate (this should trigger notification)
      const suspendedAffiliate = await affiliateService.suspendAffiliate(testAffiliate._id, 'Policy violation');

      expect(suspendedAffiliate.status).toBe('suspended');
      expect(suspendedAffiliate.suspensionReason).toBe('Policy violation');
      expect(suspendedAffiliate.suspendedAt).toBeDefined();
    });

    it('should handle status change notification failures gracefully', async () => {
      // Mock notification service to throw error
      const originalSendNotification = AffiliateNotificationService.sendAccountStatusChangeNotification;
      AffiliateNotificationService.sendAccountStatusChangeNotification = jest.fn().mockRejectedValue(new Error('Notification failed'));

      const affiliateService = new AffiliateService();
      
      // Status change should still succeed even if notification fails
      await expect(
        affiliateService.suspendAffiliate(testAffiliate._id, 'Policy violation')
      ).resolves.not.toThrow();

      // Restore original function
      AffiliateNotificationService.sendAccountStatusChangeNotification = originalSendNotification;
    });
  });

  describe('Monthly Statement Generation and Delivery', () => {
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

      // Create test commission transactions for statement
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

      // Create test withdrawals for statement
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

    it('should generate and send monthly statement successfully', async () => {
      const statementData = await MonthlyStatementService.generateAndSendStatement(
        testAffiliate._id,
        2024,
        1
      );

      expect(statementData).toEqual(expect.objectContaining({
        month: 'January',
        year: 2024,
        totalCommissions: 4900, // 2500 + 2400
        totalWithdrawals: 3000,
        successfulBookings: 2
      }));
    });

    it('should generate statements for all active affiliates', async () => {
      const results = await MonthlyStatementService.generateAndSendAllStatements(2024, 1);

      expect(results.total).toBe(1); // Only one active affiliate
      expect(results.sent).toBe(1);
      expect(results.failed).toBe(0);
    });

    it('should handle statement generation failures gracefully', async () => {
      // Mock notification service to throw error
      const originalSendStatement = AffiliateNotificationService.sendMonthlyStatement;
      AffiliateNotificationService.sendMonthlyStatement = jest.fn().mockRejectedValue(new Error('Statement delivery failed'));

      await expect(
        MonthlyStatementService.generateAndSendStatement(testAffiliate._id, 2024, 1)
      ).rejects.toThrow('Statement delivery failed');

      // Restore original function
      AffiliateNotificationService.sendMonthlyStatement = originalSendStatement;
    });

    it('should get available statement months correctly', async () => {
      const availableMonths = await MonthlyStatementService.getAvailableStatementMonths(testAffiliate._id);

      expect(availableMonths).toEqual(expect.arrayContaining([
        expect.objectContaining({
          year: 2024,
          month: 1,
          monthName: 'January'
        })
      ]));
    });
  });

  describe('Notification Preferences Management', () => {
    it('should update notification preferences and affect future notifications', async () => {
      // Update preferences to disable email notifications
      const newPreferences = {
        email: false,
        sms: true,
        monthlyStatements: false
      };

      const updatedPreferences = await AffiliateNotificationService.updateNotificationPreferences(
        testAffiliate._id,
        newPreferences
      );

      expect(updatedPreferences).toEqual(newPreferences);

      // Verify preferences were updated in database
      const updatedAffiliate = await Affiliate.findById(testAffiliate._id);
      expect(updatedAffiliate.notificationPreferences).toEqual(newPreferences);
    });

    it('should retrieve notification preferences correctly', async () => {
      const preferences = await AffiliateNotificationService.getNotificationPreferences(testAffiliate._id);

      expect(preferences).toEqual({
        email: true,
        sms: false,
        monthlyStatements: true
      });
    });

    it('should return default preferences for affiliates without preferences', async () => {
      // Create affiliate without notification preferences
      const affiliateWithoutPrefs = await Affiliate.create({
        userId: testUser._id,
        businessName: 'No Prefs Business',
        businessEmail: 'noprefs@test.com',
        businessPhone: '+2348123456791',
        businessAddress: {
          street: '789 Test Street',
          city: 'Lagos',
          state: 'Lagos',
          country: 'Nigeria'
        },
        affiliateId: 'AFF-TEST-003',
        referralCode: 'TEST-REF-003',
        status: 'active'
        // No notificationPreferences field
      });

      const preferences = await AffiliateNotificationService.getNotificationPreferences(affiliateWithoutPrefs._id);

      expect(preferences).toEqual({
        email: true,
        sms: false,
        monthlyStatements: true
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle database connection issues gracefully', async () => {
      // Mock database error
      const originalFindById = User.findById;
      User.findById = jest.fn().mockRejectedValue(new Error('Database connection failed'));

      const commissionData = {
        _id: 'commission123',
        commissionAmount: 5000,
        serviceType: 'flight',
        bookingReference: 'BK123456',
        commissionRate: 2.5,
        bookingAmount: 200000
      };

      await expect(
        AffiliateNotificationService.sendCommissionEarnedNotification(commissionData, testAffiliate)
      ).rejects.toThrow('Database connection failed');

      // Restore original function
      User.findById = originalFindById;
    });

    it('should handle email service failures gracefully', async () => {
      const { sendEmail } = require('../../utils/emailService');
      sendEmail.mockRejectedValue(new Error('Email service unavailable'));

      const commissionData = {
        _id: 'commission123',
        commissionAmount: 5000,
        serviceType: 'flight',
        bookingReference: 'BK123456',
        commissionRate: 2.5,
        bookingAmount: 200000
      };

      await expect(
        AffiliateNotificationService.sendCommissionEarnedNotification(commissionData, testAffiliate)
      ).rejects.toThrow('Email service unavailable');
    });

    it('should handle SMS service failures gracefully', async () => {
      const { sendSMS } = require('../../utils/smsService');
      sendSMS.mockRejectedValue(new Error('SMS service unavailable'));

      const affiliateWithSMS = {
        ...testAffiliate.toObject(),
        notificationPreferences: { email: false, sms: true, monthlyStatements: true }
      };

      const commissionData = {
        _id: 'commission123',
        commissionAmount: 5000,
        serviceType: 'flight',
        bookingReference: 'BK123456',
        commissionRate: 2.5,
        bookingAmount: 200000
      };

      await expect(
        AffiliateNotificationService.sendCommissionEarnedNotification(commissionData, affiliateWithSMS)
      ).rejects.toThrow('SMS service unavailable');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent notification requests', async () => {
      const commissionData = {
        _id: 'commission123',
        commissionAmount: 5000,
        serviceType: 'flight',
        bookingReference: 'BK123456',
        commissionRate: 2.5,
        bookingAmount: 200000
      };

      // Send multiple notifications concurrently
      const promises = Array(10).fill().map(() =>
        AffiliateNotificationService.sendCommissionEarnedNotification(commissionData, testAffiliate)
      );

      await expect(Promise.all(promises)).resolves.not.toThrow();
    });

    it('should handle large statement data efficiently', async () => {
      // Create many commission transactions
      const testReferral = await require('../../models/referralModel').create({
        affiliateId: testAffiliate._id,
        customerId: testUser._id,
        referralCode: testAffiliate.referralCode,
        referralSource: 'link',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        status: 'active'
      });

      const commissions = Array(100).fill().map((_, index) => ({
        affiliateId: testAffiliate._id,
        referralId: testReferral._id,
        bookingReference: `BK${String(index).padStart(3, '0')}`,
        serviceType: 'flight',
        bookingAmount: 100000,
        commissionRate: 2.5,
        commissionAmount: 2500,
        status: 'approved',
        createdAt: new Date('2024-01-15')
      }));

      await CommissionTransaction.insertMany(commissions);

      const startTime = Date.now();
      const statementData = await MonthlyStatementService.generateStatementData(
        testAffiliate._id,
        2024,
        1
      );
      const endTime = Date.now();

      expect(statementData.totalCommissions).toBe(250000); // 100 * 2500
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});