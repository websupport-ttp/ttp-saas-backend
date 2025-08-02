// v1/test/models/withdrawalModel.test.js
const mongoose = require('mongoose');
const Withdrawal = require('../../models/withdrawalModel');
const Wallet = require('../../models/walletModel');
const Affiliate = require('../../models/affiliateModel');
const User = require('../../models/userModel');

describe('Withdrawal Model', () => {
  let testUser;
  let testAffiliate;
  let testWallet;
  
  beforeAll(async () => {
    // Ensure test environment is set up
    process.env.NODE_ENV = 'test';
    process.env.JWT_ACCESS_SECRET = 'test_access_secret';
    process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';
    
    // Create test user, affiliate, and wallet
    testUser = await User.create({
      firstName: 'Test',
      lastName: 'Affiliate',
      email: 'testaffiliate@example.com',
      password: 'password123',
      role: 'Business',
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

    testWallet = await Wallet.create({
      affiliateId: testAffiliate._id,
      balance: 10000,
      bankDetails: {
        accountName: 'Test Business Account',
        accountNumber: '1234567890',
        bankCode: '058',
        bankName: 'Guaranty Trust Bank',
      },
    });
  });

  afterAll(async () => {
    // Clean up test data
    await User.deleteMany({});
    await Affiliate.deleteMany({});
    await Wallet.deleteMany({});
    await Withdrawal.deleteMany({});
  });

  beforeEach(async () => {
    // Clean up withdrawals before each test
    await Withdrawal.deleteMany({});
  });

  describe('Withdrawal Creation', () => {
    it('should create a valid withdrawal', async () => {
      const withdrawalData = {
        affiliateId: testAffiliate._id,
        walletId: testWallet._id,
        amount: 5000,
        bankDetails: {
          accountName: 'Test Business Account',
          accountNumber: '1234567890',
          bankCode: '058',
          bankName: 'Guaranty Trust Bank',
        },
      };

      const withdrawal = new Withdrawal(withdrawalData);
      const savedWithdrawal = await withdrawal.save();

      expect(savedWithdrawal.affiliateId.toString()).toBe(testAffiliate._id.toString());
      expect(savedWithdrawal.walletId.toString()).toBe(testWallet._id.toString());
      expect(savedWithdrawal.amount).toBe(5000);
      expect(savedWithdrawal.currency).toBe('NGN');
      expect(savedWithdrawal.status).toBe('pending');
      expect(savedWithdrawal.netAmount).toBe(5000); // No processing fee set
      expect(savedWithdrawal.processingFee).toBe(0);
      expect(savedWithdrawal.requestedAt).toBeInstanceOf(Date);
      expect(savedWithdrawal.retryCount).toBe(0);
    });

    it('should require all mandatory fields', async () => {
      const withdrawal = new Withdrawal({});

      await expect(withdrawal.save()).rejects.toThrow();
    });

    it('should validate minimum withdrawal amount', async () => {
      const withdrawal = new Withdrawal({
        affiliateId: testAffiliate._id,
        walletId: testWallet._id,
        amount: 0,
        bankDetails: {
          accountName: 'Test Account',
          accountNumber: '1234567890',
          bankCode: '058',
          bankName: 'Test Bank',
        },
      });

      await expect(withdrawal.save()).rejects.toThrow('Withdrawal amount must be at least 1');
    });

    it('should validate currency enum', async () => {
      const withdrawal = new Withdrawal({
        affiliateId: testAffiliate._id,
        walletId: testWallet._id,
        amount: 5000,
        currency: 'INVALID',
        bankDetails: {
          accountName: 'Test Account',
          accountNumber: '1234567890',
          bankCode: '058',
          bankName: 'Test Bank',
        },
      });

      await expect(withdrawal.save()).rejects.toThrow('Currency must be one of: NGN, USD, EUR, GBP');
    });

    it('should validate status enum', async () => {
      const withdrawal = new Withdrawal({
        affiliateId: testAffiliate._id,
        walletId: testWallet._id,
        amount: 5000,
        status: 'invalid_status',
        bankDetails: {
          accountName: 'Test Account',
          accountNumber: '1234567890',
          bankCode: '058',
          bankName: 'Test Bank',
        },
      });

      await expect(withdrawal.save()).rejects.toThrow('Status must be one of: pending, processing, completed, failed, cancelled, reversed');
    });

    it('should validate bank details format', async () => {
      const withdrawal = new Withdrawal({
        affiliateId: testAffiliate._id,
        walletId: testWallet._id,
        amount: 5000,
        bankDetails: {
          accountName: 'Test Account',
          accountNumber: '123', // Invalid: not 10 digits
          bankCode: '058',
          bankName: 'Test Bank',
        },
      });

      await expect(withdrawal.save()).rejects.toThrow('Account number must be exactly 10 digits');
    });

    it('should validate bank code format', async () => {
      const withdrawal = new Withdrawal({
        affiliateId: testAffiliate._id,
        walletId: testWallet._id,
        amount: 5000,
        bankDetails: {
          accountName: 'Test Account',
          accountNumber: '1234567890',
          bankCode: '12', // Invalid: not 3 digits
          bankName: 'Test Bank',
        },
      });

      await expect(withdrawal.save()).rejects.toThrow('Bank code must be exactly 3 digits');
    });

    it('should calculate net amount automatically', async () => {
      const withdrawal = await Withdrawal.create({
        affiliateId: testAffiliate._id,
        walletId: testWallet._id,
        amount: 5000,
        processingFee: 100,
        bankDetails: {
          accountName: 'Test Account',
          accountNumber: '1234567890',
          bankCode: '058',
          bankName: 'Test Bank',
        },
      });

      expect(withdrawal.netAmount).toBe(4900);
    });

    it('should validate negative net amount', async () => {
      const withdrawal = new Withdrawal({
        affiliateId: testAffiliate._id,
        walletId: testWallet._id,
        amount: 100,
        processingFee: 200, // Higher than amount
        bankDetails: {
          accountName: 'Test Account',
          accountNumber: '1234567890',
          bankCode: '058',
          bankName: 'Test Bank',
        },
      });

      await expect(withdrawal.save()).rejects.toThrow('Net amount cannot be negative after processing fees');
    });

    it('should round amounts to 2 decimal places', async () => {
      const withdrawal = await Withdrawal.create({
        affiliateId: testAffiliate._id,
        walletId: testWallet._id,
        amount: 5000.999,
        processingFee: 100.555,
        bankDetails: {
          accountName: 'Test Account',
          accountNumber: '1234567890',
          bankCode: '058',
          bankName: 'Test Bank',
        },
      });

      expect(withdrawal.amount).toBe(5001.00);
      expect(withdrawal.processingFee).toBe(100.56);
      expect(withdrawal.netAmount).toBe(4900.44);
    });
  });

  describe('Withdrawal Methods', () => {
    let withdrawal;

    beforeEach(async () => {
      withdrawal = await Withdrawal.create({
        affiliateId: testAffiliate._id,
        walletId: testWallet._id,
        amount: 5000,
        bankDetails: {
          accountName: 'Test Business Account',
          accountNumber: '1234567890',
          bankCode: '058',
          bankName: 'Guaranty Trust Bank',
        },
      });
    });

    describe('Status Management', () => {
      it('should mark as processing', async () => {
        const paystackRef = 'TRF_123456789';
        const transferCode = 'TRF-CODE-123';
        const processedBy = new mongoose.Types.ObjectId();

        await withdrawal.markAsProcessing(paystackRef, transferCode, processedBy);

        expect(withdrawal.status).toBe('processing');
        expect(withdrawal.paystackReference).toBe(paystackRef);
        expect(withdrawal.transferCode).toBe(transferCode);
        expect(withdrawal.processedAt).toBeInstanceOf(Date);
        expect(withdrawal.processedBy.toString()).toBe(processedBy.toString());
      });

      it('should mark as completed', async () => {
        const webhookData = { event: 'transfer.success', data: { reference: 'TRF_123456789' } };

        await withdrawal.markAsCompleted(webhookData);

        expect(withdrawal.status).toBe('completed');
        expect(withdrawal.completedAt).toBeInstanceOf(Date);
        expect(withdrawal.webhookData).toEqual(webhookData);
      });

      it('should mark as failed', async () => {
        const reason = 'Insufficient funds in source account';
        const webhookData = { event: 'transfer.failed', data: { reference: 'TRF_123456789' } };

        await withdrawal.markAsFailed(reason, webhookData);

        expect(withdrawal.status).toBe('failed');
        expect(withdrawal.failureReason).toBe(reason);
        expect(withdrawal.failedAt).toBeInstanceOf(Date);
        expect(withdrawal.webhookData).toEqual(webhookData);
      });

      it('should cancel withdrawal', async () => {
        const reason = 'Requested by affiliate';
        const cancelledBy = new mongoose.Types.ObjectId();

        await withdrawal.cancel(reason, cancelledBy);

        expect(withdrawal.status).toBe('cancelled');
        expect(withdrawal.cancellationReason).toBe(reason);
        expect(withdrawal.cancelledAt).toBeInstanceOf(Date);
        expect(withdrawal.cancelledBy.toString()).toBe(cancelledBy.toString());
      });

      it('should reverse withdrawal', async () => {
        const reason = 'Fraudulent transaction detected';
        const reversedBy = new mongoose.Types.ObjectId();

        await withdrawal.reverse(reason, reversedBy);

        expect(withdrawal.status).toBe('reversed');
        expect(withdrawal.reversalReason).toBe(reason);
        expect(withdrawal.reversedAt).toBeInstanceOf(Date);
        expect(withdrawal.reversedBy.toString()).toBe(reversedBy.toString());
      });
    });

    describe('Retry Logic', () => {
      it('should retry failed withdrawal', async () => {
        await withdrawal.markAsFailed('Network error');
        await withdrawal.retry();

        expect(withdrawal.status).toBe('pending');
        expect(withdrawal.retryCount).toBe(1);
        expect(withdrawal.lastRetryAt).toBeInstanceOf(Date);
        expect(withdrawal.failureReason).toBeNull();
        expect(withdrawal.failedAt).toBeNull();
      });

      it('should reject retry when max retries exceeded', async () => {
        withdrawal.retryCount = 5;
        await withdrawal.save();

        await expect(withdrawal.retry()).rejects.toThrow('Maximum retry count exceeded');
      });

      it('should increment retry count on multiple retries', async () => {
        await withdrawal.markAsFailed('Error 1');
        await withdrawal.retry();
        
        await withdrawal.markAsFailed('Error 2');
        await withdrawal.retry();

        expect(withdrawal.retryCount).toBe(2);
      });
    });

    describe('Processing Fee Calculation', () => {
      it('should calculate processing fee with default parameters', () => {
        const fee = withdrawal.calculateProcessingFee();

        expect(fee).toBe(75); // 5000 * 0.015 = 75
        expect(withdrawal.processingFee).toBe(75);
        expect(withdrawal.netAmount).toBe(4925);
      });

      it('should apply minimum fee', () => {
        withdrawal.amount = 1000; // Low amount
        const fee = withdrawal.calculateProcessingFee(0.015, 100, 2000);

        expect(fee).toBe(100); // Minimum fee applied
        expect(withdrawal.processingFee).toBe(100);
        expect(withdrawal.netAmount).toBe(900);
      });

      it('should apply maximum fee', () => {
        withdrawal.amount = 200000; // High amount
        const fee = withdrawal.calculateProcessingFee(0.015, 50, 1000);

        expect(fee).toBe(1000); // Maximum fee applied
        expect(withdrawal.processingFee).toBe(1000);
        expect(withdrawal.netAmount).toBe(199000);
      });

      it('should calculate fee with custom parameters', () => {
        const fee = withdrawal.calculateProcessingFee(0.02, 25, 5000);

        expect(fee).toBe(100); // 5000 * 0.02 = 100
        expect(withdrawal.processingFee).toBe(100);
        expect(withdrawal.netAmount).toBe(4900);
      });
    });

    describe('Validation Methods', () => {
      it('should check if withdrawal can be cancelled', () => {
        expect(withdrawal.canBeCancelled()).toBe(true);

        withdrawal.status = 'processing';
        expect(withdrawal.canBeCancelled()).toBe(false);

        withdrawal.status = 'failed';
        expect(withdrawal.canBeCancelled()).toBe(true);
      });

      it('should check if withdrawal can be retried', () => {
        expect(withdrawal.canBeRetried()).toBe(false);

        withdrawal.status = 'failed';
        expect(withdrawal.canBeRetried()).toBe(true);

        withdrawal.retryCount = 5;
        expect(withdrawal.canBeRetried()).toBe(false);
      });
    });

    describe('Summary Generation', () => {
      it('should get withdrawal summary', async () => {
        withdrawal.processingFee = 75;
        withdrawal.netAmount = 4925;
        withdrawal.paystackReference = 'TRF_123456789';
        await withdrawal.save();

        const summary = withdrawal.getSummary();

        expect(summary).toHaveProperty('id');
        expect(summary).toHaveProperty('affiliateId');
        expect(summary).toHaveProperty('amount', 5000);
        expect(summary).toHaveProperty('processingFee', 75);
        expect(summary).toHaveProperty('netAmount', 4925);
        expect(summary).toHaveProperty('currency', 'NGN');
        expect(summary).toHaveProperty('status', 'pending');
        expect(summary).toHaveProperty('bankDetails');
        expect(summary).toHaveProperty('requestedAt');
        expect(summary).toHaveProperty('paystackReference', 'TRF_123456789');
      });
    });
  });

  describe('Static Methods', () => {
    let affiliate2;
    let wallet2;

    beforeEach(async () => {
      // Create additional test data
      affiliate2 = await Affiliate.create({
        userId: testUser._id,
        businessName: 'Business Two',
        businessEmail: 'business2@example.com',
        businessPhone: '+2348012345679',
        businessAddress: {
          street: '456 Street',
          city: 'Abuja',
          state: 'FCT',
          country: 'Nigeria',
        },
      });

      wallet2 = await Wallet.create({
        affiliateId: affiliate2._id,
        balance: 5000,
      });

      // Create test withdrawals with different statuses
      await Withdrawal.create([
        {
          affiliateId: testAffiliate._id,
          walletId: testWallet._id,
          amount: 3000,
          status: 'pending',
          bankDetails: {
            accountName: 'Test Account 1',
            accountNumber: '1111111111',
            bankCode: '058',
            bankName: 'GTB',
          },
        },
        {
          affiliateId: testAffiliate._id,
          walletId: testWallet._id,
          amount: 2000,
          status: 'completed',
          bankDetails: {
            accountName: 'Test Account 2',
            accountNumber: '2222222222',
            bankCode: '044',
            bankName: 'Access Bank',
          },
        },
        {
          affiliateId: affiliate2._id,
          walletId: wallet2._id,
          amount: 1500,
          status: 'failed',
          retryCount: 2,
          bankDetails: {
            accountName: 'Test Account 3',
            accountNumber: '3333333333',
            bankCode: '011',
            bankName: 'First Bank',
          },
        },
      ]);
    });

    afterEach(async () => {
      await Affiliate.deleteOne({ _id: affiliate2._id });
      await Wallet.deleteOne({ _id: wallet2._id });
    });

    it('should find withdrawals by affiliate', async () => {
      const withdrawals = await Withdrawal.findByAffiliate(testAffiliate._id);

      expect(withdrawals).toHaveLength(2);
      withdrawals.forEach(withdrawal => {
        expect(withdrawal.affiliateId.toString()).toBe(testAffiliate._id.toString());
      });
    });

    it('should find withdrawals by affiliate with status filter', async () => {
      const pendingWithdrawals = await Withdrawal.findByAffiliate(testAffiliate._id, {
        status: 'pending',
      });

      expect(pendingWithdrawals).toHaveLength(1);
      expect(pendingWithdrawals[0].status).toBe('pending');
    });

    it('should find withdrawals by status', async () => {
      const failedWithdrawals = await Withdrawal.findByStatus('failed');

      expect(failedWithdrawals).toHaveLength(1);
      expect(failedWithdrawals[0].status).toBe('failed');
    });

    it('should find pending withdrawals for processing', async () => {
      const pendingForProcessing = await Withdrawal.findPendingForProcessing(5);

      expect(pendingForProcessing).toHaveLength(1);
      expect(pendingForProcessing[0].status).toBe('pending');
      expect(pendingForProcessing[0].retryCount).toBeLessThan(5);
    });

    it('should find failed withdrawals for retry', async () => {
      const failedForRetry = await Withdrawal.findFailedForRetry(0); // 0 hours = immediate retry

      expect(failedForRetry).toHaveLength(1);
      expect(failedForRetry[0].status).toBe('failed');
      expect(failedForRetry[0].retryCount).toBeLessThan(5);
    });

    it('should get withdrawal statistics for affiliate', async () => {
      const stats = await Withdrawal.getWithdrawalStats(testAffiliate._id);

      expect(stats).toHaveLength(1);
      expect(stats[0].totalWithdrawals).toBe(5000); // 3000 + 2000
      expect(stats[0].totalRequests).toBe(2);
      expect(stats[0].completedWithdrawals).toBe(2000);
      expect(stats[0].pendingWithdrawals).toBe(3000);
      expect(stats[0].failedWithdrawals).toBe(0);
      expect(stats[0].averageWithdrawalAmount).toBe(2500);
    });

    it('should get system-wide withdrawal statistics', async () => {
      const stats = await Withdrawal.getSystemStats();

      expect(stats).toHaveLength(1);
      expect(stats[0].totalWithdrawals).toBe(6500); // 3000 + 2000 + 1500
      expect(stats[0].totalRequests).toBe(3);
    });

    it('should handle empty results for non-existent affiliate', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const withdrawals = await Withdrawal.findByAffiliate(nonExistentId);

      expect(withdrawals).toHaveLength(0);
    });
  });

  describe('Validation and Constraints', () => {
    it('should validate retry count maximum', async () => {
      const withdrawal = new Withdrawal({
        affiliateId: testAffiliate._id,
        walletId: testWallet._id,
        amount: 5000,
        retryCount: 6, // Exceeds maximum
        bankDetails: {
          accountName: 'Test Account',
          accountNumber: '1234567890',
          bankCode: '058',
          bankName: 'Test Bank',
        },
      });

      await expect(withdrawal.save()).rejects.toThrow('Maximum retry count is 5');
    });

    it('should validate negative retry count', async () => {
      const withdrawal = new Withdrawal({
        affiliateId: testAffiliate._id,
        walletId: testWallet._id,
        amount: 5000,
        retryCount: -1,
        bankDetails: {
          accountName: 'Test Account',
          accountNumber: '1234567890',
          bankCode: '058',
          bankName: 'Test Bank',
        },
      });

      await expect(withdrawal.save()).rejects.toThrow('Retry count cannot be negative');
    });

    it('should validate notes length', async () => {
      const longNotes = 'a'.repeat(1001);
      const withdrawal = new Withdrawal({
        affiliateId: testAffiliate._id,
        walletId: testWallet._id,
        amount: 5000,
        notes: longNotes,
        bankDetails: {
          accountName: 'Test Account',
          accountNumber: '1234567890',
          bankCode: '058',
          bankName: 'Test Bank',
        },
      });

      await expect(withdrawal.save()).rejects.toThrow('Notes cannot exceed 1000 characters');
    });

    it('should validate failure reason length', async () => {
      const longReason = 'a'.repeat(501);
      const withdrawal = new Withdrawal({
        affiliateId: testAffiliate._id,
        walletId: testWallet._id,
        amount: 5000,
        failureReason: longReason,
        bankDetails: {
          accountName: 'Test Account',
          accountNumber: '1234567890',
          bankCode: '058',
          bankName: 'Test Bank',
        },
      });

      await expect(withdrawal.save()).rejects.toThrow('Failure reason cannot exceed 500 characters');
    });
  });

  describe('Indexes and Performance', () => {
    it('should have proper indexes defined', () => {
      const indexes = Withdrawal.schema.indexes();
      const indexFields = indexes.map(index => Object.keys(index[0]));
      
      expect(indexFields).toContainEqual(['affiliateId']);
      expect(indexFields).toContainEqual(['walletId']);
      expect(indexFields).toContainEqual(['status']);
      expect(indexFields).toContainEqual(['paystackReference']);
      expect(indexFields).toContainEqual(['requestedAt']);
      expect(indexFields).toContainEqual(['retryCount']);
    });

    it('should have compound indexes for common queries', () => {
      const indexes = Withdrawal.schema.indexes();
      const compoundIndexes = indexes.filter(index => Object.keys(index[0]).length > 1);
      
      expect(compoundIndexes.length).toBeGreaterThan(0);
    });
  });
});