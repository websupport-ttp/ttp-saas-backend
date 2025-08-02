// v1/test/integration/walletCore.test.js
const mongoose = require('mongoose');
const WalletService = require('../../services/walletService');
const Wallet = require('../../models/walletModel');
const WalletTransaction = require('../../models/walletTransactionModel');

describe('Wallet Core Functionality', () => {
  let testAffiliateId;

  beforeAll(async () => {
    // Ensure test environment is set up
    process.env.NODE_ENV = 'test';
    process.env.JWT_ACCESS_SECRET = 'test_access_secret';
    process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';
    
    // Create a test affiliate ID
    testAffiliateId = new mongoose.Types.ObjectId();
  });

  afterAll(async () => {
    // Clean up test data
    await Wallet.deleteMany({});
    await WalletTransaction.deleteMany({});
  });

  beforeEach(async () => {
    // Clean up before each test
    await Wallet.deleteMany({});
    await WalletTransaction.deleteMany({});
  });

  describe('Wallet Model Operations', () => {
    it('should create a wallet with default values', async () => {
      const wallet = new Wallet({
        affiliateId: testAffiliateId,
      });

      const savedWallet = await wallet.save();

      expect(savedWallet.affiliateId.toString()).toBe(testAffiliateId.toString());
      expect(savedWallet.balance).toBe(0);
      expect(savedWallet.totalEarned).toBe(0);
      expect(savedWallet.totalWithdrawn).toBe(0);
      expect(savedWallet.currency).toBe('NGN');
      expect(savedWallet.status).toBe('active');
    });

    it('should credit wallet using model method', async () => {
      const wallet = new Wallet({
        affiliateId: testAffiliateId,
      });
      await wallet.save();

      await wallet.credit(100.50, 'Test commission');

      expect(wallet.balance).toBe(100.50);
      expect(wallet.totalEarned).toBe(100.50);
      expect(wallet.lastTransactionAt).toBeInstanceOf(Date);
    });

    it('should debit wallet using model method', async () => {
      const wallet = new Wallet({
        affiliateId: testAffiliateId,
        balance: 500,
        totalEarned: 500,
      });
      await wallet.save();

      await wallet.debit(200.25, 'Test withdrawal');

      expect(wallet.balance).toBe(299.75);
      expect(wallet.totalWithdrawn).toBe(200.25);
      expect(wallet.lastTransactionAt).toBeInstanceOf(Date);
    });

    it('should freeze and unfreeze wallet', async () => {
      const wallet = new Wallet({
        affiliateId: testAffiliateId,
      });
      await wallet.save();

      // Freeze wallet
      await wallet.freeze('Suspicious activity');
      expect(wallet.status).toBe('frozen');
      expect(wallet.freezeReason).toBe('Suspicious activity');
      expect(wallet.frozenAt).toBeInstanceOf(Date);

      // Unfreeze wallet
      await wallet.unfreeze();
      expect(wallet.status).toBe('active');
      expect(wallet.freezeReason).toBeNull();
      expect(wallet.frozenAt).toBeNull();
    });

    it('should validate withdrawal capability', async () => {
      const wallet = new Wallet({
        affiliateId: testAffiliateId,
        balance: 1000,
        bankDetails: {
          accountName: 'Test Account',
          accountNumber: '1234567890',
          bankCode: '058',
          bankName: 'Test Bank',
        },
      });
      await wallet.save();

      // Valid withdrawal
      const validResult = wallet.canWithdraw(500);
      expect(validResult.allowed).toBe(true);

      // Invalid withdrawal - insufficient balance
      const invalidResult = wallet.canWithdraw(2000);
      expect(invalidResult.allowed).toBe(false);
      expect(invalidResult.reason).toBe('Insufficient balance');
    });

    it('should update bank details', async () => {
      const wallet = new Wallet({
        affiliateId: testAffiliateId,
      });
      await wallet.save();

      const bankDetails = {
        accountName: 'Updated Account',
        accountNumber: '9876543210',
        bankCode: '044',
        bankName: 'Access Bank',
      };

      await wallet.updateBankDetails(bankDetails);

      expect(wallet.bankDetails.accountName).toBe(bankDetails.accountName);
      expect(wallet.bankDetails.accountNumber).toBe(bankDetails.accountNumber);
      expect(wallet.bankDetails.bankCode).toBe(bankDetails.bankCode);
      expect(wallet.bankDetails.bankName).toBe(bankDetails.bankName);
    });

    it('should get wallet summary', async () => {
      const wallet = new Wallet({
        affiliateId: testAffiliateId,
        balance: 500,
        totalEarned: 1000,
        totalWithdrawn: 500,
        bankDetails: {
          accountName: 'Test Account',
          accountNumber: '1234567890',
          bankCode: '058',
          bankName: 'Test Bank',
        },
      });
      await wallet.save();

      const summary = wallet.getSummary();

      expect(summary.balance).toBe(500);
      expect(summary.totalEarned).toBe(1000);
      expect(summary.totalWithdrawn).toBe(500);
      expect(summary.currency).toBe('NGN');
      expect(summary.status).toBe('active');
      expect(summary.hasBankDetails).toBe(true);
    });
  });

  describe('Wallet Transaction Model Operations', () => {
    let testWallet;

    beforeEach(async () => {
      testWallet = new Wallet({
        affiliateId: testAffiliateId,
        balance: 1000,
      });
      await testWallet.save();
    });

    it('should create a wallet transaction', async () => {
      const transaction = new WalletTransaction({
        walletId: testWallet._id,
        affiliateId: testAffiliateId,
        type: 'commission_credit',
        amount: 100.50,
        balanceBefore: 900,
        balanceAfter: 1000.50,
        currency: 'NGN',
        description: 'Commission earned from booking',
        reference: 'TXN_TEST_123',
      });

      const savedTransaction = await transaction.save();

      expect(savedTransaction.walletId.toString()).toBe(testWallet._id.toString());
      expect(savedTransaction.affiliateId.toString()).toBe(testAffiliateId.toString());
      expect(savedTransaction.type).toBe('commission_credit');
      expect(savedTransaction.amount).toBe(100.50);
      expect(savedTransaction.balanceBefore).toBe(900);
      expect(savedTransaction.balanceAfter).toBe(1000.50);
      expect(savedTransaction.status).toBe('completed');
    });

    it('should generate reference automatically', async () => {
      const transaction = new WalletTransaction({
        walletId: testWallet._id,
        affiliateId: testAffiliateId,
        type: 'commission_credit',
        amount: 100,
        balanceBefore: 900,
        balanceAfter: 1000,
        description: 'Test transaction',
      });

      const savedTransaction = await transaction.save();

      expect(savedTransaction.reference).toBeDefined();
      expect(savedTransaction.reference).toMatch(/^COMMISSIONCREDIT_\d+_/);
    });

    it('should reverse a transaction', async () => {
      const transaction = new WalletTransaction({
        walletId: testWallet._id,
        affiliateId: testAffiliateId,
        type: 'commission_credit',
        amount: 100,
        balanceBefore: 900,
        balanceAfter: 1000,
        description: 'Test transaction',
        reference: 'TXN_TO_REVERSE',
      });
      await transaction.save();

      await transaction.reverse('Error in calculation', testAffiliateId);

      expect(transaction.status).toBe('reversed');
      expect(transaction.reversedAt).toBeInstanceOf(Date);
      expect(transaction.reversalReason).toBe('Error in calculation');
    });

    it('should get transaction summary', async () => {
      const transaction = new WalletTransaction({
        walletId: testWallet._id,
        affiliateId: testAffiliateId,
        type: 'commission_credit',
        amount: 100,
        balanceBefore: 900,
        balanceAfter: 1000,
        description: 'Test transaction',
        reference: 'TXN_SUMMARY',
      });
      await transaction.save();

      const summary = transaction.getSummary();

      expect(summary.id).toBe(transaction._id);
      expect(summary.type).toBe('commission_credit');
      expect(summary.amount).toBe(100);
      expect(summary.currency).toBe('NGN');
      expect(summary.description).toBe('Test transaction');
      expect(summary.reference).toBe('TXN_SUMMARY');
      expect(summary.status).toBe('completed');
      expect(summary.balanceBefore).toBe(900);
      expect(summary.balanceAfter).toBe(1000);
    });

    it('should find transactions by wallet', async () => {
      // Create test transactions
      const transactions = [
        {
          walletId: testWallet._id,
          affiliateId: testAffiliateId,
          type: 'commission_credit',
          amount: 100,
          balanceBefore: 0,
          balanceAfter: 100,
          description: 'Commission 1',
          reference: 'TXN_001',
        },
        {
          walletId: testWallet._id,
          affiliateId: testAffiliateId,
          type: 'withdrawal_debit',
          amount: 50,
          balanceBefore: 100,
          balanceAfter: 50,
          description: 'Withdrawal 1',
          reference: 'TXN_002',
        },
      ];

      await WalletTransaction.create(transactions);

      const foundTransactions = await WalletTransaction.findByWallet(testWallet._id);

      expect(foundTransactions).toHaveLength(2);
      expect(foundTransactions[0].createdAt.getTime()).toBeGreaterThanOrEqual(
        foundTransactions[1].createdAt.getTime()
      );
    });

    it('should get transaction statistics', async () => {
      // Create test transactions
      const transactions = [
        {
          walletId: testWallet._id,
          affiliateId: testAffiliateId,
          type: 'commission_credit',
          amount: 100,
          balanceBefore: 0,
          balanceAfter: 100,
          description: 'Commission 1',
          reference: 'TXN_STAT_001',
        },
        {
          walletId: testWallet._id,
          affiliateId: testAffiliateId,
          type: 'commission_credit',
          amount: 200,
          balanceBefore: 100,
          balanceAfter: 300,
          description: 'Commission 2',
          reference: 'TXN_STAT_002',
        },
        {
          walletId: testWallet._id,
          affiliateId: testAffiliateId,
          type: 'withdrawal_debit',
          amount: 50,
          balanceBefore: 300,
          balanceAfter: 250,
          description: 'Withdrawal 1',
          reference: 'TXN_STAT_003',
        },
      ];

      await WalletTransaction.create(transactions);

      const stats = await WalletTransaction.getStatistics(testAffiliateId);

      expect(stats).toHaveLength(1);
      expect(stats[0].totalTransactions).toBe(3);
      expect(stats[0].totalAmount).toBe(350); // 100 + 200 + 50
      expect(stats[0].byType).toHaveLength(2);

      const commissionStats = stats[0].byType.find(t => t.type === 'commission_credit');
      const withdrawalStats = stats[0].byType.find(t => t.type === 'withdrawal_debit');

      expect(commissionStats.count).toBe(2);
      expect(commissionStats.totalAmount).toBe(300);
      expect(withdrawalStats.count).toBe(1);
      expect(withdrawalStats.totalAmount).toBe(50);
    });
  });

  describe('Wallet Service Operations (without Affiliate dependency)', () => {
    it('should handle wallet not found error', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      await expect(WalletService.getBalance(nonExistentId))
        .rejects.toThrow('Wallet not found');
    });

    it('should validate input parameters', async () => {
      await expect(WalletService.getBalance(null))
        .rejects.toThrow('Affiliate ID is required');

      await expect(WalletService.creditWallet(null, 100, 'TXN_123'))
        .rejects.toThrow('Affiliate ID, amount, and transaction reference are required');

      await expect(WalletService.creditWallet(testAffiliateId, -100, 'TXN_123'))
        .rejects.toThrow('Credit amount must be positive');
    });

    it('should handle transaction reference validation', async () => {
      // Create a wallet first
      const wallet = new Wallet({ affiliateId: testAffiliateId });
      await wallet.save();

      // Create first transaction
      await WalletService.creditWallet(
        testAffiliateId,
        100,
        'TXN_DUPLICATE',
        { description: 'First transaction' }
      );

      // Try to create duplicate transaction
      await expect(WalletService.creditWallet(
        testAffiliateId,
        200,
        'TXN_DUPLICATE',
        { description: 'Duplicate transaction' }
      )).rejects.toThrow('Transaction reference already exists');
    });

    it('should handle wallet status validation', async () => {
      // Create and freeze wallet
      const wallet = new Wallet({ affiliateId: testAffiliateId });
      await wallet.save();
      await wallet.freeze('Test freeze');

      await expect(WalletService.creditWallet(
        testAffiliateId,
        100,
        'TXN_FROZEN',
        { description: 'Credit to frozen wallet' }
      )).rejects.toThrow('Cannot credit frozen wallet');
    });

    it('should handle insufficient balance for debit', async () => {
      // Create wallet with low balance
      const wallet = new Wallet({ 
        affiliateId: testAffiliateId,
        balance: 50
      });
      await wallet.save();

      await expect(WalletService.debitWallet(
        testAffiliateId,
        100,
        'TXN_INSUFFICIENT',
        { description: 'Insufficient balance test' }
      )).rejects.toThrow('Insufficient wallet balance');
    });
  });

  describe('Data Validation and Constraints', () => {
    it('should validate wallet schema constraints', async () => {
      // Test negative balance
      const walletWithNegativeBalance = new Wallet({
        affiliateId: testAffiliateId,
        balance: -100,
      });

      await expect(walletWithNegativeBalance.save())
        .rejects.toThrow('Balance cannot be negative');

      // Test invalid currency
      const walletWithInvalidCurrency = new Wallet({
        affiliateId: testAffiliateId,
        currency: 'INVALID',
      });

      await expect(walletWithInvalidCurrency.save())
        .rejects.toThrow('Currency must be one of: NGN, USD, EUR, GBP');

      // Test invalid status
      const walletWithInvalidStatus = new Wallet({
        affiliateId: testAffiliateId,
        status: 'invalid_status',
      });

      await expect(walletWithInvalidStatus.save())
        .rejects.toThrow('Status must be one of: active, frozen, suspended');
    });

    it('should validate transaction schema constraints', async () => {
      const wallet = new Wallet({ affiliateId: testAffiliateId });
      await wallet.save();

      // Test invalid transaction type
      const transactionWithInvalidType = new WalletTransaction({
        walletId: wallet._id,
        affiliateId: testAffiliateId,
        type: 'invalid_type',
        amount: 100,
        balanceBefore: 0,
        balanceAfter: 100,
        description: 'Test transaction',
      });

      await expect(transactionWithInvalidType.save())
        .rejects.toThrow('Transaction type must be one of the allowed values');

      // Test zero amount
      const transactionWithZeroAmount = new WalletTransaction({
        walletId: wallet._id,
        affiliateId: testAffiliateId,
        type: 'commission_credit',
        amount: 0,
        balanceBefore: 0,
        balanceAfter: 0,
        description: 'Test transaction',
      });

      await expect(transactionWithZeroAmount.save())
        .rejects.toThrow('Amount must be greater than 0');
    });

    it('should validate bank details format', async () => {
      const wallet = new Wallet({
        affiliateId: testAffiliateId,
        bankDetails: {
          accountName: 'Test Account',
          accountNumber: '123', // Invalid: not 10 digits
          bankCode: '12', // Invalid: not 3 digits
          bankName: 'Test Bank',
        },
      });

      await expect(wallet.save()).rejects.toThrow();
    });
  });

  describe('Precision and Rounding', () => {
    it('should handle decimal precision correctly', async () => {
      const wallet = new Wallet({
        affiliateId: testAffiliateId,
        balance: 100.999, // Should be rounded to 101.00
        totalEarned: 200.555, // Should be rounded to 200.56
      });
      await wallet.save();

      expect(wallet.balance).toBe(101.00);
      expect(wallet.totalEarned).toBe(200.56);
    });

    it('should handle transaction amount precision', async () => {
      const wallet = new Wallet({ affiliateId: testAffiliateId });
      await wallet.save();

      const transaction = new WalletTransaction({
        walletId: wallet._id,
        affiliateId: testAffiliateId,
        type: 'commission_credit',
        amount: 100.999, // Should be rounded to 101.00
        balanceBefore: 0.555, // Should be rounded to 0.56
        balanceAfter: 101.554, // Should be rounded to 101.55
        description: 'Precision test',
      });
      await transaction.save();

      expect(transaction.amount).toBe(101.00);
      expect(transaction.balanceBefore).toBe(0.56);
      expect(transaction.balanceAfter).toBe(101.55);
    });
  });

  describe('Static Methods and Aggregations', () => {
    beforeEach(async () => {
      // Create test wallets with different statuses and balances
      const wallets = [
        {
          affiliateId: new mongoose.Types.ObjectId(),
          balance: 1000,
          status: 'active',
        },
        {
          affiliateId: new mongoose.Types.ObjectId(),
          balance: 500,
          status: 'frozen',
        },
        {
          affiliateId: new mongoose.Types.ObjectId(),
          balance: 2000,
          status: 'active',
        },
      ];

      await Wallet.create(wallets);
    });

    it('should find wallets by status', async () => {
      const activeWallets = await Wallet.findByStatus('active');
      const frozenWallets = await Wallet.findByStatus('frozen');

      expect(activeWallets).toHaveLength(2);
      expect(frozenWallets).toHaveLength(1);
      
      activeWallets.forEach(wallet => {
        expect(wallet.status).toBe('active');
      });
      
      frozenWallets.forEach(wallet => {
        expect(wallet.status).toBe('frozen');
      });
    });

    it('should find wallets with balance above threshold', async () => {
      const walletsAbove750 = await Wallet.findWithBalanceAbove(750);
      const walletsAbove1500 = await Wallet.findWithBalanceAbove(1500);

      expect(walletsAbove750).toHaveLength(2); // 1000 and 2000
      expect(walletsAbove1500).toHaveLength(1); // 2000 only
      
      walletsAbove750.forEach(wallet => {
        expect(wallet.balance).toBeGreaterThanOrEqual(750);
      });
    });

    it('should get total system balance statistics', async () => {
      const stats = await Wallet.getTotalSystemBalance();

      expect(stats).toHaveLength(1);
      expect(stats[0].totalBalance).toBe(3500); // 1000 + 500 + 2000
      expect(stats[0].activeWallets).toBe(2);
      expect(stats[0].frozenWallets).toBe(1);
      expect(stats[0].suspendedWallets).toBe(0);
    });
  });
});