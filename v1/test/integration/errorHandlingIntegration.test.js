// v1/test/integration/errorHandlingIntegration.test.js
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../../../app');
const errorRecovery = require('../../utils/errorRecovery');
const { 
  AffiliateError, 
  WalletError, 
  CommissionError, 
  WithdrawalError 
} = require('../../utils/affiliateErrors');
const Affiliate = require('../../models/affiliateModel');
const Wallet = require('../../models/walletModel');
const CommissionTransaction = require('../../models/commissionTransactionModel');
const Withdrawal = require('../../models/withdrawalModel');

// Mock external services
jest.mock('../../services/paystackService', () => ({
  transferToBank: jest.fn(),
  verifyBankAccount: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

describe('Error Handling Integration Tests', () => {
  let testAffiliate;
  let testWallet;
  let authToken;

  beforeAll(async () => {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/travel_place_test');
    }
  });

  beforeEach(async () => {
    // Clean up test data
    await Promise.all([
      Affiliate.deleteMany({}),
      Wallet.deleteMany({}),
      CommissionTransaction.deleteMany({}),
      Withdrawal.deleteMany({})
    ]);

    // Create test affiliate and wallet
    testAffiliate = await Affiliate.create({
      userId: new mongoose.Types.ObjectId(),
      businessName: 'Test Business',
      businessEmail: 'test@business.com',
      businessPhone: '+2341234567890',
      businessAddress: {
        street: '123 Test Street',
        city: 'Lagos',
        state: 'Lagos',
        country: 'Nigeria'
      },
      affiliateId: 'AFF-TEST-001',
      referralCode: 'TEST-REF-001',
      status: 'active',
      commissionRates: {
        flights: 2.5,
        hotels: 3.0,
        insurance: 5.0,
        visa: 4.0
      }
    });

    testWallet = await Wallet.create({
      affiliateId: testAffiliate._id,
      balance: 10000,
      totalEarned: 15000,
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

    // Mock authentication token
    authToken = 'mock-jwt-token';

    jest.clearAllMocks();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('Affiliate Registration Error Handling', () => {
    it('should handle duplicate affiliate registration with proper error response', async () => {
      const duplicateData = {
        businessName: 'Test Business',
        businessEmail: 'test@business.com', // Same email as existing affiliate
        businessPhone: '+2341234567891',
        businessAddress: {
          street: '456 Another Street',
          city: 'Abuja',
          state: 'FCT',
          country: 'Nigeria'
        }
      };

      const response = await request(app)
        .post('/api/v1/affiliate/register')
        .set('Authorization', `Bearer ${authToken}`)
        .send(duplicateData)
        .expect(409);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Affiliate Conflict',
        statusCode: 409,
        code: 'AFFILIATE_ERROR',
        suggestions: expect.arrayContaining([
          'Check for duplicate registration attempts',
          'Verify business information is unique',
          'Contact support for account recovery'
        ]),
        correlationId: expect.any(String),
        timestamp: expect.any(String)
      });
    });

    it('should handle validation errors with detailed feedback', async () => {
      const invalidData = {
        businessName: '', // Empty name
        businessEmail: 'invalid-email', // Invalid email format
        businessPhone: '123', // Invalid phone format
        businessAddress: {
          street: '',
          city: '',
          state: '',
          country: ''
        }
      };

      const response = await request(app)
        .post('/api/v1/affiliate/register')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Affiliate Error',
        statusCode: 400,
        validationErrors: expect.any(Array),
        suggestions: expect.arrayContaining([
          'Review and correct the validation errors',
          'Ensure all required fields are provided',
          'Check data format requirements'
        ])
      });

      expect(response.body.validationErrors.length).toBeGreaterThan(0);
    });
  });

  describe('Wallet Operation Error Handling', () => {
    it('should handle insufficient balance error with wallet information', async () => {
      const withdrawalAmount = 15000; // More than available balance (10000)

      const response = await request(app)
        .post('/api/v1/wallet/withdraw')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          affiliateId: testAffiliate.affiliateId,
          amount: withdrawalAmount,
          bankDetails: testWallet.bankDetails
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Wallet Error',
        statusCode: 400,
        walletInfo: {
          requestedAmount: withdrawalAmount,
          availableBalance: testWallet.balance,
          currency: 'NGN'
        },
        suggestions: expect.arrayContaining([
          'Check wallet balance before making transactions'
        ])
      });
    });

    it('should handle concurrent wallet modifications with retry mechanism', async () => {
      // Simulate concurrent credit operations
      const creditAmount = 1000;
      const concurrentOperations = Array(5).fill().map(() =>
        request(app)
          .post('/api/v1/wallet/credit')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            affiliateId: testAffiliate.affiliateId,
            amount: creditAmount,
            transactionRef: `TXN-${Date.now()}-${Math.random()}`
          })
      );

      const responses = await Promise.allSettled(concurrentOperations);
      
      // Some operations should succeed, some might fail with conflict errors
      const successfulOps = responses.filter(r => r.status === 'fulfilled' && r.value.status === 200);
      const conflictOps = responses.filter(r => 
        r.status === 'fulfilled' && 
        r.value.status === 409 &&
        r.value.body.code === 'WALLET_ERROR'
      );

      expect(successfulOps.length).toBeGreaterThan(0);
      
      if (conflictOps.length > 0) {
        expect(conflictOps[0].value.body).toMatchObject({
          success: false,
          error: 'Wallet Error',
          statusCode: 409,
          suggestions: expect.arrayContaining([
            'Avoid concurrent wallet operations',
            'Retry the operation after a short delay'
          ])
        });
      }
    });
  });

  describe('Commission Processing Error Handling', () => {
    it('should handle duplicate commission creation', async () => {
      const bookingReference = 'BOOK-TEST-001';
      
      // Create first commission
      await CommissionTransaction.create({
        affiliateId: testAffiliate._id,
        bookingReference,
        serviceType: 'flights',
        bookingAmount: 50000,
        commissionRate: 2.5,
        commissionAmount: 1250,
        status: 'approved'
      });

      // Attempt to create duplicate commission
      const response = await request(app)
        .post('/api/v1/commission/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          affiliateId: testAffiliate.affiliateId,
          bookingReference,
          serviceType: 'flights',
          bookingAmount: 50000
        })
        .expect(409);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Commission Error',
        statusCode: 409,
        bookingReference,
        suggestions: expect.arrayContaining([
          'Check if commission already exists for this booking',
          'Verify booking reference is correct'
        ])
      });
    });

    it('should handle commission calculation errors with retry', async () => {
      // Mock commission service to fail initially then succeed
      const originalCalculate = require('../../services/commissionService').calculateCommission;
      let attemptCount = 0;
      
      jest.spyOn(require('../../services/commissionService'), 'calculateCommission')
        .mockImplementation(async (...args) => {
          attemptCount++;
          if (attemptCount < 3) {
            throw new Error('Temporary calculation error');
          }
          return originalCalculate.apply(this, args);
        });

      const response = await request(app)
        .post('/api/v1/commission/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          affiliateId: testAffiliate.affiliateId,
          bookingReference: 'BOOK-TEST-002',
          serviceType: 'hotels',
          bookingAmount: 75000
        });

      // Should eventually succeed after retries
      expect(response.status).toBe(200);
      expect(attemptCount).toBeGreaterThan(1); // Confirms retry mechanism worked
    });
  });

  describe('Withdrawal Processing Error Handling', () => {
    it('should handle bank transfer failures with proper rollback', async () => {
      const paystackService = require('../../services/paystackService');
      paystackService.transferToBank.mockRejectedValue(new Error('Bank transfer failed'));

      const withdrawalAmount = 5000;

      const response = await request(app)
        .post('/api/v1/withdrawal/request')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          affiliateId: testAffiliate.affiliateId,
          amount: withdrawalAmount,
          bankDetails: testWallet.bankDetails
        })
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Withdrawal Error',
        statusCode: 500,
        suggestions: expect.arrayContaining([
          'Withdrawal processing will be retried automatically'
        ])
      });

      // Verify wallet balance was not affected due to rollback
      const updatedWallet = await Wallet.findById(testWallet._id);
      expect(updatedWallet.balance).toBe(testWallet.balance);
    });

    it('should handle minimum withdrawal amount validation', async () => {
      const response = await request(app)
        .post('/api/v1/withdrawal/request')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          affiliateId: testAffiliate.affiliateId,
          amount: 500, // Below minimum (assuming 1000 is minimum)
          bankDetails: testWallet.bankDetails
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Withdrawal Error',
        statusCode: 400,
        suggestions: expect.arrayContaining([
          'Ensure withdrawal amount meets minimum requirements'
        ])
      });
    });

    it('should handle pending withdrawal conflicts', async () => {
      // Create pending withdrawal
      await Withdrawal.create({
        affiliateId: testAffiliate._id,
        walletId: testWallet._id,
        amount: 3000,
        currency: 'NGN',
        bankDetails: testWallet.bankDetails,
        status: 'pending'
      });

      // Attempt another withdrawal
      const response = await request(app)
        .post('/api/v1/withdrawal/request')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          affiliateId: testAffiliate.affiliateId,
          amount: 2000,
          bankDetails: testWallet.bankDetails
        })
        .expect(409);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Withdrawal Error',
        statusCode: 409,
        suggestions: expect.arrayContaining([
          'Complete or cancel existing withdrawal request',
          'Wait for current withdrawal to process'
        ])
      });
    });
  });

  describe('Transaction Rollback Mechanisms', () => {
    it('should rollback affiliate registration if wallet creation fails', async () => {
      // Mock wallet service to fail
      jest.spyOn(require('../../services/walletService'), 'createWallet')
        .mockRejectedValue(new Error('Wallet creation failed'));

      const registrationData = {
        businessName: 'Rollback Test Business',
        businessEmail: 'rollback@test.com',
        businessPhone: '+2341234567892',
        businessAddress: {
          street: '789 Rollback Street',
          city: 'Port Harcourt',
          state: 'Rivers',
          country: 'Nigeria'
        }
      };

      const response = await request(app)
        .post('/api/v1/affiliate/register')
        .set('Authorization', `Bearer ${authToken}`)
        .send(registrationData)
        .expect(500);

      // Verify affiliate was not created due to rollback
      const affiliate = await Affiliate.findOne({ businessEmail: 'rollback@test.com' });
      expect(affiliate).toBeNull();

      expect(response.body).toMatchObject({
        success: false,
        error: 'Internal Server Error',
        statusCode: 500
      });
    });

    it('should rollback commission processing if wallet credit fails', async () => {
      // Mock wallet service to fail credit operation
      jest.spyOn(require('../../services/walletService'), 'creditWallet')
        .mockRejectedValue(new Error('Wallet credit failed'));

      const response = await request(app)
        .post('/api/v1/commission/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          affiliateId: testAffiliate.affiliateId,
          bookingReference: 'BOOK-ROLLBACK-001',
          serviceType: 'flights',
          bookingAmount: 40000
        })
        .expect(500);

      // Verify commission was not created or was rolled back
      const commission = await CommissionTransaction.findOne({ 
        bookingReference: 'BOOK-ROLLBACK-001' 
      });
      expect(commission).toBeNull();
    });
  });

  describe('Error Recovery and Retry Mechanisms', () => {
    it('should retry operations on transient failures', async () => {
      let attemptCount = 0;
      const maxAttempts = 3;

      const operation = jest.fn(async () => {
        attemptCount++;
        if (attemptCount < maxAttempts) {
          const error = new Error('Transient failure');
          error.code = 'ECONNRESET';
          throw error;
        }
        return 'success';
      });

      const result = await errorRecovery.executeWithRetry(operation, {
        maxAttempts,
        baseDelay: 10,
        operationName: 'test-retry'
      });

      expect(result).toBe('success');
      expect(attemptCount).toBe(maxAttempts);
    });

    it('should not retry on non-retryable errors', async () => {
      const operation = jest.fn(async () => {
        throw new AffiliateError('Non-retryable error');
      });

      await expect(errorRecovery.executeWithRetry(operation, {
        maxAttempts: 3,
        baseDelay: 10,
        operationName: 'test-no-retry'
      })).rejects.toThrow('Non-retryable error');

      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should execute compensation logic on operation failures', async () => {
      const operation1 = jest.fn().mockResolvedValue('result1');
      const operation2 = jest.fn().mockRejectedValue(new Error('Operation 2 failed'));
      const compensation1 = jest.fn();

      const operations = [
        { operation: operation1, compensation: compensation1, name: 'op1' },
        { operation: operation2, compensation: null, name: 'op2' }
      ];

      await expect(errorRecovery.executeWithCompensation(operations))
        .rejects.toThrow('Operation 2 failed');

      expect(operation1).toHaveBeenCalled();
      expect(operation2).toHaveBeenCalled();
      expect(compensation1).toHaveBeenCalledWith('result1');
    });
  });

  describe('Circuit Breaker Pattern', () => {
    it('should open circuit after failure threshold', async () => {
      const circuitBreaker = errorRecovery.createCircuitBreaker('test-service', {
        failureThreshold: 2,
        resetTimeout: 100
      });

      const failingOperation = jest.fn().mockRejectedValue(new Error('Service unavailable'));

      // First failure
      await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow('Service unavailable');
      expect(circuitBreaker.state).toBe('CLOSED');

      // Second failure - should open circuit
      await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow('Service unavailable');
      expect(circuitBreaker.state).toBe('OPEN');

      // Third attempt should be rejected without calling operation
      const anotherOperation = jest.fn();
      await expect(circuitBreaker.execute(anotherOperation)).rejects.toThrow('Circuit breaker is OPEN');
      expect(anotherOperation).not.toHaveBeenCalled();
    });

    it('should reset circuit after timeout', async () => {
      const circuitBreaker = errorRecovery.createCircuitBreaker('test-service', {
        failureThreshold: 1,
        resetTimeout: 50
      });

      const failingOperation = jest.fn().mockRejectedValue(new Error('Service unavailable'));
      const successOperation = jest.fn().mockResolvedValue('success');

      // Open circuit
      await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow('Service unavailable');
      expect(circuitBreaker.state).toBe('OPEN');

      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 60));

      // Should allow operation and reset to closed
      const result = await circuitBreaker.execute(successOperation);
      expect(result).toBe('success');
      expect(circuitBreaker.state).toBe('CLOSED');
    });
  });

  describe('Batch Operations with Error Isolation', () => {
    it('should isolate errors in batch operations', async () => {
      const operations = [
        jest.fn().mockResolvedValue('success1'),
        jest.fn().mockRejectedValue(new Error('Operation failed')),
        jest.fn().mockResolvedValue('success3')
      ];

      const results = await errorRecovery.batchWithErrorIsolation(operations, {
        operationName: 'test-batch'
      });

      expect(results).toHaveLength(3);
      expect(results[0]).toMatchObject({ success: true, result: 'success1' });
      expect(results[1]).toMatchObject({ success: false, error: expect.any(Error) });
      expect(results[2]).toMatchObject({ success: true, result: 'success3' });
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout long-running operations', async () => {
      const longRunningOperation = () => new Promise(resolve => setTimeout(resolve, 200));

      await expect(errorRecovery.withTimeout(longRunningOperation, 50, 'test-timeout'))
        .rejects.toThrow('test-timeout timed out after 50ms');
    });

    it('should complete operations within timeout', async () => {
      const quickOperation = () => Promise.resolve('completed');

      const result = await errorRecovery.withTimeout(quickOperation, 100, 'test-quick');
      expect(result).toBe('completed');
    });
  });
});