// v1/test/integration/walletIntegration.test.js
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('./testApp');
const User = require('../../models/userModel');
const Affiliate = require('../../models/affiliateModel');
const Wallet = require('../../models/walletModel');
const WalletTransaction = require('../../models/walletTransactionModel');

describe('Wallet Integration Tests', () => {
  let adminUser;
  let adminToken;
  let testUser;
  let testAffiliate;
  let testWallet;

  beforeAll(async () => {
    // Create admin user
    adminUser = await User.create({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@test.com',
      password: 'password123',
      role: 'Admin',
    });

    // Login admin to get token
    const adminLoginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@test.com',
        password: 'password123',
      });

    adminToken = adminLoginResponse.body.data.accessToken;

    // Create test user and affiliate
    testUser = await User.create({
      firstName: 'Test',
      lastName: 'Affiliate',
      email: 'testaffiliate@test.com',
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
      status: 'active',
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
    // Clean up wallets and transactions before each test
    await Wallet.deleteMany({});
    await WalletTransaction.deleteMany({});
  });

  describe('POST /api/v1/wallets', () => {
    it('should create a new wallet successfully', async () => {
      const walletData = {
        affiliateId: testAffiliate._id,
        currency: 'NGN',
        bankDetails: {
          accountName: 'Test Business Account',
          accountNumber: '1234567890',
          bankCode: '058',
          bankName: 'Guaranty Trust Bank',
        },
      };

      const response = await request(app)
        .post('/api/v1/wallets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(walletData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.balance).toBe(0);
      expect(response.body.data.currency).toBe('NGN');
      expect(response.body.data.status).toBe('active');

      // Verify wallet was created in database
      const wallet = await Wallet.findOne({ affiliateId: testAffiliate._id });
      expect(wallet).toBeTruthy();
      expect(wallet.bankDetails.accountName).toBe(walletData.bankDetails.accountName);
    });

    it('should return error for duplicate wallet', async () => {
      // Create wallet first
      await Wallet.create({
        affiliateId: testAffiliate._id,
      });

      const walletData = {
        affiliateId: testAffiliate._id,
      };

      const response = await request(app)
        .post('/api/v1/wallets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(walletData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });
  });

  describe('GET /api/v1/wallets/:affiliateId/balance', () => {
    beforeEach(async () => {
      testWallet = await Wallet.create({
        affiliateId: testAffiliate._id,
        balance: 1000,
        totalEarned: 5000,
        totalWithdrawn: 4000,
        bankDetails: {
          accountName: 'Test Account',
          accountNumber: '1234567890',
          bankCode: '058',
          bankName: 'Test Bank',
        },
      });
    });

    it('should get wallet balance successfully', async () => {
      const response = await request(app)
        .get(`/api/v1/wallets/${testAffiliate._id}/balance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.balance).toBe(1000);
      expect(response.body.data.totalEarned).toBe(5000);
      expect(response.body.data.totalWithdrawn).toBe(4000);
      expect(response.body.data.hasBankDetails).toBe(true);
    });

    it('should return error for non-existent wallet', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .get(`/api/v1/wallets/${nonExistentId}/balance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });
  });

  describe('POST /api/v1/wallets/:affiliateId/credit', () => {
    beforeEach(async () => {
      testWallet = await Wallet.create({
        affiliateId: testAffiliate._id,
        balance: 500,
      });
    });

    it('should credit wallet successfully', async () => {
      const creditData = {
        amount: 100.50,
        transactionRef: 'TXN_CREDIT_123',
        description: 'Commission earned from booking',
        type: 'commission_credit',
      };

      const response = await request(app)
        .post(`/api/v1/wallets/${testAffiliate._id}/credit`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(creditData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.wallet.balance).toBe(600.50);
      expect(response.body.data.transaction.amount).toBe(100.50);
      expect(response.body.data.transaction.type).toBe('commission_credit');

      // Verify transaction was created
      const transaction = await WalletTransaction.findOne({
        reference: 'TXN_CREDIT_123',
      });
      expect(transaction).toBeTruthy();
      expect(transaction.balanceBefore).toBe(500);
      expect(transaction.balanceAfter).toBe(600.50);
    });

    it('should return error for duplicate transaction reference', async () => {
      // Create transaction first
      await WalletTransaction.create({
        walletId: testWallet._id,
        affiliateId: testAffiliate._id,
        type: 'commission_credit',
        amount: 50,
        balanceBefore: 500,
        balanceAfter: 550,
        description: 'Test transaction',
        reference: 'TXN_DUPLICATE',
      });

      const creditData = {
        amount: 100,
        transactionRef: 'TXN_DUPLICATE',
        description: 'Duplicate transaction',
      };

      const response = await request(app)
        .post(`/api/v1/wallets/${testAffiliate._id}/credit`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(creditData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });
  });

  describe('POST /api/v1/wallets/:affiliateId/debit', () => {
    beforeEach(async () => {
      testWallet = await Wallet.create({
        affiliateId: testAffiliate._id,
        balance: 1000,
      });
    });

    it('should debit wallet successfully', async () => {
      const debitData = {
        amount: 200.75,
        transactionRef: 'TXN_DEBIT_123',
        description: 'Withdrawal processed',
        type: 'withdrawal_debit',
      };

      const response = await request(app)
        .post(`/api/v1/wallets/${testAffiliate._id}/debit`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(debitData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.wallet.balance).toBe(799.25);
      expect(response.body.data.transaction.amount).toBe(200.75);
      expect(response.body.data.transaction.type).toBe('withdrawal_debit');

      // Verify transaction was created
      const transaction = await WalletTransaction.findOne({
        reference: 'TXN_DEBIT_123',
      });
      expect(transaction).toBeTruthy();
      expect(transaction.balanceBefore).toBe(1000);
      expect(transaction.balanceAfter).toBe(799.25);
    });

    it('should return error for insufficient balance', async () => {
      const debitData = {
        amount: 2000, // More than available balance
        transactionRef: 'TXN_INSUFFICIENT',
        description: 'Large withdrawal',
      };

      const response = await request(app)
        .post(`/api/v1/wallets/${testAffiliate._id}/debit`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(debitData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Insufficient');
    });
  });

  describe('GET /api/v1/wallets/:affiliateId/transactions', () => {
    beforeEach(async () => {
      testWallet = await Wallet.create({
        affiliateId: testAffiliate._id,
        balance: 1000,
      });

      // Create test transactions
      await WalletTransaction.create([
        {
          walletId: testWallet._id,
          affiliateId: testAffiliate._id,
          type: 'commission_credit',
          amount: 100,
          balanceBefore: 0,
          balanceAfter: 100,
          description: 'Commission 1',
          reference: 'TXN_001',
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
        },
      ]);
    });

    it('should get transaction history with pagination', async () => {
      const response = await request(app)
        .get(`/api/v1/wallets/${testAffiliate._id}/transactions`)
        .query({ page: 1, limit: 2 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.transactions).toHaveLength(2);
      expect(response.body.data.pagination.currentPage).toBe(1);
      expect(response.body.data.pagination.totalCount).toBe(3);
      expect(response.body.data.pagination.totalPages).toBe(2);
    });

    it('should filter transactions by type', async () => {
      const response = await request(app)
        .get(`/api/v1/wallets/${testAffiliate._id}/transactions`)
        .query({ type: 'commission_credit' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.transactions).toHaveLength(2);
      response.body.data.transactions.forEach(tx => {
        expect(tx.type).toBe('commission_credit');
      });
    });
  });

  describe('POST /api/v1/wallets/:affiliateId/freeze', () => {
    beforeEach(async () => {
      testWallet = await Wallet.create({
        affiliateId: testAffiliate._id,
        balance: 1000,
        status: 'active',
      });
    });

    it('should freeze wallet successfully', async () => {
      const freezeData = {
        reason: 'Suspicious activity detected',
      };

      const response = await request(app)
        .post(`/api/v1/wallets/${testAffiliate._id}/freeze`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(freezeData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('frozen');

      // Verify wallet was frozen in database
      const wallet = await Wallet.findById(testWallet._id);
      expect(wallet.status).toBe('frozen');
      expect(wallet.freezeReason).toBe('Suspicious activity detected');
      expect(wallet.frozenAt).toBeTruthy();
    });
  });

  describe('PUT /api/v1/wallets/:affiliateId/bank-details', () => {
    beforeEach(async () => {
      testWallet = await Wallet.create({
        affiliateId: testAffiliate._id,
        balance: 1000,
      });
    });

    it('should update bank details successfully', async () => {
      const bankDetails = {
        accountName: 'Updated Account Name',
        accountNumber: '9876543210',
        bankCode: '044',
        bankName: 'Access Bank',
      };

      const response = await request(app)
        .put(`/api/v1/wallets/${testAffiliate._id}/bank-details`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(bankDetails)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify bank details were updated in database
      const wallet = await Wallet.findById(testWallet._id);
      expect(wallet.bankDetails.accountName).toBe('Updated Account Name');
      expect(wallet.bankDetails.accountNumber).toBe('9876543210');
      expect(wallet.bankDetails.bankCode).toBe('044');
      expect(wallet.bankDetails.bankName).toBe('Access Bank');
    });
  });

  describe('GET /api/v1/wallets/:affiliateId/validate', () => {
    beforeEach(async () => {
      testWallet = await Wallet.create({
        affiliateId: testAffiliate._id,
        balance: 1000,
        status: 'active',
        bankDetails: {
          accountName: 'Test Account',
          accountNumber: '1234567890',
          bankCode: '058',
          bankName: 'Test Bank',
        },
      });
    });

    it('should validate wallet for credit operation', async () => {
      const response = await request(app)
        .get(`/api/v1/wallets/${testAffiliate._id}/validate`)
        .query({ operation: 'credit' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.valid).toBe(true);
    });

    it('should validate wallet for withdrawal with sufficient balance', async () => {
      const response = await request(app)
        .get(`/api/v1/wallets/${testAffiliate._id}/validate`)
        .query({ operation: 'withdraw', amount: 500 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.valid).toBe(true);
    });

    it('should return invalid for withdrawal with insufficient balance', async () => {
      const response = await request(app)
        .get(`/api/v1/wallets/${testAffiliate._id}/validate`)
        .query({ operation: 'withdraw', amount: 2000 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.valid).toBe(false);
      expect(response.body.data.reason).toContain('Insufficient');
    });
  });

  describe('Authentication and Authorization', () => {
    beforeEach(async () => {
      testWallet = await Wallet.create({
        affiliateId: testAffiliate._id,
        balance: 1000,
      });
    });

    it('should require authentication for wallet operations', async () => {
      const response = await request(app)
        .get(`/api/v1/wallets/${testAffiliate._id}/balance`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('token');
    });

    it('should require admin role for wallet creation', async () => {
      // Login as regular user
      const userLoginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'testaffiliate@test.com',
          password: 'password123',
        });

      const userToken = userLoginResponse.body.data.accessToken;

      const response = await request(app)
        .post('/api/v1/wallets')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ affiliateId: testAffiliate._id })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Forbidden');
    });
  });

  describe('Input Validation', () => {
    it('should validate affiliate ID format', async () => {
      const response = await request(app)
        .get('/api/v1/wallets/invalid-id/balance')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({
          msg: 'Valid affiliate ID is required',
        })
      );
    });

    it('should validate credit amount', async () => {
      const response = await request(app)
        .post(`/api/v1/wallets/${testAffiliate._id}/credit`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: -100, // Invalid negative amount
          transactionRef: 'TXN_INVALID',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({
          msg: 'Amount must be greater than 0',
        })
      );
    });

    it('should validate bank details format', async () => {
      const response = await request(app)
        .put(`/api/v1/wallets/${testAffiliate._id}/bank-details`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          accountNumber: '123', // Invalid: not 10 digits
          bankCode: '12', // Invalid: not 3 digits
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({
          msg: 'Account number must be exactly 10 digits',
        })
      );
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({
          msg: 'Bank code must be exactly 3 digits',
        })
      );
    });
  });
});