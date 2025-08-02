// v1/test/services/referralTrackingService.test.js
const ReferralTrackingService = require('../../services/referralTrackingService');
const Referral = require('../../models/referralModel');
const Affiliate = require('../../models/affiliateModel');
const { ApiError } = require('../../utils/apiError');
const mongoose = require('mongoose');

// Mock the models
jest.mock('../../models/referralModel', () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  findById: jest.fn(),
  countDocuments: jest.fn(),
  getAffiliateStats: jest.fn(),
  getTopPerformers: jest.fn(),
  findByCustomer: jest.fn(),
  aggregate: jest.fn(),
  insertMany: jest.fn()
}));

jest.mock('../../models/affiliateModel', () => ({
  findOne: jest.fn()
}));

jest.mock('../../utils/logger');

describe('ReferralTrackingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('trackReferral', () => {
    const mockCustomerData = {
      customerId: new mongoose.Types.ObjectId(),
      customerEmail: 'customer@example.com'
    };

    const mockRequestData = {
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      referrerUrl: 'https://google.com',
      landingPage: '/flights',
      deviceInfo: { type: 'desktop', browser: 'Chrome', os: 'Windows' },
      geolocation: { country: 'Nigeria', city: 'Lagos' },
      utmParameters: { utm_source: 'google', utm_medium: 'cpc' }
    };

    const mockAffiliate = {
      _id: new mongoose.Types.ObjectId(),
      businessName: 'Test Business',
      affiliateId: 'AFF-123456',
      referralCode: 'TESTBIZ-123',
      status: 'active',
      incrementReferrals: jest.fn().mockResolvedValue(true)
    };

    it('should successfully track a new referral', async () => {
      // Mock validation to return new referral
      jest.spyOn(ReferralTrackingService, 'validateReferralCode')
        .mockResolvedValue({
          valid: true,
          affiliate: mockAffiliate,
          isNew: true
        });

      // Mock Referral constructor and save
      const mockReferral = {
        _id: new mongoose.Types.ObjectId(),
        affiliateId: mockAffiliate._id,
        customerId: mockCustomerData.customerId,
        referralCode: 'TESTBIZ-123',
        save: jest.fn().mockResolvedValue(true)
      };
      Referral.mockImplementation(() => mockReferral);

      const result = await ReferralTrackingService.trackReferral(
        'TESTBIZ-123',
        mockCustomerData,
        mockRequestData
      );

      expect(result.success).toBe(true);
      expect(result.isNew).toBe(true);
      expect(result.referral).toBe(mockReferral);
      expect(result.affiliate.businessName).toBe('Test Business');
      expect(mockAffiliate.incrementReferrals).toHaveBeenCalled();
      expect(mockReferral.save).toHaveBeenCalled();
    });

    it('should return existing referral if already tracked', async () => {
      const mockExistingReferral = {
        _id: new mongoose.Types.ObjectId(),
        affiliateId: mockAffiliate._id,
        customerId: mockCustomerData.customerId,
        referralCode: 'TESTBIZ-123'
      };

      jest.spyOn(ReferralTrackingService, 'validateReferralCode')
        .mockResolvedValue({
          valid: true,
          referral: mockExistingReferral,
          isNew: false
        });

      const result = await ReferralTrackingService.trackReferral(
        'TESTBIZ-123',
        mockCustomerData,
        mockRequestData
      );

      expect(result.success).toBe(true);
      expect(result.isNew).toBe(false);
      expect(result.referral).toBe(mockExistingReferral);
      expect(mockAffiliate.incrementReferrals).not.toHaveBeenCalled();
    });

    it('should throw error for invalid referral code', async () => {
      jest.spyOn(ReferralTrackingService, 'validateReferralCode')
        .mockResolvedValue({
          valid: false,
          error: 'Invalid referral code'
        });

      await expect(
        ReferralTrackingService.trackReferral(
          'INVALID-CODE',
          mockCustomerData,
          mockRequestData
        )
      ).rejects.toThrow(ApiError);
    });

    it('should handle missing request data gracefully', async () => {
      jest.spyOn(ReferralTrackingService, 'validateReferralCode')
        .mockResolvedValue({
          valid: true,
          affiliate: mockAffiliate,
          isNew: true
        });

      const mockReferral = {
        _id: new mongoose.Types.ObjectId(),
        save: jest.fn().mockResolvedValue(true)
      };
      Referral.mockImplementation(() => mockReferral);

      const result = await ReferralTrackingService.trackReferral(
        'TESTBIZ-123',
        mockCustomerData,
        {} // Empty request data
      );

      expect(result.success).toBe(true);
      expect(mockReferral.save).toHaveBeenCalled();
    });
  });

  describe('validateReferralCode', () => {
    it('should validate active affiliate referral code', async () => {
      const mockAffiliate = {
        _id: new mongoose.Types.ObjectId(),
        referralCode: 'TESTBIZ-123',
        status: 'active'
      };

      Affiliate.findOne.mockResolvedValue(mockAffiliate);
      Referral.findOne.mockResolvedValue(null);

      const result = await ReferralTrackingService.validateReferralCode('testbiz-123');

      expect(result.valid).toBe(true);
      expect(result.affiliate).toBe(mockAffiliate);
      expect(result.isNew).toBe(true);
    });

    it('should return existing referral if customer already referred', async () => {
      const customerId = new mongoose.Types.ObjectId();
      const mockReferral = {
        _id: new mongoose.Types.ObjectId(),
        customerId,
        referralCode: 'TESTBIZ-123',
        affiliateId: { businessName: 'Test Business' }
      };

      Referral.findOne.mockResolvedValue(mockReferral);

      const result = await ReferralTrackingService.validateReferralCode(
        'TESTBIZ-123',
        customerId
      );

      expect(result.valid).toBe(true);
      expect(result.referral).toBe(mockReferral);
      expect(result.isNew).toBe(false);
    });

    it('should return invalid for non-existent referral code', async () => {
      Affiliate.findOne.mockResolvedValue(null);
      Referral.findOne.mockResolvedValue(null);

      const result = await ReferralTrackingService.validateReferralCode('INVALID-CODE');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid or inactive referral code');
    });

    it('should return invalid for inactive affiliate', async () => {
      const mockAffiliate = {
        _id: new mongoose.Types.ObjectId(),
        referralCode: 'TESTBIZ-123',
        status: 'suspended'
      };

      Affiliate.findOne.mockResolvedValue(null); // Active affiliate not found
      Referral.findOne.mockResolvedValue(null);

      const result = await ReferralTrackingService.validateReferralCode('TESTBIZ-123');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid or inactive referral code');
    });

    it('should handle empty or invalid referral code', async () => {
      let result = await ReferralTrackingService.validateReferralCode('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Referral code is required');

      result = await ReferralTrackingService.validateReferralCode(null);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Referral code is required');
    });
  });

  describe('attributeBooking', () => {
    const mockBookingData = {
      bookingReference: 'BOOK-123456',
      serviceType: 'flight',
      bookingAmount: 50000,
      commissionGenerated: 1250,
      currency: 'NGN'
    };

    const customerId = new mongoose.Types.ObjectId();

    it('should successfully attribute booking to referral', async () => {
      const mockAffiliate = {
        _id: new mongoose.Types.ObjectId(),
        addCommissionEarnings: jest.fn().mockResolvedValue(true)
      };

      const mockReferral = {
        _id: new mongoose.Types.ObjectId(),
        customerId,
        status: 'active',
        affiliateId: mockAffiliate,
        bookingHistory: [],
        addBooking: jest.fn().mockResolvedValue(true)
      };

      Referral.findOne.mockResolvedValue(mockReferral);

      const result = await ReferralTrackingService.attributeBooking(
        mockBookingData,
        customerId
      );

      expect(result.success).toBe(true);
      expect(result.attributed).toBe(true);
      expect(mockReferral.addBooking).toHaveBeenCalledWith(mockBookingData);
      expect(mockAffiliate.addCommissionEarnings).toHaveBeenCalledWith(1250);
    });

    it('should not attribute if no active referral found', async () => {
      Referral.findOne.mockResolvedValue(null);

      const result = await ReferralTrackingService.attributeBooking(
        mockBookingData,
        customerId
      );

      expect(result.success).toBe(false);
      expect(result.attributed).toBe(false);
      expect(result.message).toBe('No active referral found for customer');
    });

    it('should not attribute if booking already exists', async () => {
      const mockReferral = {
        _id: new mongoose.Types.ObjectId(),
        customerId,
        status: 'active',
        bookingHistory: [{ bookingReference: 'BOOK-123456' }],
        addBooking: jest.fn()
      };

      Referral.findOne.mockResolvedValue(mockReferral);

      const result = await ReferralTrackingService.attributeBooking(
        mockBookingData,
        customerId
      );

      expect(result.success).toBe(true);
      expect(result.attributed).toBe(false);
      expect(result.message).toBe('Booking already attributed');
      expect(mockReferral.addBooking).not.toHaveBeenCalled();
    });

    it('should handle attribution without commission', async () => {
      const mockAffiliate = {
        _id: new mongoose.Types.ObjectId(),
        addCommissionEarnings: jest.fn()
      };

      const mockReferral = {
        _id: new mongoose.Types.ObjectId(),
        customerId,
        status: 'active',
        affiliateId: mockAffiliate,
        bookingHistory: [],
        addBooking: jest.fn().mockResolvedValue(true)
      };

      Referral.findOne.mockResolvedValue(mockReferral);

      const bookingDataNoCommission = {
        ...mockBookingData,
        commissionGenerated: 0
      };

      const result = await ReferralTrackingService.attributeBooking(
        bookingDataNoCommission,
        customerId
      );

      expect(result.success).toBe(true);
      expect(result.attributed).toBe(true);
      expect(mockAffiliate.addCommissionEarnings).not.toHaveBeenCalled();
    });
  });

  describe('getReferralStats', () => {
    const affiliateId = new mongoose.Types.ObjectId();

    it('should return comprehensive referral statistics', async () => {
      const mockBasicStats = [{
        totalReferrals: 10,
        convertedReferrals: 6,
        totalBookings: 15,
        totalValue: 500000,
        conversionRate: 60
      }];

      const mockSourceBreakdown = [
        { _id: 'qr_code', count: 5, totalValue: 250000, conversionRate: 80 },
        { _id: 'link', count: 3, totalValue: 150000, conversionRate: 66.67 },
        { _id: 'social_media', count: 2, totalValue: 100000, conversionRate: 50 }
      ];

      const mockMonthlyPerformance = [
        { _id: { year: 2024, month: 1 }, referrals: 5, conversions: 3, totalValue: 250000 },
        { _id: { year: 2023, month: 12 }, referrals: 5, conversions: 3, totalValue: 250000 }
      ];

      const mockTopPerformers = [
        { _id: 'ref1', totalValue: 100000, customerId: { firstName: 'John', lastName: 'Doe' } },
        { _id: 'ref2', totalValue: 80000, customerId: { firstName: 'Jane', lastName: 'Smith' } }
      ];

      Referral.getAffiliateStats.mockResolvedValue(mockBasicStats);
      Referral.aggregate
        .mockResolvedValueOnce(mockSourceBreakdown) // First call for source breakdown
        .mockResolvedValueOnce(mockMonthlyPerformance); // Second call for monthly performance
      Referral.getTopPerformers.mockResolvedValue(mockTopPerformers);

      const result = await ReferralTrackingService.getReferralStats(affiliateId);

      expect(result.success).toBe(true);
      expect(result.stats.overview).toEqual(mockBasicStats[0]);
      expect(result.stats.sourceBreakdown).toEqual(mockSourceBreakdown);
      expect(result.stats.monthlyPerformance).toEqual(mockMonthlyPerformance);
      expect(result.stats.topPerformers).toEqual(mockTopPerformers);
    });

    it('should handle date range filtering', async () => {
      const dateRange = {
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      };

      Referral.getAffiliateStats.mockResolvedValue([]);
      Referral.aggregate.mockResolvedValue([]);
      Referral.getTopPerformers.mockResolvedValue([]);

      await ReferralTrackingService.getReferralStats(affiliateId, dateRange);

      expect(Referral.getAffiliateStats).toHaveBeenCalledWith(affiliateId, dateRange);
    });

    it('should handle empty statistics gracefully', async () => {
      Referral.getAffiliateStats.mockResolvedValue([]);
      Referral.aggregate.mockResolvedValue([]);
      Referral.getTopPerformers.mockResolvedValue([]);

      const result = await ReferralTrackingService.getReferralStats(affiliateId);

      expect(result.success).toBe(true);
      expect(result.stats.overview).toEqual({
        totalReferrals: 0,
        convertedReferrals: 0,
        totalBookings: 0,
        totalValue: 0,
        conversionRate: 0
      });
    });
  });

  describe('getCustomerReferralHistory', () => {
    const customerId = new mongoose.Types.ObjectId();

    it('should return customer referral history with summary', async () => {
      const mockReferrals = [
        { _id: 'ref1', totalBookings: 2, totalValue: 100000, status: 'converted' },
        { _id: 'ref2', totalBookings: 0, totalValue: 0, status: 'active' },
        { _id: 'ref3', totalBookings: 1, totalValue: 50000, status: 'converted' }
      ];

      Referral.findByCustomer.mockResolvedValue(mockReferrals);

      const result = await ReferralTrackingService.getCustomerReferralHistory(customerId);

      expect(result.success).toBe(true);
      expect(result.referrals).toEqual(mockReferrals);
      expect(result.summary).toEqual({
        totalReferrals: 3,
        totalBookings: 3,
        totalValue: 150000,
        activeReferrals: 1,
        convertedReferrals: 2
      });
    });

    it('should handle empty referral history', async () => {
      Referral.findByCustomer.mockResolvedValue([]);

      const result = await ReferralTrackingService.getCustomerReferralHistory(customerId);

      expect(result.success).toBe(true);
      expect(result.referrals).toEqual([]);
      expect(result.summary.totalReferrals).toBe(0);
    });
  });

  describe('getReferralsByAffiliate', () => {
    const affiliateId = new mongoose.Types.ObjectId();

    it('should return paginated referrals with filters', async () => {
      const mockReferrals = [
        { _id: 'ref1', status: 'active', customerId: { firstName: 'John' } },
        { _id: 'ref2', status: 'converted', customerId: { firstName: 'Jane' } }
      ];

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockReferrals)
      };

      Referral.find.mockReturnValue(mockQuery);
      Referral.countDocuments.mockResolvedValue(2);

      const options = {
        status: 'active',
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      };

      const result = await ReferralTrackingService.getReferralsByAffiliate(affiliateId, options);

      expect(result.success).toBe(true);
      expect(result.referrals).toEqual(mockReferrals);
      expect(result.pagination).toEqual({
        currentPage: 1,
        totalPages: 1,
        totalCount: 2,
        hasNextPage: false,
        hasPrevPage: false
      });
    });

    it('should handle pagination correctly', async () => {
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([])
      };

      Referral.find.mockReturnValue(mockQuery);
      Referral.countDocuments.mockResolvedValue(25);

      const options = { page: 2, limit: 10 };

      const result = await ReferralTrackingService.getReferralsByAffiliate(affiliateId, options);

      expect(mockQuery.skip).toHaveBeenCalledWith(10);
      expect(result.pagination.currentPage).toBe(2);
      expect(result.pagination.totalPages).toBe(3);
      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.pagination.hasPrevPage).toBe(true);
    });
  });

  describe('blockReferral', () => {
    const referralId = new mongoose.Types.ObjectId();

    it('should successfully block a referral', async () => {
      const mockReferral = {
        _id: referralId,
        block: jest.fn().mockResolvedValue(true)
      };

      Referral.findById.mockResolvedValue(mockReferral);

      const result = await ReferralTrackingService.blockReferral(referralId, 'Fraudulent activity');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Referral blocked successfully');
      expect(mockReferral.block).toHaveBeenCalledWith('Fraudulent activity');
    });

    it('should throw error if referral not found', async () => {
      Referral.findById.mockResolvedValue(null);

      await expect(
        ReferralTrackingService.blockReferral(referralId, 'Test reason')
      ).rejects.toThrow(ApiError);
    });
  });

  describe('reactivateReferral', () => {
    const referralId = new mongoose.Types.ObjectId();

    it('should successfully reactivate a referral', async () => {
      const mockReferral = {
        _id: referralId,
        reactivate: jest.fn().mockResolvedValue(true)
      };

      Referral.findById.mockResolvedValue(mockReferral);

      const result = await ReferralTrackingService.reactivateReferral(referralId);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Referral reactivated successfully');
      expect(mockReferral.reactivate).toHaveBeenCalled();
    });

    it('should throw error if referral not found', async () => {
      Referral.findById.mockResolvedValue(null);

      await expect(
        ReferralTrackingService.reactivateReferral(referralId)
      ).rejects.toThrow(ApiError);
    });
  });

  describe('_determineReferralSource', () => {
    it('should detect QR code source from UTM parameters', () => {
      const requestData = {
        utmParameters: { utm_medium: 'qr_code' }
      };

      const source = ReferralTrackingService._determineReferralSource(requestData);
      expect(source).toBe('qr_code');
    });

    it('should detect email source from UTM parameters', () => {
      const requestData = {
        utmParameters: { utm_medium: 'email' }
      };

      const source = ReferralTrackingService._determineReferralSource(requestData);
      expect(source).toBe('email');
    });

    it('should detect social media from referrer URL', () => {
      const requestData = {
        referrerUrl: 'https://facebook.com/share'
      };

      const source = ReferralTrackingService._determineReferralSource(requestData);
      expect(source).toBe('social_media');
    });

    it('should detect mobile/QR code from user agent', () => {
      const requestData = {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) Mobile'
      };

      const source = ReferralTrackingService._determineReferralSource(requestData);
      expect(source).toBe('qr_code');
    });

    it('should default to link source', () => {
      const requestData = {};

      const source = ReferralTrackingService._determineReferralSource(requestData);
      expect(source).toBe('link');
    });
  });
});