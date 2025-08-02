// v1/test/integration/walletBasic.test.js
const mongoose = require('mongoose');
const WalletService = require('../../services/walletService');
const Wallet = require('../../models/walletModel');
const WalletTransaction = require('../../models/walletTransactionModel');
const Affiliate = require('../../models/affiliateModel');
const User = require('../../models/userModel');

describe('Wallet System Basic Integration', () => {
  let testUser;
  let testAffiliate;

  beforeAll(async () => {
    // Ensure test environment is set up
    process.env.NODE_ENV = 'test';
    process.env.JWT_ACCESS_SECRET = 'test_access_secret';
    process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';
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

    // Create test user and affiliate if they don't exist
    if (!testUser) {
      testUser = await User.create({
        firstName: 'Test',
        lastName: 'Affiliate',
        email: 'testaffiliate@example.com',
        password: 'password123',
        role: 'Business',
      });
    }

    if (!testAffiliate) {
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
        status: 'active',
      });
    }
  });

  describe('Wallet Creation and Management', () => {
    it('should create a wallet successfully', async () => {
      const result = await WalletService.createWallet(testAffiliate._id);

      expect(result.success).toBe(true);
      expect(result.data.balance).toBe(0);
      expect(result.data.currency).toBe('NGN');
      expect(result.data.status).toBe('active');

      // Verify wallet exists in database
      const wallet = await Wallet.findOne({ affiliateId: testAffiliate._id });
      expect(wallet).toBeTruthy();
    });

    it('should get wallet balance', async () => {
      // Create wallet first
      await WalletService.createWallet(testAffiliate._id);

      const result = await WalletService.getBalance(testAffiliate._id);

      expect(result.success).toBe(true);
      expect(result.data.balance).toBe(0);
      expect(result.data.totalEarned).toBe(0);
      expect(result.data.totalWithdrawn).toBe(0);
    });

    it('should credit wallet successfully', async () => {
      // Create wallet first
      await WalletService.createWallet(testAffiliate._id);

      const result = await WalletService.creditWallet(
        testAffiliate._id,
        100.50,
        'TXN_CREDIT_TEST',
        { description: 'Test commission' }
      );

      expect(result.success).toBe(true);
      expect(result.data.wallet.balance).toBe(100.50);
      expect(result.data.transaction.amount).toBe(100.50);
      expect(result.data.transaction.type).toBe('commission_credit');

      // Verify transaction was created
      const transaction = await WalletTransaction.findOne({
        reference: 'TXN_CREDIT_TEST',
      });
      expect(transaction).toBeTruthy();
      expect(transaction.balanceBefore).toBe(0);
      expect(transaction.balanceAfter).toBe(100.50);
    });

    it('should debit wallet successfully', async () => {
      // Create wallet and add balance
      await WalletService.createWallet(testAffiliate._id);
      await WalletService.creditWallet(
        testAffiliate._id,
        500,
        'TXN_INITIAL_CREDIT',
        { description: 'Initial balance' }
      );

      const result = await WalletService.debitWallet(
        testAffiliate._id,
        200.25,
        'TXN_DEBIT_TEST',
        { description: 'Test withdrawal' }
      );

      expect(result.success).toBe(true);
      expect(result.data.wallet.balance).toBe(299.75);
      expect(result.data.transaction.amount).toBe(200.25);
      expect(result.data.transaction.type).toBe('withdrawal_debit');

      // Verify transaction was created
      const transaction = await WalletTransaction.findOne({
        reference: 'TXN_DEBIT_TEST',
      });
      expect(transaction).toBeTruthy();
      expect(transaction.balanceBefore).toBe(500);
      expect(transaction.balanceAfter).toBe(299.75);
    });

    it('should get transaction history', async () => {
      // Create wallet and perform transactions
      await WalletService.createWallet(testAffiliate._id);
      await WalletService.creditWallet(
        testAffiliate._id,
        100,
        'TXN_001',
        { description: 'Commission 1' }
      );
      await WalletService.creditWallet(
        testAffiliate._id,
        200,
        'TXN_002',
        { description: 'Commission 2' }
      );
      await WalletService.debitWallet(
        testAffiliate._id,
        50,
        'TXN_003',
        { description: 'Withdrawal 1' }
      );

      const result = await WalletService.getTransactionHistory(testAffiliate._id, {
        page: 1,
        limit: 10,
      });

      expect(result.success).toBe(true);
      expect(result.data.transactions).toHaveLength(3);
      expect(result.data.pagination.totalCount).toBe(3);

      // Verify transactions are sorted by creation date (newest first)
      const transactions = result.data.transactions;
      expect(transactions[0].reference).toBe('TXN_003'); // Most recent
      expect(transactions[1].reference).toBe('TXN_002');
      expect(transactions[2].reference).toBe('TXN_001'); // Oldest
    });

    it('should freeze and unfreeze wallet', async () => {
      // Create wallet
      await WalletService.createWallet(testAffiliate._id);

      // Freeze wallet
      const freezeResult = await WalletService.freezeWallet(
        testAffiliate._id,
        'Suspicious activity',
        'admin123'
      );

      expect(freezeResult.success).toBe(true);
      expect(freezeResult.data.status).toBe('frozen');

      // Verify wallet is frozen in database
      let wallet = await Wallet.findOne({ affiliateId: testAffiliate._id });
      expect(wallet.status).toBe('frozen');
      expect(wallet.freezeReason).toBe('Suspicious activity');

      // Unfreeze wallet
      const unfreezeResult = await WalletService.unfreezeWallet(
        testAffiliate._id,
        'admin123'
      );

      expect(unfreezeResult.success).toBe(true);
      expect(unfreezeResult.data.status).toBe('active');

      // Verify wallet is unfrozen in database
      wallet = await Wallet.findOne({ affiliateId: testAffiliate._id });
      expect(wallet.status).toBe('active');
      expect(wallet.freezeReason).toBeNull();
    });

    it('should validate wallet operations', async () => {
      // Create wallet with balance
      await WalletService.createWallet(testAffiliate._id);
      await WalletService.creditWallet(
        testAffiliate._id,
        1000,
        'TXN_BALANCE',
        { description: 'Initial balance' }
      );

      // Validate credit operation
      const creditValidation = await WalletService.validateWallet(
        testAffiliate._id,
        'credit'
      );
      expect(creditValidation.success).toBe(true);
      expect(creditValidation.valid).toBe(true);

      // Validate debit operation with sufficient balance
      const debitValidation = await WalletService.validateWallet(
        testAffiliate._id,
        'debit',
        500
      );
      expect(debitValidation.success).toBe(true);
      expect(debitValidation.valid).toBe(true);

      // Validate debit operation with insufficient balance
      const insufficientValidation = await WalletService.validateWallet(
        testAffiliate._id,
        'debit',
        2000
      );
      expect(insufficientValidation.success).toBe(true);
      expect(insufficientValidation.valid).toBe(false);
      expect(insufficientValidation.reason).toBe('Insufficient balance');
    });

    it('should update bank details', async () => {
      // Create wallet
      await WalletService.createWallet(testAffiliate._id);

      const bankDetails = {
        accountName: 'Test Business Account',
        accountNumber: '1234567890',
        bankCode: '058',
        bankName: 'Guaranty Trust Bank',
      };

      const result = await WalletService.updateBankDetails(
        testAffiliate._id,
        bankDetails
      );

      expect(result.success).toBe(true);

      // Verify bank details were updated
      const wallet = await Wallet.findOne({ affiliateId: testAffiliate._id });
      expect(wallet.bankDetails.accountName).toBe(bankDetails.accountName);
      expect(wallet.bankDetails.accountNumber).toBe(bankDetails.accountNumber);
      expect(wallet.bankDetails.bankCode).toBe(bankDetails.bankCode);
      expect(wallet.bankDetails.bankName).toBe(bankDetails.bankName);
    });

    it('should get wallet statistics', async () => {
      // Create wallet and perform transactions
      await WalletService.createWallet(testAffiliate._id);
      await WalletService.creditWallet(
        testAffiliate._id,
        100,
        'TXN_STAT_001',
        { description: 'Commission 1', type: 'commission_credit' }
      );
      await WalletService.creditWallet(
        testAffiliate._id,
        200,
        'TXN_STAT_002',
        { description: 'Commission 2', type: 'commission_credit' }
      );
      await WalletService.debitWallet(
        testAffiliate._id,
        50,
        'TXN_STAT_003',
        { description: 'Withdrawal 1', type: 'withdrawal_debit' }
      );

      const result = await WalletService.getWalletStatistics(testAffiliate._id);

      expect(result.success).toBe(true);
      expect(result.data.wallet.balance).toBe(250);
      expect(result.data.transactions.totalTransactions).toBe(3);
      expect(result.data.transactions.totalAmount).toBe(350); // 100 + 200 + 50
    });

    it('should reverse a transaction', async () => {
      // Create wallet and perform a credit transaction
      await WalletService.createWallet(testAffiliate._id);
      const creditResult = await WalletService.creditWallet(
        testAffiliate._id,
        100,
        'TXN_TO_REVERSE',
        { description: 'Commission to reverse' }
      );

      const transactionId = creditResult.data.transaction.id;

      // Reverse the transaction
      const reverseResult = await WalletService.reverseTransaction(
        transactionId,
        'Error in calculation',
        'admin123'
      );

      expect(reverseResult.success).toBe(true);
      expect(reverseResult.data.wallet.balance).toBe(0); // Back to original balance

      // Verify original transaction is marked as reversed
      const originalTransaction = await WalletTransaction.findById(transactionId);
      expect(originalTransaction.status).toBe('reversed');
      expect(originalTransaction.reversalReason).toBe('Error in calculation');

      // Verify reversal transaction was created
      const reversalTransaction = await WalletTransaction.findOne({
        reference: `REV_TXN_TO_REVERSE`,
      });
      expect(reversalTransaction).toBeTruthy();
      expect(reversalTransaction.type).toBe('reversal_debit');
      expect(reversalTransaction.amount).toBe(100);
    });
  });

  describe('Error Handling', () => {
    it('should handle wallet not found errors', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      await expect(WalletService.getBalance(nonExistentId))
        .rejects.toThrow('Wallet not found');
    });

    it('should handle duplicate wallet creation', async () => {
      await WalletService.createWallet(testAffiliate._id);

      await expect(WalletService.createWallet(testAffiliate._id))
        .rejects.toThrow('Wallet already exists');
    });

    it('should handle insufficient balance for debit', async () => {
      await WalletService.createWallet(testAffiliate._id);

      await expect(WalletService.debitWallet(
        testAffiliate._id,
        100,
        'TXN_INSUFFICIENT',
        { description: 'Test insufficient' }
      )).rejects.toThrow('Insufficient wallet balance');
    });

    it('should handle duplicate transaction references', async () => {
      await WalletService.createWallet(testAffiliate._id);
      
      // First transaction
      await WalletService.creditWallet(
        testAffiliate._id,
        100,
        'TXN_DUPLICATE',
        { description: 'First transaction' }
      );

      // Second transaction with same reference
      await expect(WalletService.creditWallet(
        testAffiliate._id,
        200,
        'TXN_DUPLICATE',
        { description: 'Duplicate transaction' }
      )).rejects.toThrow('Transaction reference already exists');
    });

    it('should handle operations on frozen wallet', async () => {
      await WalletService.createWallet(testAffiliate._id);
      await WalletService.freezeWallet(testAffiliate._id, 'Test freeze', 'admin123');

      await expect(WalletService.creditWallet(
        testAffiliate._id,
        100,
        'TXN_FROZEN',
        { description: 'Credit to frozen wallet' }
      )).rejects.toThrow('Cannot credit frozen wallet');
    });
  });

  describe('Transaction Consistency', () => {
    it('should maintain transaction consistency during concurrent operations', async () => {
      await WalletService.createWallet(testAffiliate._id);
      
      // Add initial balance
      await WalletService.creditWallet(
        testAffiliate._id,
        1000,
        'TXN_INITIAL',
        { description: 'Initial balance' }
      );

      // Perform multiple operations
      const operations = [
        WalletService.creditWallet(testAffiliate._id, 100, 'TXN_C1', { description: 'Credit 1' }),
        WalletService.creditWallet(testAffiliate._id, 200, 'TXN_C2', { description: 'Credit 2' }),
        WalletService.debitWallet(testAffiliate._id, 50, 'TXN_D1', { description: 'Debit 1' }),
        WalletService.debitWallet(testAffiliate._id, 75, 'TXN_D2', { description: 'Debit 2' }),
      ];

      const results = await Promise.all(operations);

      // Verify all operations succeeded
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Verify final balance is correct
      const balanceResult = await WalletService.getBalance(testAffiliate._id);
      expect(balanceResult.data.balance).toBe(1175); // 1000 + 100 + 200 - 50 - 75

      // Verify transaction count
      const historyResult = await WalletService.getTransactionHistory(testAffiliate._id);
      expect(historyResult.data.transactions).toHaveLength(5); // Initial + 4 operations
    });
  });
});