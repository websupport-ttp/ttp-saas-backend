// v1/test/models/walletTransactionModel.test.js
const mongoose = require('mongoose');
const WalletTransaction = require('../../models/walletTransactionModel');
const Wallet = require('../../models/walletModel');
const Affiliate = require('../../models/affiliateModel');
const User = require('../../models/userModel');

describe('WalletTransaction Model', () => {
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
      balance: 1000,
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
    await WalletTransaction.deleteMany({});
  });

  beforeEach(async () => {
    // Clean up transactions before each test
    await WalletTransaction.deleteMany({});
  });

  describe('Transaction Creation', () => {
    it('should create a valid wallet transaction', async () => {
      const transactionData = {
        walletId: testWallet._id,
        affiliateId: testAffiliate._id,
        type: 'commission_credit',
        amount: 100.50,
        balanceBefore: 900,
        balanceAfter: 1000.50,
        currency: 'NGN',
        description: 'Commission earned from booking',
        reference: 'TXN_123456',
      };

      const transaction = new WalletTransaction(transactionData);
      const savedTransaction = await transaction.save();

      expect(savedTransaction.walletId.toString()).toBe(testWallet._id.toString());
      expect(savedTransaction.affiliateId.toString()).toBe(testAffiliate._id.toString());
      expect(savedTransaction.type).toBe('commission_credit');
      expect(savedTransaction.amount).toBe(100.50);
      expect(savedTransaction.balanceBefore).toBe(900);
      expect(savedTransaction.balanceAfter).toBe(1000.50);
      expect(savedTransaction.currency).toBe('NGN');
      expect(savedTransaction.description).toBe('Commission earned from booking');
      expect(savedTransaction.reference).toBe('TXN_123456');
      expect(savedTransaction.status).toBe('completed');
    });

    it('should require wallet ID', async () => {
      const transaction = new WalletTransaction({
        affiliateId: testAffiliate._id,
        type: 'commission_credit',
        amount: 100,
        balanceBefore: 900,
        balanceAfter: 1000,
        description: 'Test transaction',
      });

      await expect(transaction.save()).rejects.toThrow('Wallet ID is required');
    });

    it('should require affiliate ID', async () => {
      const transaction = new WalletTransaction({
        walletId: testWallet._id,
        type: 'commission_credit',
        amount: 100,
        balanceBefore: 900,
        balanceAfter: 1000,
        description: 'Test transaction',
      });

      await expect(transaction.save()).rejects.toThrow('Affiliate ID is required');
    });

    it('should require transaction type', async () => {
      const transaction = new WalletTransaction({
        walletId: testWallet._id,
        affiliateId: testAffiliate._id,
        amount: 100,
        balanceBefore: 900,
        balanceAfter: 1000,
        description: 'Test transaction',
      });

      await expect(transaction.save()).rejects.toThrow('Transaction type is required');
    });

    it('should require amount', async () => {
      const transaction = new WalletTransaction({
        walletId: testWallet._id,
        affiliateId: testAffiliate._id,
        type: 'commission_credit',
        balanceBefore: 900,
        balanceAfter: 1000,
        description: 'Test transaction',
      });

      await expect(transaction.save()).rejects.toThrow('Amount is required');
    });

    it('should require description', async () => {
      const transaction = new WalletTransaction({
        walletId: testWallet._id,
        affiliateId: testAffiliate._id,
        type: 'commission_credit',
        amount: 100,
        balanceBefore: 900,
        balanceAfter: 1000,
      });

      await expect(transaction.save()).rejects.toThrow('Description is required');
    });

    it('should validate transaction type enum', async () => {
      const transaction = new WalletTransaction({
        walletId: testWallet._id,
        affiliateId: testAffiliate._id,
        type: 'invalid_type',
        amount: 100,
        balanceBefore: 900,
        balanceAfter: 1000,
        description: 'Test transaction',
      });

      await expect(transaction.save()).rejects.toThrow('Transaction type must be one of the allowed values');
    });

    it('should validate currency enum', async () => {
      const transaction = new WalletTransaction({
        walletId: testWallet._id,
        affiliateId: testAffiliate._id,
        type: 'commission_credit',
        amount: 100,
        balanceBefore: 900,
        balanceAfter: 1000,
        currency: 'INVALID',
        description: 'Test transaction',
      });

      await expect(transaction.save()).rejects.toThrow('Currency must be one of: NGN, USD, EUR, GBP');
    });

    it('should validate status enum', async () => {
      const transaction = new WalletTransaction({
        walletId: testWallet._id,
        affiliateId: testAffiliate._id,
        type: 'commission_credit',
        amount: 100,
        balanceBefore: 900,
        balanceAfter: 1000,
        description: 'Test transaction',
        status: 'invalid_status',
      });

      await expect(transaction.save()).rejects.toThrow('Status must be one of: pending, completed, failed, reversed');
    });

    it('should validate minimum amount', async () => {
      const transaction = new WalletTransaction({
        walletId: testWallet._id,
        affiliateId: testAffiliate._id,
        type: 'commission_credit',
        amount: 0,
        balanceBefore: 900,
        balanceAfter: 1000,
        description: 'Test transaction',
      });

      await expect(transaction.save()).rejects.toThrow('Amount must be greater than 0');
    });

    it('should validate negative balance before', async () => {
      const transaction = new WalletTransaction({
        walletId: testWallet._id,
        affiliateId: testAffiliate._id,
        type: 'commission_credit',
        amount: 100,
        balanceBefore: -100,
        balanceAfter: 0,
        description: 'Test transaction',
      });

      await expect(transaction.save()).rejects.toThrow('Balance before cannot be negative');
    });

    it('should validate negative balance after', async () => {
      const transaction = new WalletTransaction({
        walletId: testWallet._id,
        affiliateId: testAffiliate._id,
        type: 'commission_credit',
        amount: 100,
        balanceBefore: 0,
        balanceAfter: -100,
        description: 'Test transaction',
      });

      await expect(transaction.save()).rejects.toThrow('Balance after cannot be negative');
    });

    it('should set default values correctly', async () => {
      const transaction = await WalletTransaction.create({
        walletId: testWallet._id,
        affiliateId: testAffiliate._id,
        type: 'commission_credit',
        amount: 100,
        balanceBefore: 900,
        balanceAfter: 1000,
        description: 'Test transaction',
      });

      expect(transaction.currency).toBe('NGN');
      expect(transaction.status).toBe('completed');
      expect(transaction.metadata).toEqual({});
      expect(transaction.processedAt).toBeInstanceOf(Date);
    });

    it('should generate reference automatically if not provided', async () => {
      const transaction = await WalletTransaction.create({
        walletId: testWallet._id,
        affiliateId: testAffiliate._id,
        type: 'commission_credit',
        amount: 100,
        balanceBefore: 900,
        balanceAfter: 1000,
        description: 'Test transaction',
      });

      expect(transaction.reference).toBeDefined();
      expect(transaction.reference).toMatch(/^COMMISSIONCREDIT_\d+_/);
    });

    it('should round amounts to 2 decimal places', async () => {
      const transaction = await WalletTransaction.create({
        walletId: testWallet._id,
        affiliateId: testAffiliate._id,
        type: 'commission_credit',
        amount: 100.999,
        balanceBefore: 900.555,
        balanceAfter: 1001.554,
        description: 'Test transaction',
      });

      expect(transaction.amount).toBe(101.00);
      expect(transaction.balanceBefore).toBe(900.56);
      expect(transaction.balanceAfter).toBe(1001.55);
    });
  });

  describe('Transaction Methods', () => {
    let transaction;

    beforeEach(async () => {
      transaction = await WalletTransaction.create({
        walletId: testWallet._id,
        affiliateId: testAffiliate._id,
        type: 'commission_credit',
        amount: 100,
        balanceBefore: 900,
        balanceAfter: 1000,
        description: 'Test transaction',
        reference: 'TXN_TEST_123',
      });
    });

    describe('reverse', () => {
      it('should reverse a completed transaction', async () => {
        const reason = 'Error in calculation';
        const processedBy = testUser._id;

        await transaction.reverse(reason, processedBy);

        expect(transaction.status).toBe('reversed');
        expect(transaction.reversedAt).toBeInstanceOf(Date);
        expect(transaction.reversalReason).toBe(reason);
        expect(transaction.processedBy.toString()).toBe(processedBy.toString());
      });

      it('should throw error if transaction is already reversed', async () => {
        await transaction.reverse('First reversal', testUser._id);

        await expect(transaction.reverse('Second reversal', testUser._id))
          .rejects.toThrow('Transaction is already reversed');
      });

      it('should throw error if transaction is not completed', async () => {
        transaction.status = 'pending';
        await transaction.save();

        await expect(transaction.reverse('Test reason', testUser._id))
          .rejects.toThrow('Only completed transactions can be reversed');
      });
    });

    describe('getSummary', () => {
      it('should return transaction summary', () => {
        const summary = transaction.getSummary();

        expect(summary).toHaveProperty('id', transaction._id);
        expect(summary).toHaveProperty('type', 'commission_credit');
        expect(summary).toHaveProperty('amount', 100);
        expect(summary).toHaveProperty('currency', 'NGN');
        expect(summary).toHaveProperty('description', 'Test transaction');
        expect(summary).toHaveProperty('reference', 'TXN_TEST_123');
        expect(summary).toHaveProperty('status', 'completed');
        expect(summary).toHaveProperty('balanceBefore', 900);
        expect(summary).toHaveProperty('balanceAfter', 1000);
        expect(summary).toHaveProperty('processedAt');
        expect(summary).toHaveProperty('createdAt');
      });
    });
  });

  describe('Static Methods', () => {
    beforeEach(async () => {
      // Create test transactions
      const transactions = [
        {
          walletId: testWallet._id,
          affiliateId: testAffiliate._id,
          type: 'commission_credit',
          amount: 100,
          balanceBefore: 0,
          balanceAfter: 100,
          description: 'Commission 1',
          reference: 'TXN_001',
          status: 'completed',
        },
        {
          walletId: testWallet._id,
          affiliateId: testAffiliate._id,
          type: 'withdrawal_debit',
          amount: 50,
          balanceBefore: 100,
          balanceAfter: 50,
          description: 'Withdrawal 1',
          reference: 'TXN_002',
          status: 'completed',
        },
        {
          walletId: testWallet._id,
          affiliateId: testAffiliate._id,
          type: 'commission_credit',
          amount: 200,
          balanceBefore: 50,
          balanceAfter: 250,
          description: 'Commission 2',
          reference: 'TXN_003',
          status: 'pending',
        },
      ];

      await WalletTransaction.create(transactions);
    });

    describe('findByWallet', () => {
      it('should find transactions by wallet ID', async () => {
        const transactions = await WalletTransaction.findByWallet(testWallet._id);

        expect(transactions).toHaveLength(3);
        expect(transactions[0].createdAt.getTime()).toBeGreaterThanOrEqual(transactions[1].createdAt.getTime());
      });

      it('should filter by transaction type', async () => {
        const transactions = await WalletTransaction.findByWallet(testWallet._id, {
          type: 'commission_credit',
        });

        expect(transactions).toHaveLength(2);
        transactions.forEach(tx => {
          expect(tx.type).toBe('commission_credit');
        });
      });

      it('should filter by status', async () => {
        const transactions = await WalletTransaction.findByWallet(testWallet._id, {
          status: 'completed',
        });

        expect(transactions).toHaveLength(2);
        transactions.forEach(tx => {
          expect(tx.status).toBe('completed');
        });
      });

      it('should filter by date range', async () => {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

        const transactions = await WalletTransaction.findByWallet(testWallet._id, {
          dateFrom: oneHourAgo,
          dateTo: now,
        });

        expect(transactions).toHaveLength(3);
      });

      it('should apply pagination', async () => {
        const transactions = await WalletTransaction.findByWallet(testWallet._id, {
          limit: 2,
          skip: 1,
        });

        expect(transactions).toHaveLength(2);
      });
    });

    describe('findByAffiliate', () => {
      it('should find transactions by affiliate ID', async () => {
        const transactions = await WalletTransaction.findByAffiliate(testAffiliate._id);

        expect(transactions).toHaveLength(3);
        transactions.forEach(tx => {
          expect(tx.affiliateId.toString()).toBe(testAffiliate._id.toString());
        });
      });

      it('should apply filters and pagination', async () => {
        const transactions = await WalletTransaction.findByAffiliate(testAffiliate._id, {
          type: 'commission_credit',
          limit: 1,
        });

        expect(transactions).toHaveLength(1);
        expect(transactions[0].type).toBe('commission_credit');
      });
    });

    describe('getStatistics', () => {
      it('should get transaction statistics for affiliate', async () => {
        const stats = await WalletTransaction.getStatistics(testAffiliate._id);

        expect(stats).toHaveLength(1);
        expect(stats[0].totalTransactions).toBe(3);
        expect(stats[0].totalAmount).toBe(350); // 100 + 50 + 200
        expect(stats[0].byType).toHaveLength(2);

        const commissionStats = stats[0].byType.find(t => t.type === 'commission_credit');
        const withdrawalStats = stats[0].byType.find(t => t.type === 'withdrawal_debit');

        expect(commissionStats.count).toBe(2);
        expect(commissionStats.totalAmount).toBe(300);
        expect(withdrawalStats.count).toBe(1);
        expect(withdrawalStats.totalAmount).toBe(50);
      });

      it('should filter statistics by date range', async () => {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

        const stats = await WalletTransaction.getStatistics(
          testAffiliate._id,
          oneHourAgo,
          now
        );

        expect(stats).toHaveLength(1);
        expect(stats[0].totalTransactions).toBe(3);
      });

      it('should return empty statistics for non-existent affiliate', async () => {
        const nonExistentId = new mongoose.Types.ObjectId();
        const stats = await WalletTransaction.getStatistics(nonExistentId);

        expect(stats).toHaveLength(0);
      });
    });
  });

  describe('Validation and Constraints', () => {
    it('should validate description length', async () => {
      const longDescription = 'a'.repeat(501);
      const transaction = new WalletTransaction({
        walletId: testWallet._id,
        affiliateId: testAffiliate._id,
        type: 'commission_credit',
        amount: 100,
        balanceBefore: 900,
        balanceAfter: 1000,
        description: longDescription,
      });

      await expect(transaction.save()).rejects.toThrow('Description cannot exceed 500 characters');
    });

    it('should validate reference length', async () => {
      const longReference = 'a'.repeat(101);
      const transaction = new WalletTransaction({
        walletId: testWallet._id,
        affiliateId: testAffiliate._id,
        type: 'commission_credit',
        amount: 100,
        balanceBefore: 900,
        balanceAfter: 1000,
        description: 'Test transaction',
        reference: longReference,
      });

      await expect(transaction.save()).rejects.toThrow('Reference cannot exceed 100 characters');
    });

    it('should validate reversal reason length', async () => {
      const transaction = await WalletTransaction.create({
        walletId: testWallet._id,
        affiliateId: testAffiliate._id,
        type: 'commission_credit',
        amount: 100,
        balanceBefore: 900,
        balanceAfter: 1000,
        description: 'Test transaction',
      });

      const longReason = 'a'.repeat(501);
      transaction.reversalReason = longReason;

      await expect(transaction.save()).rejects.toThrow('Reversal reason cannot exceed 500 characters');
    });
  });

  describe('Indexes and Performance', () => {
    it('should have proper indexes defined', () => {
      const indexes = WalletTransaction.schema.indexes();
      const indexFields = indexes.map(index => Object.keys(index[0]));
      
      expect(indexFields).toContainEqual(['walletId']);
      expect(indexFields).toContainEqual(['affiliateId']);
      expect(indexFields).toContainEqual(['type']);
      expect(indexFields).toContainEqual(['status']);
      expect(indexFields).toContainEqual(['reference']);
      expect(indexFields).toContainEqual(['relatedId', 'relatedModel']);
    });

    it('should have compound indexes for common queries', () => {
      const indexes = WalletTransaction.schema.indexes();
      const compoundIndexes = indexes.filter(index => Object.keys(index[0]).length > 1);
      
      expect(compoundIndexes.length).toBeGreaterThan(0);
    });
  });

  describe('Transaction Types', () => {
    const transactionTypes = [
      'commission_credit',
      'withdrawal_debit',
      'adjustment_credit',
      'adjustment_debit',
      'refund_credit',
      'reversal_credit',
      'penalty_debit'
    ];

    transactionTypes.forEach(type => {
      it(`should accept ${type} transaction type`, async () => {
        const transaction = await WalletTransaction.create({
          walletId: testWallet._id,
          affiliateId: testAffiliate._id,
          type,
          amount: 100,
          balanceBefore: 900,
          balanceAfter: type.includes('credit') ? 1000 : 800,
          description: `Test ${type} transaction`,
        });

        expect(transaction.type).toBe(type);
      });
    });
  });

  describe('Metadata Handling', () => {
    it('should store and retrieve metadata', async () => {
      const metadata = {
        bookingId: 'BOOK_123',
        serviceType: 'flight',
        commissionRate: 2.5,
        originalAmount: 4000,
      };

      const transaction = await WalletTransaction.create({
        walletId: testWallet._id,
        affiliateId: testAffiliate._id,
        type: 'commission_credit',
        amount: 100,
        balanceBefore: 900,
        balanceAfter: 1000,
        description: 'Commission from flight booking',
        metadata,
      });

      expect(transaction.metadata).toEqual(metadata);
    });

    it('should handle empty metadata', async () => {
      const transaction = await WalletTransaction.create({
        walletId: testWallet._id,
        affiliateId: testAffiliate._id,
        type: 'commission_credit',
        amount: 100,
        balanceBefore: 900,
        balanceAfter: 1000,
        description: 'Test transaction',
      });

      expect(transaction.metadata).toEqual({});
    });
  });

  describe('Related Model References', () => {
    it('should store related model information', async () => {
      const relatedId = new mongoose.Types.ObjectId();
      
      const transaction = await WalletTransaction.create({
        walletId: testWallet._id,
        affiliateId: testAffiliate._id,
        type: 'commission_credit',
        amount: 100,
        balanceBefore: 900,
        balanceAfter: 1000,
        description: 'Commission transaction',
        relatedId,
        relatedModel: 'CommissionTransaction',
      });

      expect(transaction.relatedId.toString()).toBe(relatedId.toString());
      expect(transaction.relatedModel).toBe('CommissionTransaction');
    });

    it('should validate related model enum', async () => {
      const transaction = new WalletTransaction({
        walletId: testWallet._id,
        affiliateId: testAffiliate._id,
        type: 'commission_credit',
        amount: 100,
        balanceBefore: 900,
        balanceAfter: 1000,
        description: 'Test transaction',
        relatedId: new mongoose.Types.ObjectId(),
        relatedModel: 'InvalidModel',
      });

      await expect(transaction.save()).rejects.toThrow();
    });
  });
});