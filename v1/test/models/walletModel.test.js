// v1/test/models/walletModel.test.js
const mongoose = require('mongoose');
const Wallet = require('../../models/walletModel');
const Affiliate = require('../../models/affiliateModel');
const User = require('../../models/userModel');

describe('Wallet Model', () => {
  let testUser;
  let testAffiliate;
  
  beforeAll(async () => {
    // Ensure test environment is set up
    process.env.NODE_ENV = 'test';
    process.env.JWT_ACCESS_SECRET = 'test_access_secret';
    process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';
    
    // Create test user and affiliate
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
  });

  afterAll(async () => {
    // Clean up test data
    await User.deleteMany({});
    await Affiliate.deleteMany({});
    await Wallet.deleteMany({});
  });

  beforeEach(async () => {
    // Clean up wallets before each test
    await Wallet.deleteMany({});
  });

  describe('Wallet Creation', () => {
    it('should create a valid wallet', async () => {
      const walletData = {
        affiliateId: testAffiliate._id,
        bankDetails: {
          accountName: 'Test Business Account',
          accountNumber: '1234567890',
          bankCode: '058',
          bankName: 'Guaranty Trust Bank',
        },
      };

      const wallet = new Wallet(walletData);
      const savedWallet = await wallet.save();

      expect(savedWallet.affiliateId.toString()).toBe(testAffiliate._id.toString());
      expect(savedWallet.balance).toBe(0);
      expect(savedWallet.totalEarned).toBe(0);
      expect(savedWallet.totalWithdrawn).toBe(0);
      expect(savedWallet.currency).toBe('NGN');
      expect(savedWallet.status).toBe('active');
      expect(savedWallet.bankDetails.accountName).toBe(walletData.bankDetails.accountName);
      expect(savedWallet.bankDetails.accountNumber).toBe(walletData.bankDetails.accountNumber);
    });

    it('should require affiliate ID', async () => {
      const wallet = new Wallet({});

      await expect(wallet.save()).rejects.toThrow('Affiliate ID is required');
    });

    it('should enforce unique affiliate ID constraint', async () => {
      await Wallet.create({
        affiliateId: testAffiliate._id,
      });

      const duplicateWallet = new Wallet({
        affiliateId: testAffiliate._id,
      });

      await expect(duplicateWallet.save()).rejects.toThrow();
    });

    it('should validate account number format', async () => {
      const wallet = new Wallet({
        affiliateId: testAffiliate._id,
        bankDetails: {
          accountName: 'Test Account',
          accountNumber: '123', // Invalid: not 10 digits
          bankCode: '058',
          bankName: 'Test Bank',
        },
      });

      await expect(wallet.save()).rejects.toThrow('Account number must be exactly 10 digits');
    });

    it('should validate bank code format', async () => {
      const wallet = new Wallet({
        affiliateId: testAffiliate._id,
        bankDetails: {
          accountName: 'Test Account',
          accountNumber: '1234567890',
          bankCode: '12', // Invalid: not 3 digits
          bankName: 'Test Bank',
        },
      });

      await expect(wallet.save()).rejects.toThrow('Bank code must be exactly 3 digits');
    });

    it('should validate bank details completeness', async () => {
      const wallet = new Wallet({
        affiliateId: testAffiliate._id,
        bankDetails: {
          accountNumber: '1234567890',
          // Missing required fields when bank details are provided
        },
      });

      await expect(wallet.save()).rejects.toThrow();
    });

    it('should set default values correctly', async () => {
      const wallet = await Wallet.create({
        affiliateId: testAffiliate._id,
      });

      expect(wallet.balance).toBe(0);
      expect(wallet.totalEarned).toBe(0);
      expect(wallet.totalWithdrawn).toBe(0);
      expect(wallet.currency).toBe('NGN');
      expect(wallet.status).toBe('active');
    });
  });

  describe('Wallet Methods', () => {
    let wallet;

    beforeEach(async () => {
      wallet = await Wallet.create({
        affiliateId: testAffiliate._id,
        bankDetails: {
          accountName: 'Test Business Account',
          accountNumber: '1234567890',
          bankCode: '058',
          bankName: 'Guaranty Trust Bank',
        },
      });
    });

    describe('Credit Operations', () => {
      it('should credit wallet successfully', async () => {
        const creditAmount = 100.50;
        const initialBalance = wallet.balance;
        const initialEarned = wallet.totalEarned;

        await wallet.credit(creditAmount);

        expect(wallet.balance).toBe(initialBalance + creditAmount);
        expect(wallet.totalEarned).toBe(initialEarned + creditAmount);
        expect(wallet.lastTransactionAt).toBeInstanceOf(Date);
      });

      it('should reject negative credit amount', async () => {
        await expect(wallet.credit(-50)).rejects.toThrow('Credit amount must be positive');
      });

      it('should reject zero credit amount', async () => {
        await expect(wallet.credit(0)).rejects.toThrow('Credit amount must be positive');
      });

      it('should reject credit to inactive wallet', async () => {
        wallet.status = 'frozen';
        await wallet.save();

        await expect(wallet.credit(100)).rejects.toThrow('Cannot credit inactive wallet');
      });

      it('should round credit amount to 2 decimal places', async () => {
        await wallet.credit(100.999);

        expect(wallet.balance).toBe(101.00);
        expect(wallet.totalEarned).toBe(101.00);
      });
    });

    describe('Debit Operations', () => {
      beforeEach(async () => {
        // Add some balance for debit tests
        await wallet.credit(500);
      });

      it('should debit wallet successfully', async () => {
        const debitAmount = 100.50;
        const initialBalance = wallet.balance;
        const initialWithdrawn = wallet.totalWithdrawn;

        await wallet.debit(debitAmount);

        expect(wallet.balance).toBe(initialBalance - debitAmount);
        expect(wallet.totalWithdrawn).toBe(initialWithdrawn + debitAmount);
        expect(wallet.lastTransactionAt).toBeInstanceOf(Date);
      });

      it('should reject debit with insufficient balance', async () => {
        await expect(wallet.debit(1000)).rejects.toThrow('Insufficient balance');
      });

      it('should reject negative debit amount', async () => {
        await expect(wallet.debit(-50)).rejects.toThrow('Debit amount must be positive');
      });

      it('should reject zero debit amount', async () => {
        await expect(wallet.debit(0)).rejects.toThrow('Debit amount must be positive');
      });

      it('should reject debit from inactive wallet', async () => {
        wallet.status = 'suspended';
        await wallet.save();

        await expect(wallet.debit(100)).rejects.toThrow('Cannot debit inactive wallet');
      });

      it('should round debit amount to 2 decimal places', async () => {
        const initialBalance = wallet.balance;
        await wallet.debit(100.999);

        expect(wallet.balance).toBe(initialBalance - 101.00);
        expect(wallet.totalWithdrawn).toBe(101.00);
      });
    });

    describe('Status Management', () => {
      it('should freeze wallet', async () => {
        const reason = 'Suspicious activity detected';
        await wallet.freeze(reason);

        expect(wallet.status).toBe('frozen');
        expect(wallet.freezeReason).toBe(reason);
        expect(wallet.frozenAt).toBeInstanceOf(Date);
      });

      it('should unfreeze wallet', async () => {
        await wallet.freeze('Test freeze');
        await wallet.unfreeze();

        expect(wallet.status).toBe('active');
        expect(wallet.freezeReason).toBeNull();
        expect(wallet.frozenAt).toBeNull();
      });

      it('should suspend wallet', async () => {
        const reason = 'Account violation';
        await wallet.suspend(reason);

        expect(wallet.status).toBe('suspended');
        expect(wallet.freezeReason).toBe(reason);
        expect(wallet.frozenAt).toBeInstanceOf(Date);
      });
    });

    describe('Withdrawal Validation', () => {
      beforeEach(async () => {
        await wallet.credit(1000);
      });

      it('should allow withdrawal with sufficient balance and bank details', () => {
        const result = wallet.canWithdraw(500);

        expect(result.allowed).toBe(true);
      });

      it('should reject withdrawal with insufficient balance', () => {
        const result = wallet.canWithdraw(2000);

        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('Insufficient balance');
      });

      it('should reject withdrawal from inactive wallet', async () => {
        await wallet.freeze('Test');
        const result = wallet.canWithdraw(500);

        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('Wallet is not active');
      });

      it('should reject withdrawal without bank details', async () => {
        wallet.bankDetails = {};
        await wallet.save();
        
        const result = wallet.canWithdraw(500);

        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('Bank details not configured');
      });
    });

    describe('Bank Details Management', () => {
      it('should update bank details', async () => {
        const newBankDetails = {
          accountName: 'Updated Account Name',
          accountNumber: '9876543210',
          bankCode: '044',
          bankName: 'Access Bank',
        };

        await wallet.updateBankDetails(newBankDetails);

        expect(wallet.bankDetails.accountName).toBe(newBankDetails.accountName);
        expect(wallet.bankDetails.accountNumber).toBe(newBankDetails.accountNumber);
        expect(wallet.bankDetails.bankCode).toBe(newBankDetails.bankCode);
        expect(wallet.bankDetails.bankName).toBe(newBankDetails.bankName);
      });

      it('should partially update bank details', async () => {
        const originalAccountName = wallet.bankDetails.accountName;
        
        await wallet.updateBankDetails({
          accountNumber: '9876543210',
        });

        expect(wallet.bankDetails.accountName).toBe(originalAccountName);
        expect(wallet.bankDetails.accountNumber).toBe('9876543210');
      });
    });

    describe('Wallet Summary', () => {
      it('should get wallet summary', async () => {
        await wallet.credit(500);
        await wallet.debit(100);

        const summary = wallet.getSummary();

        expect(summary).toHaveProperty('balance', 400);
        expect(summary).toHaveProperty('totalEarned', 500);
        expect(summary).toHaveProperty('totalWithdrawn', 100);
        expect(summary).toHaveProperty('currency', 'NGN');
        expect(summary).toHaveProperty('status', 'active');
        expect(summary).toHaveProperty('hasBankDetails', true);
        expect(summary).toHaveProperty('lastTransactionAt');
      });

      it('should indicate missing bank details in summary', async () => {
        wallet.bankDetails = {};
        await wallet.save();

        const summary = wallet.getSummary();

        expect(summary.hasBankDetails).toBe(false);
      });
    });
  });

  describe('Static Methods', () => {
    beforeEach(async () => {
      // Create test wallets with different statuses
      const affiliate2 = await Affiliate.create({
        userId: testUser._id,
        businessName: 'Test Business 2',
        businessEmail: 'test2@business.com',
        businessPhone: '+2348012345679',
        businessAddress: {
          street: '456 Street',
          city: 'Abuja',
          state: 'FCT',
          country: 'Nigeria',
        },
      });

      await Wallet.create([
        {
          affiliateId: testAffiliate._id,
          balance: 1000,
          status: 'active',
        },
        {
          affiliateId: affiliate2._id,
          balance: 500,
          status: 'frozen',
        },
      ]);
    });

    it('should find wallets by status', async () => {
      const activeWallets = await Wallet.findByStatus('active');
      const frozenWallets = await Wallet.findByStatus('frozen');

      expect(activeWallets).toHaveLength(1);
      expect(frozenWallets).toHaveLength(1);
      expect(activeWallets[0].status).toBe('active');
      expect(frozenWallets[0].status).toBe('frozen');
    });

    it('should find wallets with balance above threshold', async () => {
      const walletsAbove750 = await Wallet.findWithBalanceAbove(750);
      const walletsAbove250 = await Wallet.findWithBalanceAbove(250);

      expect(walletsAbove750).toHaveLength(1);
      expect(walletsAbove250).toHaveLength(2);
      expect(walletsAbove750[0].balance).toBeGreaterThanOrEqual(750);
    });

    it('should get total system balance', async () => {
      const stats = await Wallet.getTotalSystemBalance();

      expect(stats).toHaveLength(1);
      expect(stats[0].totalBalance).toBe(1500);
      expect(stats[0].totalEarned).toBe(0); // No credits made in this test
      expect(stats[0].totalWithdrawn).toBe(0);
      expect(stats[0].activeWallets).toBe(1);
      expect(stats[0].frozenWallets).toBe(1);
      expect(stats[0].suspendedWallets).toBe(0);
    });
  });

  describe('Validation and Constraints', () => {
    it('should validate currency enum', async () => {
      const wallet = new Wallet({
        affiliateId: testAffiliate._id,
        currency: 'INVALID',
      });

      await expect(wallet.save()).rejects.toThrow('Currency must be one of: NGN, USD, EUR, GBP');
    });

    it('should validate status enum', async () => {
      const wallet = new Wallet({
        affiliateId: testAffiliate._id,
        status: 'invalid_status',
      });

      await expect(wallet.save()).rejects.toThrow('Status must be one of: active, frozen, suspended');
    });

    it('should validate negative balance', async () => {
      const wallet = new Wallet({
        affiliateId: testAffiliate._id,
        balance: -100,
      });

      await expect(wallet.save()).rejects.toThrow('Balance cannot be negative');
    });

    it('should validate negative total earned', async () => {
      const wallet = new Wallet({
        affiliateId: testAffiliate._id,
        totalEarned: -50,
      });

      await expect(wallet.save()).rejects.toThrow('Total earned cannot be negative');
    });

    it('should validate negative total withdrawn', async () => {
      const wallet = new Wallet({
        affiliateId: testAffiliate._id,
        totalWithdrawn: -25,
      });

      await expect(wallet.save()).rejects.toThrow('Total withdrawn cannot be negative');
    });
  });

  describe('Indexes and Performance', () => {
    it('should have proper indexes defined', () => {
      const indexes = Wallet.schema.indexes();
      const indexFields = indexes.map(index => Object.keys(index[0]));
      
      expect(indexFields).toContainEqual(['affiliateId']);
      expect(indexFields).toContainEqual(['status']);
      expect(indexFields).toContainEqual(['balance']);
      expect(indexFields).toContainEqual(['totalEarned']);
    });
  });
});