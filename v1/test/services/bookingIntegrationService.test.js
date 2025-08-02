// v1/test/services/bookingIntegrationService.test.js
const mongoose = require('mongoose');
const BookingIntegrationService = require('../../services/bookingIntegrationService');
const ReferralTrackingService = require('../../services/referralTrackingService');
const CommissionService = require('../../services/commissionService');
const QRCodeService = require('../../services/qrCodeService');
const Ledger = require('../../models/ledgerModel');
const User = require('../../models/userModel');
const Affiliate = require('../../models/affiliateModel');
const Wallet = require('../../models/walletModel');
const Referral = require('../../models/referralModel');
const { connectTestDB, clearTestDB, closeTestDB } = require('../testSetup');

// Mock the services
jest.mock('../../services/referralTrackingService');
jest.mock('../../services/commissionService');
jest.mock('../../services/qrCodeService');

describe('BookingIntegrationService', () => {
  let testUser;
  let testAffiliate;
  let testWallet;

  beforeAll(async () => {
    await connectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    jest.clearAllMocks();

    // Create test data
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

    const affiliateUser = await User.create({
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@example.com',
      phoneNumber: '+2348087654321',
      password: 'Password123!',
      role: 'Business',
      isEmailVerified: true,
      isPhoneVerified: true
    });

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

    testWallet = await Wallet.create({
      affiliateId: testAffiliate._id,
      balance: 0,
      totalEarned: 0,
      totalWithdrawn: 0,
      currency: 'NGN',
      status: 'active'
    });
  });

  afterAll(async () => {
    await closeTestDB();
  });

  describe('processReferralTracking', () => {
    it('should successfully track referral with valid code', async () => {
      const mockTrackingResult = {
        success: true,
        referral: { _id: 'referral123' },
        affiliate: { id: testAffiliate._id, businessName: 'Test Travel Agency' },
        isNew: true,
        message: 'Referral tracked successfully'
      };

      ReferralTrackingService.trackReferral.mockResolvedValue(mockTrackingResult);

      const bookingData = { referralCode: 'TRAVEL-TEST-123' };
      const customerData = { customerId: testUser._id, customerEmail: testUser.email };
      const requestData = { ipAddress: '127.0.0.1', userAgent: 'Test Agent' };

      const result = await BookingIntegrationService.processReferralTracking(
        bookingData,
        customerData,
        requestData
      );

      expect(result.success).toBe(true);
      expect(result.tracked).toBe(true);
      expect(result.referral).toBeDefined();
      expect(result.affiliate).toBeDefined();
      expect(ReferralTrackingService.trackReferral).toHaveBeenCalledWith(
        'TRAVEL-TEST-123',
        customerData,
        requestData
      );
    });

    it('should handle missing referral code', async () => {
      const bookingData = {};
      const customerData = { customerId: testUser._id };
      const requestData = {};

      const result = await BookingIntegrationService.processReferralTracking(
        bookingData,
        customerData,
        requestData
      );

      expect(result.success).toBe(true);
      expect(result.tracked).toBe(false);
      expect(result.message).toBe('No referral code provided');
      expect(ReferralTrackingService.trackReferral).not.toHaveBeenCalled();
    });

    it('should handle referral tracking errors', async () => {
      ReferralTrackingService.trackReferral.mockRejectedValue(new Error('Tracking failed'));

      const bookingData = { referralCode: 'TRAVEL-TEST-123' };
      const customerData = { customerId: testUser._id };
      const requestData = {};

      const result = await BookingIntegrationService.processReferralTracking(
        bookingData,
        customerData,
        requestData
      );

      expect(result.success).toBe(false);
      expect(result.tracked).toBe(false);
      expect(result.error).toBe('Tracking failed');
    });
  });

  describe('processCommission', () => {
    beforeEach(() => {
      ReferralTrackingService.validateReferralCode.mockResolvedValue({
        valid: true,
        affiliate: testAffiliate
      });

      CommissionService.processCommission.mockResolvedValue({
        success: true,
        data: {
          commission: {
            _id: 'commission123',
            commissionAmount: 12500,
            commissionRate: 2.5,
            status: 'approved'
          }
        }
      });
    });

    it('should successfully process commission', async () => {
      const bookingData = {
        bookingReference: 'TTP-FL-123',
        serviceType: 'flight',
        bookingAmount: 500000,
        currency: 'NGN',
        referralCode: 'TRAVEL-TEST-123'
      };

      const result = await BookingIntegrationService.processCommission(bookingData, testUser._id);

      expect(result.success).toBe(true);
      expect(result.processed).toBe(true);
      expect(result.commission).toBeDefined();
      expect(result.affiliate).toBeDefined();
      expect(CommissionService.processCommission).toHaveBeenCalledWith(
        'TTP-FL-123',
        testAffiliate._id,
        {
          serviceType: 'flight',
          bookingAmount: 500000,
          currency: 'NGN',
          customerId: testUser._id
        },
        {
          autoApprove: true,
          notes: 'Commission for flight booking TTP-FL-123'
        }
      );
    });

    it('should handle missing referral code', async () => {
      const bookingData = {
        bookingReference: 'TTP-FL-123',
        serviceType: 'flight',
        bookingAmount: 500000
      };

      const result = await BookingIntegrationService.processCommission(bookingData, testUser._id);

      expect(result.success).toBe(true);
      expect(result.processed).toBe(false);
      expect(result.message).toBe('No referral code associated with booking');
    });

    it('should handle invalid referral code', async () => {
      ReferralTrackingService.validateReferralCode.mockResolvedValue({
        valid: false,
        error: 'Invalid referral code'
      });

      const bookingData = {
        bookingReference: 'TTP-FL-123',
        serviceType: 'flight',
        bookingAmount: 500000,
        referralCode: 'INVALID-CODE'
      };

      const result = await BookingIntegrationService.processCommission(bookingData, testUser._id);

      expect(result.success).toBe(false);
      expect(result.processed).toBe(false);
      expect(result.error).toBe('Invalid referral code');
    });
  });

  describe('generateBookingQRCode', () => {
    it('should successfully generate QR code for booking with referral', async () => {
      const mockQRResult = {
        success: true,
        data: {
          qrCode: {
            data: 'base64-qr-code-data',
            url: 'https://example.com/qr/123',
            metadata: { type: 'referral' }
          }
        }
      };

      QRCodeService.generateReferralQR.mockResolvedValue(mockQRResult);

      const bookingData = {
        bookingReference: 'TTP-FL-123',
        serviceType: 'flight',
        bookingAmount: 500000,
        currency: 'NGN',
        referralCode: 'TRAVEL-TEST-123'
      };

      const referralInfo = {
        tracked: true,
        affiliate: {
          id: testAffiliate._id,
          businessName: 'Test Travel Agency'
        }
      };

      const result = await BookingIntegrationService.generateBookingQRCode(bookingData, referralInfo);

      expect(result.success).toBe(true);
      expect(result.generated).toBe(true);
      expect(result.qrCode).toBeDefined();
      expect(QRCodeService.generateReferralQR).toHaveBeenCalledWith({
        bookingReference: 'TTP-FL-123',
        serviceType: 'flight',
        bookingAmount: 500000,
        currency: 'NGN',
        affiliateId: testAffiliate._id,
        businessName: 'Test Travel Agency',
        referralCode: 'TRAVEL-TEST-123',
        timestamp: expect.any(Date)
      });
    });

    it('should handle missing referral info', async () => {
      const bookingData = {
        bookingReference: 'TTP-FL-123',
        serviceType: 'flight',
        bookingAmount: 500000
      };

      const referralInfo = { tracked: false };

      const result = await BookingIntegrationService.generateBookingQRCode(bookingData, referralInfo);

      expect(result.success).toBe(true);
      expect(result.generated).toBe(false);
      expect(result.message).toBe('No referral information for QR code generation');
      expect(QRCodeService.generateReferralQR).not.toHaveBeenCalled();
    });
  });

  describe('completeBookingIntegration', () => {
    it('should complete full booking integration process', async () => {
      // Mock all service calls
      ReferralTrackingService.trackReferral.mockResolvedValue({
        success: true,
        referral: { _id: 'referral123' },
        affiliate: { id: testAffiliate._id, businessName: 'Test Travel Agency' },
        isNew: true
      });

      ReferralTrackingService.validateReferralCode.mockResolvedValue({
        valid: true,
        affiliate: testAffiliate
      });

      CommissionService.processCommission.mockResolvedValue({
        success: true,
        data: { commission: { commissionAmount: 12500 } }
      });

      QRCodeService.generateReferralQR.mockResolvedValue({
        success: true,
        data: { qrCode: { data: 'qr-data', url: 'qr-url' } }
      });

      const bookingData = {
        referralCode: 'TRAVEL-TEST-123',
        bookingReference: 'TTP-FL-123',
        serviceType: 'flight',
        bookingAmount: 500000
      };

      const customerData = {
        customerId: testUser._id,
        customerEmail: testUser.email
      };

      const requestData = {
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent'
      };

      const result = await BookingIntegrationService.completeBookingIntegration(
        bookingData,
        customerData,
        requestData
      );

      expect(result.success).toBe(true);
      expect(result.results.referralTracking.tracked).toBe(true);
      expect(result.results.commissionProcessing.processed).toBe(true);
      expect(result.results.qrCodeGeneration.generated).toBe(true);
    });
  });

  describe('processBookingCompletion', () => {
    let testLedgerEntry;

    beforeEach(async () => {
      // Create a referral
      await Referral.create({
        affiliateId: testAffiliate._id,
        customerId: testUser._id,
        referralCode: 'TRAVEL-TEST-123',
        referralSource: 'link',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent'
      });

      // Create a ledger entry
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
        referralCode: 'TRAVEL-TEST-123'
      });

      // Mock commission service
      ReferralTrackingService.validateReferralCode.mockResolvedValue({
        valid: true,
        affiliate: testAffiliate
      });

      CommissionService.processCommission.mockResolvedValue({
        success: true,
        data: {
          commission: {
            commissionAmount: 12500,
            affiliate: testAffiliate
          }
        }
      });

      QRCodeService.generateReferralQR.mockResolvedValue({
        success: true,
        data: { qrCode: { data: 'qr-data' } }
      });
    });

    it('should process booking completion successfully', async () => {
      const result = await BookingIntegrationService.processBookingCompletion('TTP-FL-TEST-123');

      expect(result.success).toBe(true);
      expect(result.processed).toBe(true);
      expect(result.commission).toBeDefined();
      expect(result.qrCode).toBeDefined();
    });

    it('should handle transaction not found', async () => {
      await expect(
        BookingIntegrationService.processBookingCompletion('INVALID-REF')
      ).rejects.toThrow('Transaction not found');
    });

    it('should handle transaction without referral code', async () => {
      await Ledger.findByIdAndUpdate(testLedgerEntry._id, { referralCode: null });

      const result = await BookingIntegrationService.processBookingCompletion('TTP-FL-TEST-123');

      expect(result.success).toBe(true);
      expect(result.processed).toBe(false);
      expect(result.message).toBe('No referral code associated with transaction');
    });
  });

  describe('getBookingReferralStats', () => {
    beforeEach(async () => {
      // Create test ledger entries
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
      const result = await BookingIntegrationService.getBookingReferralStats();

      expect(result.success).toBe(true);
      expect(result.data.overview.totalBookings).toBe(2);
      expect(result.data.overview.totalValue).toBe(450000);
      expect(result.data.serviceBreakdown).toHaveLength(2);
    });

    it('should filter statistics by service type', async () => {
      const result = await BookingIntegrationService.getBookingReferralStats({
        serviceType: 'flight'
      });

      expect(result.success).toBe(true);
      expect(result.data.overview.totalBookings).toBe(1);
      expect(result.data.overview.totalValue).toBe(300000);
    });

    it('should filter statistics by date range', async () => {
      const yesterday = new Date(Date.now() - 86400000);
      const tomorrow = new Date(Date.now() + 86400000);

      const result = await BookingIntegrationService.getBookingReferralStats({
        startDate: yesterday.toISOString(),
        endDate: tomorrow.toISOString()
      });

      expect(result.success).toBe(true);
      expect(result.data.overview.totalBookings).toBe(2);
    });
  });

  describe('enhanceBookingConfirmation', () => {
    it('should enhance booking confirmation with referral info', async () => {
      const bookingConfirmation = {
        success: true,
        data: {
          reference: 'TTP-FL-123',
          amount: 505000,
          referralCode: 'TRAVEL-TEST-123'
        }
      };

      const integrationResults = {
        results: {
          referralTracking: {
            tracked: true,
            affiliate: { businessName: 'Test Travel Agency' },
            isNew: true
          },
          commissionProcessing: {
            processed: true,
            commission: {
              commissionAmount: 12500,
              commissionRate: 2.5,
              status: 'approved'
            }
          },
          qrCodeGeneration: {
            generated: true,
            qrCode: { data: 'qr-data', url: 'qr-url' }
          }
        }
      };

      const enhanced = BookingIntegrationService.enhanceBookingConfirmation(
        bookingConfirmation,
        integrationResults
      );

      expect(enhanced.data.referralInfo).toBeDefined();
      expect(enhanced.data.referralInfo.tracked).toBe(true);
      expect(enhanced.data.referralInfo.affiliateBusinessName).toBe('Test Travel Agency');
      expect(enhanced.data.referralInfo.commissionGenerated).toBeDefined();
      expect(enhanced.data.referralInfo.qrCode).toBeDefined();
    });

    it('should return original confirmation if no referral tracking', async () => {
      const bookingConfirmation = {
        success: true,
        data: { reference: 'TTP-FL-123', amount: 505000 }
      };

      const integrationResults = {
        results: {
          referralTracking: { tracked: false }
        }
      };

      const enhanced = BookingIntegrationService.enhanceBookingConfirmation(
        bookingConfirmation,
        integrationResults
      );

      expect(enhanced.data.referralInfo).toBeUndefined();
      expect(enhanced).toEqual(bookingConfirmation);
    });
  });
});