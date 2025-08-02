// v1/test/models/commissionTransactionModel.test.js
const mongoose = require('mongoose');
const CommissionTransaction = require('../../models/commissionTransactionModel');
const Affiliate = require('../../models/affiliateModel');
const Referral = require('../../models/referralModel');
const User = require('../../models/userModel');

describe('CommissionTransaction Model', () => {
  let testUser;
  let testAffiliate;
  let testReferral;
  
  beforeAll(async () => {
    // Ensure test environment is set up
    process.env.NODE_ENV = 'test';
    process.env.JWT_ACCESS_SECRET = 'test_access_secret';
    process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';
    
    // Create test user and affiliate
    testUser = await User.create({
      firstName: 'Test',
      lastName: 'User',
      email: 'testuser@example.com',
      password: 'password123',
    });

    testAffiliate = await Affiliate.create({
      userId: testUser._id,
      businessName: 'Test Business',
      businessEmail: 'test@business.com',
      businessPhone: '+2348012345678',
      businessAddress: {
        street: '123 Street',
        city: 'Lagos',
        state: 'Lagos',
        country: 'Nigeria',
      },
    });

    testReferral = await Referral.create({
      affiliateId: testAffiliate._id,
      customerId: testUser._id,
      referralCode: testAffiliate.referralCode,
      ipAddress: '192.168.1.1',
      userAgent: 'Test User Agent',
    });
  });

  afterAll(async () => {
    // Clean up test data
    await User.deleteMany({});
    await Affiliate.deleteMany({});
    await Referral.deleteMany({});
    await CommissionTransaction.deleteMany({});
  });

  beforeEach(async () => {
    // Clean up commission transactions before each test
    await CommissionTransaction.deleteMany({});
  });

  describe('CommissionTransaction Creation', () => {
    it('should create a valid commission transaction', async () => {
      const transactionData = {
        affiliateId: testAffiliate._id,
        referralId: testReferral._id,
        bookingReference: 'BK-12345678',
        serviceType: 'flight',
        bookingAmount: 50000,
        commissionRate: 2.5,
        commissionAmount: 1250,
      };

      const transaction = new CommissionTransaction(transactionData);
      const savedTransaction = await transaction.save();

      expect(savedTransaction.affiliateId.toString()).toBe(testAffiliate._id.toString());
      expect(savedTransaction.referralId.toString()).toBe(testReferral._id.toString());
      expect(savedTransaction.bookingReference).toBe(transactionData.bookingReference);
      expect(savedTransaction.serviceType).toBe(transactionData.serviceType);
      expect(savedTransaction.bookingAmount).toBe(transactionData.bookingAmount);
      expect(savedTransaction.commissionRate).toBe(transactionData.commissionRate);
      expect(savedTransaction.commissionAmount).toBe(transactionData.commissionAmount);
      expect(savedTransaction.currency).toBe('NGN');
      expect(savedTransaction.status).toBe('pending');
    });

    it('should require all mandatory fields', async () => {
      const transaction = new CommissionTransaction({});

      await expect(transaction.save()).rejects.toThrow();
    });

    it('should validate service type enum', async () => {
      const transaction = new CommissionTransaction({
        affiliateId: testAffiliate._id,
        referralId: testReferral._id,
        bookingReference: 'BK-12345678',
        serviceType: 'invalid_service',
        bookingAmount: 50000,
        commissionRate: 2.5,
        commissionAmount: 1250,
      });

      await expect(transaction.save()).rejects.toThrow('Service type must be one of: flight, hotel, insurance, visa');
    });

    it('should validate currency enum', async () => {
      const transaction = new CommissionTransaction({
        affiliateId: testAffiliate._id,
        referralId: testReferral._id,
        bookingReference: 'BK-12345678',
        serviceType: 'flight',
        bookingAmount: 50000,
        commissionRate: 2.5,
        commissionAmount: 1250,
        currency: 'INVALID',
      });

      await expect(transaction.save()).rejects.toThrow('Currency must be one of: NGN, USD, EUR, GBP');
    });

    it('should validate status enum', async () => {
      const transaction = new CommissionTransaction({
        affiliateId: testAffiliate._id,
        referralId: testReferral._id,
        bookingReference: 'BK-12345678',
        serviceType: 'flight',
        bookingAmount: 50000,
        commissionRate: 2.5,
        commissionAmount: 1250,
        status: 'invalid_status',
      });

      await expect(transaction.save()).rejects.toThrow('Status must be one of: pending, approved, paid, disputed, cancelled');
    });

    it('should validate commission calculation', async () => {
      const transaction = new CommissionTransaction({
        affiliateId: testAffiliate._id,
        referralId: testReferral._id,
        bookingReference: 'BK-12345678',
        serviceType: 'flight',
        bookingAmount: 50000,
        commissionRate: 2.5,
        commissionAmount: 2000, // Incorrect: should be 1250
      });

      await expect(transaction.save()).rejects.toThrow('Commission amount does not match calculated value');
    });

    it('should validate negative amounts', async () => {
      const transaction = new CommissionTransaction({
        affiliateId: testAffiliate._id,
        referralId: testReferral._id,
        bookingReference: 'BK-12345678',
        serviceType: 'flight',
        bookingAmount: -50000,
        commissionRate: 2.5,
        commissionAmount: -1250,
      });

      await expect(transaction.save()).rejects.toThrow();
    });

    it('should validate commission rate range', async () => {
      const transaction = new CommissionTransaction({
        affiliateId: testAffiliate._id,
        referralId: testReferral._id,
        bookingReference: 'BK-12345678',
        serviceType: 'flight',
        bookingAmount: 50000,
        commissionRate: 150, // Invalid: > 100%
        commissionAmount: 75000,
      });

      await expect(transaction.save()).rejects.toThrow('Commission rate cannot exceed 100%');
    });

    it('should round amounts to 2 decimal places', async () => {
      const transaction = await CommissionTransaction.create({
        affiliateId: testAffiliate._id,
        referralId: testReferral._id,
        bookingReference: 'BK-12345678',
        serviceType: 'flight',
        bookingAmount: 50000.999,
        commissionRate: 2.5,
        commissionAmount: 1250.025,
      });

      expect(transaction.bookingAmount).toBe(50001.00);
      expect(transaction.commissionAmount).toBe(1250.03);
    });
  });

  describe('CommissionTransaction Methods', () => {
    let transaction;

    beforeEach(async () => {
      transaction = await CommissionTransaction.create({
        affiliateId: testAffiliate._id,
        referralId: testReferral._id,
        bookingReference: 'BK-12345678',
        serviceType: 'flight',
        bookingAmount: 50000,
        commissionRate: 2.5,
        commissionAmount: 1250,
      });
    });

    it('should approve commission', async () => {
      const adminId = new mongoose.Types.ObjectId();
      const notes = 'Approved after verification';

      await transaction.approve(adminId, notes);

      expect(transaction.status).toBe('approved');
      expect(transaction.approvedBy.toString()).toBe(adminId.toString());
      expect(transaction.approvedAt).toBeInstanceOf(Date);
      expect(transaction.notes).toBe(notes);
    });

    it('should mark as paid', async () => {
      const notes = 'Payment processed successfully';

      await transaction.markAsPaid(notes);

      expect(transaction.status).toBe('paid');
      expect(transaction.paidAt).toBeInstanceOf(Date);
      expect(transaction.processedAt).toBeInstanceOf(Date);
      expect(transaction.notes).toBe(notes);
    });

    it('should dispute commission', async () => {
      const reason = 'Booking was cancelled';
      const disputedBy = new mongoose.Types.ObjectId();

      await transaction.dispute(reason, disputedBy);

      expect(transaction.status).toBe('disputed');
      expect(transaction.disputeReason).toBe(reason);
      expect(transaction.disputedAt).toBeInstanceOf(Date);
      expect(transaction.disputedBy.toString()).toBe(disputedBy.toString());
    });

    it('should cancel commission', async () => {
      const reason = 'Fraudulent booking detected';
      const cancelledBy = new mongoose.Types.ObjectId();

      await transaction.cancel(reason, cancelledBy);

      expect(transaction.status).toBe('cancelled');
      expect(transaction.cancellationReason).toBe(reason);
      expect(transaction.cancelledAt).toBeInstanceOf(Date);
      expect(transaction.cancelledBy.toString()).toBe(cancelledBy.toString());
    });

    it('should calculate commission correctly', () => {
      const calculatedCommission = transaction.calculateCommission();
      const expectedCommission = (50000 * 2.5) / 100;

      expect(calculatedCommission).toBe(expectedCommission);
    });

    it('should get transaction summary', () => {
      const summary = transaction.getSummary();

      expect(summary).toHaveProperty('id');
      expect(summary).toHaveProperty('affiliateId');
      expect(summary).toHaveProperty('bookingReference', 'BK-12345678');
      expect(summary).toHaveProperty('serviceType', 'flight');
      expect(summary).toHaveProperty('bookingAmount', 50000);
      expect(summary).toHaveProperty('commissionRate', 2.5);
      expect(summary).toHaveProperty('commissionAmount', 1250);
      expect(summary).toHaveProperty('currency', 'NGN');
      expect(summary).toHaveProperty('status', 'pending');
      expect(summary).toHaveProperty('createdAt');
    });
  });

  describe('Static Methods', () => {
    beforeEach(async () => {
      // Create test transactions with different statuses and service types
      await CommissionTransaction.create([
        {
          affiliateId: testAffiliate._id,
          referralId: testReferral._id,
          bookingReference: 'BK-11111111',
          serviceType: 'flight',
          bookingAmount: 50000,
          commissionRate: 2.5,
          commissionAmount: 1250,
          status: 'pending',
        },
        {
          affiliateId: testAffiliate._id,
          referralId: testReferral._id,
          bookingReference: 'BK-22222222',
          serviceType: 'hotel',
          bookingAmount: 30000,
          commissionRate: 3.0,
          commissionAmount: 900,
          status: 'approved',
        },
        {
          affiliateId: testAffiliate._id,
          referralId: testReferral._id,
          bookingReference: 'BK-33333333',
          serviceType: 'insurance',
          bookingAmount: 10000,
          commissionRate: 5.0,
          commissionAmount: 500,
          status: 'paid',
        },
      ]);
    });

    it('should find transactions by affiliate', async () => {
      const transactions = await CommissionTransaction.findByAffiliate(testAffiliate._id);

      expect(transactions).toHaveLength(3);
      transactions.forEach(transaction => {
        expect(transaction.affiliateId.toString()).toBe(testAffiliate._id.toString());
      });
    });

    it('should find transactions by affiliate with status filter', async () => {
      const pendingTransactions = await CommissionTransaction.findByAffiliate(testAffiliate._id, {
        status: 'pending',
      });

      expect(pendingTransactions).toHaveLength(1);
      expect(pendingTransactions[0].status).toBe('pending');
    });

    it('should find transactions by affiliate with service type filter', async () => {
      const flightTransactions = await CommissionTransaction.findByAffiliate(testAffiliate._id, {
        serviceType: 'flight',
      });

      expect(flightTransactions).toHaveLength(1);
      expect(flightTransactions[0].serviceType).toBe('flight');
    });

    it('should find transactions by status', async () => {
      const approvedTransactions = await CommissionTransaction.findByStatus('approved');

      expect(approvedTransactions).toHaveLength(1);
      expect(approvedTransactions[0].status).toBe('approved');
    });

    it('should get commission statistics for affiliate', async () => {
      const stats = await CommissionTransaction.getCommissionStats(testAffiliate._id);

      expect(stats).toHaveLength(1);
      expect(stats[0].totalCommissions).toBe(2650); // 1250 + 900 + 500
      expect(stats[0].totalTransactions).toBe(3);
      expect(stats[0].pendingCommissions).toBe(1250);
      expect(stats[0].approvedCommissions).toBe(900);
      expect(stats[0].paidCommissions).toBe(500);
      expect(stats[0].averageCommission).toBeCloseTo(883.33, 2);
    });

    it('should get system-wide commission statistics', async () => {
      const stats = await CommissionTransaction.getSystemStats();

      expect(stats).toHaveLength(1);
      expect(stats[0].totalCommissions).toBe(2650);
      expect(stats[0].totalTransactions).toBe(3);
      expect(stats[0].totalBookingValue).toBe(90000); // 50000 + 30000 + 10000
      expect(stats[0].averageCommissionRate).toBeCloseTo(3.5, 2); // (2.5 + 3.0 + 5.0) / 3
    });

    it('should get commission statistics with date range', async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const stats = await CommissionTransaction.getCommissionStats(testAffiliate._id, {
        startDate: yesterday,
        endDate: tomorrow,
      });

      expect(stats).toHaveLength(1);
      expect(stats[0].totalTransactions).toBe(3);
    });

    it('should handle empty results for non-existent affiliate', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const stats = await CommissionTransaction.getCommissionStats(nonExistentId);

      expect(stats).toHaveLength(0);
    });
  });

  describe('Validation and Constraints', () => {
    it('should validate notes length', async () => {
      const longNotes = 'a'.repeat(501);
      const transaction = new CommissionTransaction({
        affiliateId: testAffiliate._id,
        referralId: testReferral._id,
        bookingReference: 'BK-12345678',
        serviceType: 'flight',
        bookingAmount: 50000,
        commissionRate: 2.5,
        commissionAmount: 1250,
        notes: longNotes,
      });

      await expect(transaction.save()).rejects.toThrow('Notes cannot exceed 500 characters');
    });

    it('should allow commission calculation with decimal precision', async () => {
      const transaction = await CommissionTransaction.create({
        affiliateId: testAffiliate._id,
        referralId: testReferral._id,
        bookingReference: 'BK-12345678',
        serviceType: 'flight',
        bookingAmount: 33333.33,
        commissionRate: 3.33,
        commissionAmount: 1110.00, // 33333.33 * 3.33 / 100 = 1110.0089 ≈ 1110.01
      });

      expect(transaction.commissionAmount).toBe(1110.00);
    });

    it('should handle edge case commission calculations', async () => {
      const transaction = await CommissionTransaction.create({
        affiliateId: testAffiliate._id,
        referralId: testReferral._id,
        bookingReference: 'BK-12345678',
        serviceType: 'flight',
        bookingAmount: 1,
        commissionRate: 0.01,
        commissionAmount: 0.00, // 1 * 0.01 / 100 = 0.0001 ≈ 0.00
      });

      expect(transaction.commissionAmount).toBe(0.00);
    });
  });

  describe('Indexes and Performance', () => {
    it('should have proper indexes defined', () => {
      const indexes = CommissionTransaction.schema.indexes();
      const indexFields = indexes.map(index => Object.keys(index[0]));
      
      expect(indexFields).toContainEqual(['affiliateId']);
      expect(indexFields).toContainEqual(['referralId']);
      expect(indexFields).toContainEqual(['bookingReference']);
      expect(indexFields).toContainEqual(['serviceType']);
      expect(indexFields).toContainEqual(['status']);
      expect(indexFields).toContainEqual(['createdAt']);
    });

    it('should have compound indexes for common queries', () => {
      const indexes = CommissionTransaction.schema.indexes();
      const compoundIndexes = indexes.filter(index => Object.keys(index[0]).length > 1);
      
      expect(compoundIndexes.length).toBeGreaterThan(0);
    });
  });
});