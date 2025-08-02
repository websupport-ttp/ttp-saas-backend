// v1/test/comprehensive/affiliateJourney.e2e.test.js
// End-to-end tests for complete affiliate journey (registration to withdrawal)

const request = require('supertest');
const { StatusCodes } = require('http-status-codes');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const app = require('../../../app');

// Models
const User = require('../../models/userModel');
const Affiliate = require('../../models/affiliateModel');
const Wallet = require('../../models/walletModel');
const CommissionTransaction = require('../../models/commissionTransactionModel');
const Referral = require('../../models/referralModel');
const Withdrawal = require('../../models/withdrawalModel');

// Test utilities
const { createTestUserWithAuth } = require('../helpers/testHelper');
const { createTestClient } = require('../utils/testHelpers');

describe('Affiliate Journey E2E Tests', () => {
  let mongoServer;
  let testClient;
  let adminUser;
  let customerUser;
  let affiliateUser;
  let adminToken;
  let customerToken;
  let affiliateToken;

  beforeAll(async () => {
    // Start MongoDB Memory Server
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    // Connect to test database
    await mongoose.connect(mongoUri);
    
    // Create test client
    testClient = createTestClient(app, { 
      suiteName: 'affiliate-journey-e2e',
      timeout: 30000 
    });

    // Create test users
    const adminAuth = createTestUserWithAuth({
      role: 'Admin',
      email: 'admin@travelplace.com',
      firstName: 'Admin',
      lastName: 'User'
    });
    
    const customerAuth = createTestUserWithAuth({
      role: 'User',
      email: 'customer@example.com',
      firstName: 'Customer',
      lastName: 'User'
    });
    
    const affiliateAuth = createTestUserWithAuth({
      role: 'User',
      email: 'affiliate@business.com',
      firstName: 'Affiliate',
      lastName: 'Business'
    });

    // Save users to database
    adminUser = await User.create(adminAuth.user);
    customerUser = await User.create(customerAuth.user);
    affiliateUser = await User.create(affiliateAuth.user);

    adminToken = adminAuth.accessToken;
    customerToken = customerAuth.accessToken;
    affiliateToken = affiliateAuth.accessToken;
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
    testClient.cleanup();
  });

  describe('Complete Affiliate Journey', () => {
    let affiliateId;
    let walletId;
    let referralCode;
    let bookingReference;
    let commissionId;
    let withdrawalId;

    test('1. Affiliate Registration', async () => {
      const registrationData = {
        businessName: 'Travel Partners Ltd',
        businessEmail: 'contact@travelpartners.com',
        businessPhone: '+2348123456789',
        businessAddress: {
          street: '123 Business Street',
          city: 'Lagos',
          state: 'Lagos',
          country: 'Nigeria',
          postalCode: '100001'
        }
      };

      const response = await testClient
        .post('/api/v1/affiliates/register', registrationData, {
          headers: { Authorization: `Bearer ${affiliateToken}` }
        });

      expect(response.status).toBe(StatusCodes.CREATED);
      expect(response.body.status).toBe('success');
      expect(response.body.data.affiliate).toBeDefined();
      expect(response.body.data.affiliate.status).toBe('pending');
      expect(response.body.data.affiliate.affiliateId).toBeDefined();
      expect(response.body.data.affiliate.qrCode).toBeDefined();

      affiliateId = response.body.data.affiliate._id;
      
      // Verify affiliate was created in database
      const affiliate = await Affiliate.findById(affiliateId);
      expect(affiliate).toBeTruthy();
      expect(affiliate.businessName).toBe(registrationData.businessName);
    });

    test('2. Admin Approves Affiliate', async () => {
      const response = await testClient
        .put(`/api/v1/affiliates/${affiliateId}/approve`, {}, {
          headers: { Authorization: `Bearer ${adminToken}` }
        });

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.status).toBe('success');
      expect(response.body.data.affiliate.status).toBe('active');
      expect(response.body.data.affiliate.referralCode).toBeDefined();

      referralCode = response.body.data.affiliate.referralCode;

      // Verify wallet was created
      const wallet = await Wallet.findOne({ affiliateId });
      expect(wallet).toBeTruthy();
      expect(wallet.balance).toBe(0);
      walletId = wallet._id;
    });

    test('3. Customer Uses Referral Code for Booking', async () => {
      const bookingData = {
        serviceType: 'flight',
        amount: 150000, // 1500 NGN
        customerDetails: {
          firstName: customerUser.firstName,
          lastName: customerUser.lastName,
          email: customerUser.email,
          phoneNumber: customerUser.phoneNumber
        },
        referralCode: referralCode,
        bookingDetails: {
          departure: 'LOS',
          destination: 'ABV',
          departureDate: '2024-12-01',
          passengers: 1
        }
      };

      const response = await testClient
        .post('/api/v1/products/flight/book', bookingData, {
          headers: { Authorization: `Bearer ${customerToken}` }
        });

      expect(response.status).toBe(StatusCodes.CREATED);
      expect(response.body.status).toBe('success');
      expect(response.body.data.booking).toBeDefined();
      expect(response.body.data.referralTracked).toBe(true);

      bookingReference = response.body.data.booking.reference;

      // Verify referral was tracked
      const referral = await Referral.findOne({ 
        affiliateId, 
        customerId: customerUser._id 
      });
      expect(referral).toBeTruthy();
      expect(referral.referralCode).toBe(referralCode);
    });

    test('4. Commission is Calculated and Credited', async () => {
      // Wait for commission processing (simulated async processing)
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check commission transaction was created
      const commission = await CommissionTransaction.findOne({ 
        bookingReference 
      });
      expect(commission).toBeTruthy();
      expect(commission.affiliateId.toString()).toBe(affiliateId);
      expect(commission.serviceType).toBe('flight');
      expect(commission.bookingAmount).toBe(150000);
      expect(commission.commissionAmount).toBeGreaterThan(0);
      expect(commission.status).toBe('approved');

      commissionId = commission._id;

      // Check wallet was credited
      const wallet = await Wallet.findById(walletId);
      expect(wallet.balance).toBe(commission.commissionAmount);
      expect(wallet.totalEarned).toBe(commission.commissionAmount);
    });

    test('5. Affiliate Views Dashboard', async () => {
      const response = await testClient
        .get('/api/v1/affiliates/dashboard', {
          headers: { Authorization: `Bearer ${affiliateToken}` }
        });

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.status).toBe('success');
      expect(response.body.data.stats).toBeDefined();
      expect(response.body.data.stats.totalReferrals).toBe(1);
      expect(response.body.data.stats.totalCommissions).toBeGreaterThan(0);
      expect(response.body.data.stats.walletBalance).toBeGreaterThan(0);
      expect(response.body.data.recentCommissions).toHaveLength(1);
    });

    test('6. Affiliate Requests Withdrawal', async () => {
      const wallet = await Wallet.findById(walletId);
      const withdrawalAmount = Math.floor(wallet.balance * 0.8); // Withdraw 80% of balance

      const withdrawalData = {
        amount: withdrawalAmount,
        bankDetails: {
          accountName: 'Travel Partners Ltd',
          accountNumber: '0123456789',
          bankCode: '044',
          bankName: 'Access Bank'
        }
      };

      const response = await testClient
        .post('/api/v1/affiliates/withdrawals', withdrawalData, {
          headers: { Authorization: `Bearer ${affiliateToken}` }
        });

      expect(response.status).toBe(StatusCodes.CREATED);
      expect(response.body.status).toBe('success');
      expect(response.body.data.withdrawal).toBeDefined();
      expect(response.body.data.withdrawal.amount).toBe(withdrawalAmount);
      expect(response.body.data.withdrawal.status).toBe('pending');
      expect(response.body.data.withdrawal.qrCode).toBeDefined();

      withdrawalId = response.body.data.withdrawal._id;

      // Verify wallet balance was debited
      const updatedWallet = await Wallet.findById(walletId);
      expect(updatedWallet.balance).toBe(wallet.balance - withdrawalAmount);
    });

    test('7. Admin Processes Withdrawal', async () => {
      const response = await testClient
        .put(`/api/v1/admin/withdrawals/${withdrawalId}/process`, {}, {
          headers: { Authorization: `Bearer ${adminToken}` }
        });

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.status).toBe('success');
      expect(response.body.data.withdrawal.status).toBe('completed');
      expect(response.body.data.withdrawal.processedAt).toBeDefined();

      // Verify withdrawal status in database
      const withdrawal = await Withdrawal.findById(withdrawalId);
      expect(withdrawal.status).toBe('completed');
      expect(withdrawal.processedAt).toBeDefined();
    });

    test('8. Affiliate Views Transaction History', async () => {
      const response = await testClient
        .get('/api/v1/affiliates/transactions', {
          headers: { Authorization: `Bearer ${affiliateToken}` }
        });

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.status).toBe('success');
      expect(response.body.data.transactions).toBeDefined();
      expect(response.body.data.transactions.length).toBeGreaterThan(0);
      
      // Should have commission credit and withdrawal debit
      const transactions = response.body.data.transactions;
      const commissionTransaction = transactions.find(t => t.type === 'commission_credit');
      const withdrawalTransaction = transactions.find(t => t.type === 'withdrawal_debit');
      
      expect(commissionTransaction).toBeDefined();
      expect(withdrawalTransaction).toBeDefined();
    });

    test('9. Generate Monthly Statement', async () => {
      const response = await testClient
        .get('/api/v1/affiliates/statements/monthly', {
          headers: { Authorization: `Bearer ${affiliateToken}` },
          query: { 
            month: new Date().getMonth() + 1,
            year: new Date().getFullYear()
          }
        });

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.status).toBe('success');
      expect(response.body.data.statement).toBeDefined();
      expect(response.body.data.statement.totalCommissions).toBeGreaterThan(0);
      expect(response.body.data.statement.totalWithdrawals).toBeGreaterThan(0);
      expect(response.body.data.statement.commissionTransactions).toHaveLength(1);
      expect(response.body.data.statement.withdrawals).toHaveLength(1);
    });

    test('10. QR Code Functionality', async () => {
      // Test affiliate QR code
      const qrResponse = await testClient
        .get(`/api/v1/affiliates/qr-code`, {
          headers: { Authorization: `Bearer ${affiliateToken}` }
        });

      expect(qrResponse.status).toBe(StatusCodes.OK);
      expect(qrResponse.body.status).toBe('success');
      expect(qrResponse.body.data.qrCode).toBeDefined();
      expect(qrResponse.body.data.qrCode.data).toBeDefined();
      expect(qrResponse.body.data.qrCode.url).toBeDefined();

      // Test QR code validation
      const qrData = qrResponse.body.data.qrCode.metadata;
      const validateResponse = await testClient
        .post('/api/v1/qr-codes/validate', { qrData });

      expect(validateResponse.status).toBe(StatusCodes.OK);
      expect(validateResponse.body.status).toBe('success');
      expect(validateResponse.body.data.valid).toBe(true);
      expect(validateResponse.body.data.type).toBe('affiliate');
    });
  });

  describe('Error Scenarios and Edge Cases', () => {
    test('Duplicate affiliate registration should fail', async () => {
      const registrationData = {
        businessName: 'Another Business',
        businessEmail: 'another@business.com',
        businessPhone: '+2348123456790',
        businessAddress: {
          street: '456 Another Street',
          city: 'Abuja',
          state: 'FCT',
          country: 'Nigeria',
          postalCode: '900001'
        }
      };

      const response = await testClient
        .post('/api/v1/affiliates/register', registrationData, {
          headers: { Authorization: `Bearer ${affiliateToken}` }
        });

      expect(response.status).toBe(StatusCodes.CONFLICT);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('already registered');
    });

    test('Invalid referral code should not prevent booking', async () => {
      const bookingData = {
        serviceType: 'hotel',
        amount: 80000,
        customerDetails: {
          firstName: customerUser.firstName,
          lastName: customerUser.lastName,
          email: customerUser.email,
          phoneNumber: customerUser.phoneNumber
        },
        referralCode: 'INVALID-CODE-123',
        bookingDetails: {
          hotelId: 'hotel-123',
          checkIn: '2024-12-01',
          checkOut: '2024-12-03',
          rooms: 1
        }
      };

      const response = await testClient
        .post('/api/v1/products/hotel/book', bookingData, {
          headers: { Authorization: `Bearer ${customerToken}` }
        });

      expect(response.status).toBe(StatusCodes.CREATED);
      expect(response.body.status).toBe('success');
      expect(response.body.data.referralTracked).toBe(false);
      expect(response.body.data.referralError).toContain('Invalid referral code');
    });

    test('Insufficient wallet balance should prevent withdrawal', async () => {
      const wallet = await Wallet.findOne({ affiliateId });
      const excessiveAmount = wallet.balance + 10000;

      const withdrawalData = {
        amount: excessiveAmount,
        bankDetails: {
          accountName: 'Travel Partners Ltd',
          accountNumber: '0123456789',
          bankCode: '044',
          bankName: 'Access Bank'
        }
      };

      const response = await testClient
        .post('/api/v1/affiliates/withdrawals', withdrawalData, {
          headers: { Authorization: `Bearer ${affiliateToken}` }
        });

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('Insufficient balance');
    });

    test('Suspended affiliate should not earn commissions', async () => {
      // Suspend the affiliate
      await testClient
        .put(`/api/v1/affiliates/${affiliateId}/suspend`, {
          reason: 'Test suspension'
        }, {
          headers: { Authorization: `Bearer ${adminToken}` }
        });

      // Try to make a booking with referral code
      const bookingData = {
        serviceType: 'insurance',
        amount: 25000,
        customerDetails: {
          firstName: customerUser.firstName,
          lastName: customerUser.lastName,
          email: customerUser.email,
          phoneNumber: customerUser.phoneNumber
        },
        referralCode: referralCode,
        bookingDetails: {
          policyType: 'travel',
          coverage: 'comprehensive',
          duration: 30
        }
      };

      const response = await testClient
        .post('/api/v1/products/insurance/book', bookingData, {
          headers: { Authorization: `Bearer ${customerToken}` }
        });

      expect(response.status).toBe(StatusCodes.CREATED);
      expect(response.body.status).toBe('success');
      expect(response.body.data.referralTracked).toBe(false);
      expect(response.body.data.referralError).toContain('suspended');
    });
  });

  describe('Performance and Scalability', () => {
    test('Multiple concurrent bookings with same referral code', async () => {
      // Reactivate affiliate for this test
      await testClient
        .put(`/api/v1/affiliates/${affiliateId}/reactivate`, {}, {
          headers: { Authorization: `Bearer ${adminToken}` }
        });

      const bookingPromises = [];
      const numberOfBookings = 5;

      for (let i = 0; i < numberOfBookings; i++) {
        const bookingData = {
          serviceType: 'flight',
          amount: 100000 + (i * 10000),
          customerDetails: {
            firstName: `Customer${i}`,
            lastName: 'Test',
            email: `customer${i}@example.com`,
            phoneNumber: `+23481234567${i}`
          },
          referralCode: referralCode,
          bookingDetails: {
            departure: 'LOS',
            destination: 'ABV',
            departureDate: '2024-12-15',
            passengers: 1
          }
        };

        bookingPromises.push(
          testClient.post('/api/v1/products/flight/book', bookingData, {
            headers: { Authorization: `Bearer ${customerToken}` }
          })
        );
      }

      const responses = await Promise.all(bookingPromises);

      // All bookings should succeed
      responses.forEach(response => {
        expect(response.status).toBe(StatusCodes.CREATED);
        expect(response.body.status).toBe('success');
        expect(response.body.data.referralTracked).toBe(true);
      });

      // Wait for commission processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check that all commissions were processed
      const commissions = await CommissionTransaction.find({ affiliateId });
      expect(commissions.length).toBeGreaterThanOrEqual(numberOfBookings);
    });

    test('Large withdrawal processing', async () => {
      const wallet = await Wallet.findOne({ affiliateId });
      const largeAmount = Math.floor(wallet.balance * 0.9);

      const startTime = Date.now();

      const response = await testClient
        .post('/api/v1/affiliates/withdrawals', {
          amount: largeAmount,
          bankDetails: {
            accountName: 'Travel Partners Ltd',
            accountNumber: '0123456789',
            bankCode: '044',
            bankName: 'Access Bank'
          }
        }, {
          headers: { Authorization: `Bearer ${affiliateToken}` }
        });

      const processingTime = Date.now() - startTime;

      expect(response.status).toBe(StatusCodes.CREATED);
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});