// v1/test/integration/bookingIntegration.test.js
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../../app');
const User = require('../../models/userModel');
const Affiliate = require('../../models/affiliateModel');
const Wallet = require('../../models/walletModel');
const Referral = require('../../models/referralModel');
const CommissionTransaction = require('../../models/commissionTransactionModel');
const Ledger = require('../../models/ledgerModel');
const { generateToken } = require('../../utils/jwtUtils');
const { connectTestDB, clearTestDB, closeTestDB } = require('../testSetup');

describe('Booking Integration with Affiliate System', () => {
  let testUser;
  let testAffiliate;
  let testWallet;
  let userToken;
  let affiliateUser;
  let affiliateToken;

  beforeAll(async () => {
    await connectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();

    // Create test user
    testUser = await User.create({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phoneNumber: '+2348012345678',
      password: 'Password123!',
      role: 'User',
      isEmailVerified: true,
      isPhoneVerified: true
    });

    userToken = generateToken(testUser._id);

    // Create affiliate user
    affiliateUser = await User.create({
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@example.com',
      phoneNumber: '+2348087654321',
      password: 'Password123!',
      role: 'Business',
      isEmailVerified: true,
      isPhoneVerified: true
    });

    affiliateToken = generateToken(affiliateUser._id);

    // Create test affiliate
    testAffiliate = await Affiliate.create({
      userId: affiliateUser._id,
      businessName: 'Test Travel Agency',
      businessEmail: 'business@testagency.com',
      businessPhone: '+2348087654321',
      businessAddress: {
        street: '123 Business St',
        city: 'Lagos',
        state: 'Lagos',
        country: 'Nigeria',
        postalCode: '100001'
      },
      affiliateId: 'AFF-001234',
      referralCode: 'TRAVEL-TEST-123',
      status: 'active',
      commissionRates: {
        flights: 2.5,
        hotels: 3.0,
        insurance: 5.0,
        visa: 4.0
      }
    });

    // Create wallet for affiliate
    testWallet = await Wallet.create({
      affiliateId: testAffiliate._id,
      balance: 0,
      totalEarned: 0,
      totalWithdrawn: 0,
      currency: 'NGN',
      status: 'active',
      bankDetails: {
        accountName: 'Test Travel Agency',
        accountNumber: '1234567890',
        bankCode: '044',
        bankName: 'Access Bank'
      }
    });
  });

  afterAll(async () => {
    await closeTestDB();
  });

  describe('Flight Booking with Referral Code', () => {
    it('should successfully book flight with valid referral code', async () => {
      const bookingData = {
        flightDetails: {
          id: 'FL123',
          price: 500000
        },
        passengerDetails: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          phoneNumber: '+2348012345678'
        },
        referralCode: 'TRAVEL-TEST-123'
      };

      const response = await request(app)
        .post('/api/v1/products/flights/book')
        .set('Authorization', `Bearer ${userToken}`)
        .send(bookingData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.authorizationUrl).toBeDefined();
      expect(response.body.data.reference).toBeDefined();
      expect(response.body.data.referralInfo).toBeDefined();
      expect(response.body.data.referralInfo.referralCode).toBe('TRAVEL-TEST-123');
      expect(response.body.data.referralInfo.tracked).toBe(true);

      // Verify referral was created
      const referral = await Referral.findOne({
        affiliateId: testAffiliate._id,
        customerId: testUser._id
      });
      expect(referral).toBeTruthy();
      expect(referral.referralCode).toBe('TRAVEL-TEST-123');

      // Verify ledger entry has referral code
      const ledgerEntry = await Ledger.findOne({
        transactionReference: response.body.data.reference
      });
      expect(ledgerEntry).toBeTruthy();
      expect(ledgerEntry.referralCode).toBe('TRAVEL-TEST-123');
    });

    it('should book flight without referral code', async () => {
      const bookingData = {
        flightDetails: {
          id: 'FL123',
          price: 500000
        },
        passengerDetails: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          phoneNumber: '+2348012345678'
        }
      };

      const response = await request(app)
        .post('/api/v1/products/flights/book')
        .set('Authorization', `Bearer ${userToken}`)
        .send(bookingData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.authorizationUrl).toBeDefined();
      expect(response.body.data.referralInfo).toBeUndefined();

      // Verify no referral was created
      const referral = await Referral.findOne({
        customerId: testUser._id
      });
      expect(referral).toBeFalsy();
    });

    it('should handle invalid referral code gracefully', async () => {
      const bookingData = {
        flightDetails: {
          id: 'FL123',
          price: 500000
        },
        passengerDetails: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          phoneNumber: '+2348012345678'
        },
        referralCode: 'INVALID-CODE'
      };

      const response = await request(app)
        .post('/api/v1/products/flights/book')
        .set('Authorization', `Bearer ${userToken}`)
        .send(bookingData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.authorizationUrl).toBeDefined();
      // Booking should still proceed even with invalid referral code
    });
  });

  describe('Hotel Booking with Referral Code', () => {
    it('should successfully book hotel with valid referral code', async () => {
      const bookingData = {
        hotelDetails: {
          id: 'HTL001',
          price: 150000
        },
        guestDetails: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          phoneNumber: '+2348012345678'
        },
        referralCode: 'TRAVEL-TEST-123'
      };

      const response = await request(app)
        .post('/api/v1/products/hotels/book')
        .set('Authorization', `Bearer ${userToken}`)
        .send(bookingData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.authorizationUrl).toBeDefined();
      expect(response.body.data.referralInfo).toBeDefined();
      expect(response.body.data.referralInfo.referralCode).toBe('TRAVEL-TEST-123');

      // Verify referral was created
      const referral = await Referral.findOne({
        affiliateId: testAffiliate._id,
        customerId: testUser._id
      });
      expect(referral).toBeTruthy();
    });
  });

  describe('Travel Insurance Purchase with Referral Code', () => {
    it('should successfully purchase insurance with valid referral code', async () => {
      const purchaseData = {
        quoteId: 700,
        customerDetails: {
          Surname: 'Doe',
          FirstName: 'John',
          GenderId: 1,
          TitleId: 2,
          DateOfBirth: '01-Jan-1990',
          Email: 'john.doe@example.com',
          Telephone: '+2348012345678',
          StateId: 25,
          Address: '123 Test Street, Lagos',
          ZipCode: '100001',
          Nationality: 'Nigeria',
          PassportNo: 'A12345678',
          Occupation: 'Software Developer',
          MaritalStatusId: 1,
          PreExistingMedicalCondition: false,
          NextOfKin: {
            FullName: 'Jane Doe',
            Address: '123 Test Street, Lagos',
            Relationship: 'Spouse',
            Telephone: '+2348087654321'
          }
        },
        referralCode: 'TRAVEL-TEST-123'
      };

      const response = await request(app)
        .post('/api/v1/products/travel-insurance/purchase/individual')
        .set('Authorization', `Bearer ${userToken}`)
        .send(purchaseData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.authorizationUrl).toBeDefined();
      expect(response.body.data.referralInfo).toBeDefined();
    });
  });

  describe('Package Purchase with Referral Code', () => {
    let testPackage;

    beforeEach(async () => {
      // Create a test package (Post model)
      const Post = require('../../models/postModel');
      testPackage = await Post.create({
        title: 'Test Travel Package',
        slug: 'test-travel-package',
        content: 'A wonderful travel package for testing',
        excerpt: 'Test package excerpt',
        author: testUser._id,
        postType: 'Packages',
        status: 'Published',
        isActive: true,
        price: 250000,
        currency: 'NGN',
        metadata: {
          duration: '7 days',
          location: 'Dubai',
          difficulty: 'Easy',
          maxParticipants: 20
        },
        availability: {
          startDate: new Date(Date.now() - 86400000), // Yesterday
          endDate: new Date(Date.now() + 86400000 * 30), // 30 days from now
          isAvailable: true
        }
      });
    });

    it('should successfully purchase package with valid referral code', async () => {
      const purchaseData = {
        customerDetails: {
          email: 'john.doe@example.com',
          phoneNumber: '+2348012345678',
          firstName: 'John',
          lastName: 'Doe'
        },
        participants: 2,
        specialRequests: 'Vegetarian meals please',
        referralCode: 'TRAVEL-TEST-123'
      };

      const response = await request(app)
        .post(`/api/v1/products/packages/${testPackage._id}/purchase`)
        .send(purchaseData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.authorizationUrl).toBeDefined();
      expect(response.body.data.referralInfo).toBeDefined();
    });
  });

  describe('Visa Application with Referral Code', () => {
    it('should successfully apply for visa with valid referral code', async () => {
      const applicationData = {
        destinationCountry: 'United States',
        visaType: 'Tourist',
        travelPurpose: 'Vacation',
        urgency: 'Standard',
        personalInformation: {
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1990-01-01',
          gender: 'Male',
          nationality: 'Nigerian',
          maritalStatus: 'Single',
          occupation: 'Software Developer',
          address: '123 Test Street, Lagos, Nigeria'
        },
        passportDetails: {
          passportNumber: 'A12345678',
          issueDate: '2020-01-01',
          expiryDate: '2030-01-01',
          placeOfIssue: 'Lagos'
        },
        referralCode: 'TRAVEL-TEST-123'
      };

      const response = await request(app)
        .post('/api/v1/products/visa/apply')
        .set('Authorization', `Bearer ${userToken}`)
        .send(applicationData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.visaApplication).toBeDefined();
      expect(response.body.data.referralInfo).toBeDefined();
    });
  });

  describe('Commission Processing on Payment Verification', () => {
    let testReferral;
    let testLedgerEntry;

    beforeEach(async () => {
      // Create a referral
      testReferral = await Referral.create({
        affiliateId: testAffiliate._id,
        customerId: testUser._id,
        referralCode: 'TRAVEL-TEST-123',
        referralSource: 'link',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent'
      });

      // Create a ledger entry with referral code
      testLedgerEntry = await Ledger.create({
        userId: testUser._id,
        transactionReference: 'TTP-FL-TEST-123',
        amount: 500000,
        currency: 'NGN',
        status: 'Completed',
        paymentGateway: 'Paystack',
        productType: 'Flight Booking',
        itemType: 'Flight',
        markupApplied: 5000,
        totalAmountPaid: 505000,
        referralCode: 'TRAVEL-TEST-123',
        productDetails: {
          flightId: 'FL123'
        }
      });
    });

    it('should process commission when payment is verified', async () => {
      const verificationData = {
        reference: 'TTP-FL-TEST-123'
      };

      // Mock successful payment verification response
      const response = {
        success: true,
        data: {
          transactionReference: 'TTP-FL-TEST-123',
          status: 'Completed',
          amount: 505000
        }
      };

      // Simulate commission processing
      const BookingIntegrationService = require('../../services/bookingIntegrationService');
      const result = await BookingIntegrationService.processBookingCompletion('TTP-FL-TEST-123');

      expect(result.success).toBe(true);
      expect(result.processed).toBe(true);
      expect(result.commission).toBeDefined();

      // Verify commission transaction was created
      const commission = await CommissionTransaction.findOne({
        bookingReference: 'TTP-FL-TEST-123'
      });
      expect(commission).toBeTruthy();
      expect(commission.affiliateId.toString()).toBe(testAffiliate._id.toString());
      expect(commission.commissionAmount).toBe(12500); // 2.5% of 500000

      // Verify wallet was credited
      const updatedWallet = await Wallet.findOne({ affiliateId: testAffiliate._id });
      expect(updatedWallet.balance).toBe(12500);
      expect(updatedWallet.totalEarned).toBe(12500);
    });

    it('should handle commission processing for guest bookings', async () => {
      // Update ledger entry to be a guest booking
      await Ledger.findByIdAndUpdate(testLedgerEntry._id, {
        userId: null,
        guestEmail: 'guest@example.com',
        guestPhoneNumber: '+2348012345678'
      });

      // Update referral to use guest email as customer ID
      await Referral.findByIdAndUpdate(testReferral._id, {
        customerId: 'guest@example.com'
      });

      const BookingIntegrationService = require('../../services/bookingIntegrationService');
      const result = await BookingIntegrationService.processBookingCompletion('TTP-FL-TEST-123');

      expect(result.success).toBe(true);
      expect(result.processed).toBe(true);
    });
  });

  describe('QR Code Generation for Bookings with Referrals', () => {
    it('should generate QR code for booking with referral', async () => {
      const BookingIntegrationService = require('../../services/bookingIntegrationService');
      
      const bookingData = {
        bookingReference: 'TTP-FL-TEST-QR',
        serviceType: 'flight',
        bookingAmount: 500000,
        currency: 'NGN',
        referralCode: 'TRAVEL-TEST-123'
      };

      const referralInfo = {
        tracked: true,
        affiliate: {
          id: testAffiliate._id,
          businessName: testAffiliate.businessName
        }
      };

      const result = await BookingIntegrationService.generateBookingQRCode(bookingData, referralInfo);

      expect(result.success).toBe(true);
      expect(result.generated).toBe(true);
      expect(result.qrCode).toBeDefined();
      expect(result.qrCode.data).toBeDefined();
      expect(result.qrCode.url).toBeDefined();
    });
  });

  describe('Booking Statistics with Referrals', () => {
    beforeEach(async () => {
      // Create some test data
      await Ledger.create([
        {
          userId: testUser._id,
          transactionReference: 'TTP-FL-STAT-1',
          amount: 300000,
          currency: 'NGN',
          status: 'Completed',
          paymentGateway: 'Paystack',
          productType: 'Flight Booking',
          itemType: 'Flight',
          markupApplied: 3000,
          totalAmountPaid: 303000,
          referralCode: 'TRAVEL-TEST-123'
        },
        {
          userId: testUser._id,
          transactionReference: 'TTP-HTL-STAT-1',
          amount: 150000,
          currency: 'NGN',
          status: 'Completed',
          paymentGateway: 'Paystack',
          productType: 'Hotel Reservation',
          itemType: 'Hotel',
          markupApplied: 1500,
          totalAmountPaid: 151500,
          referralCode: 'TRAVEL-TEST-123'
        }
      ]);
    });

    it('should get booking referral statistics', async () => {
      const BookingIntegrationService = require('../../services/bookingIntegrationService');
      const stats = await BookingIntegrationService.getBookingReferralStats();

      expect(stats.success).toBe(true);
      expect(stats.data.overview.totalBookings).toBe(2);
      expect(stats.data.overview.totalValue).toBe(450000);
      expect(stats.data.serviceBreakdown).toHaveLength(2);
    });

    it('should filter statistics by service type', async () => {
      const BookingIntegrationService = require('../../services/bookingIntegrationService');
      const stats = await BookingIntegrationService.getBookingReferralStats({
        serviceType: 'flight'
      });

      expect(stats.success).toBe(true);
      expect(stats.data.overview.totalBookings).toBe(1);
      expect(stats.data.overview.totalValue).toBe(300000);
    });
  });

  describe('Error Handling', () => {
    it('should handle booking integration service errors gracefully', async () => {
      const BookingIntegrationService = require('../../services/bookingIntegrationService');
      
      // Test with invalid transaction reference
      const result = await BookingIntegrationService.processBookingCompletion('INVALID-REF');
      
      expect(result.success).toBe(false);
    });

    it('should continue booking process even if referral tracking fails', async () => {
      // Test with inactive affiliate
      await Affiliate.findByIdAndUpdate(testAffiliate._id, { status: 'suspended' });

      const bookingData = {
        flightDetails: {
          id: 'FL123',
          price: 500000
        },
        passengerDetails: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          phoneNumber: '+2348012345678'
        },
        referralCode: 'TRAVEL-TEST-123'
      };

      const response = await request(app)
        .post('/api/v1/products/flights/book')
        .set('Authorization', `Bearer ${userToken}`)
        .send(bookingData)
        .expect(200);

      // Booking should still succeed
      expect(response.body.success).toBe(true);
      expect(response.body.data.authorizationUrl).toBeDefined();
    });
  });
});