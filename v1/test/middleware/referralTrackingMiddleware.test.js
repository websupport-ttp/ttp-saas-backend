// v1/test/middleware/referralTrackingMiddleware.test.js
const {
  trackReferralMiddleware,
  attributeBookingMiddleware,
  trackGuestReferralMiddleware,
  processPendingReferral
} = require('../../middleware/referralTrackingMiddleware');
const ReferralTrackingService = require('../../services/referralTrackingService');
const mongoose = require('mongoose');

// Mock the service
jest.mock('../../services/referralTrackingService');
jest.mock('../../utils/logger');

describe('Referral Tracking Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {},
      user: { id: new mongoose.Types.ObjectId(), email: 'user@example.com' },
      ip: '192.168.1.1',
      originalUrl: '/api/v1/products/book-flight',
      query: {},
      get: jest.fn(),
      connection: { remoteAddress: '192.168.1.1' }
    };

    res = {
      json: jest.fn()
    };

    next = jest.fn();

    jest.clearAllMocks();
  });

  describe('trackReferralMiddleware', () => {
    it('should track referral successfully', async () => {
      req.body.referralCode = 'TESTBIZ-123';
      req.get.mockImplementation((header) => {
        if (header === 'User-Agent') return 'Mozilla/5.0 Chrome';
        if (header === 'Referer') return 'https://google.com';
        return null;
      });

      const mockTrackingResult = {
        success: true,
        referral: { _id: 'referral123' },
        affiliate: { businessName: 'Test Business' },
        isNew: true
      };

      ReferralTrackingService.trackReferral.mockResolvedValue(mockTrackingResult);

      await trackReferralMiddleware(req, res, next);

      expect(ReferralTrackingService.trackReferral).toHaveBeenCalledWith(
        'TESTBIZ-123',
        {
          customerId: req.user.id,
          customerEmail: req.user.email
        },
        expect.objectContaining({
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0 Chrome',
          referrerUrl: 'https://google.com'
        })
      );

      expect(req.referralInfo).toEqual({
        tracked: true,
        referral: mockTrackingResult.referral,
        affiliate: mockTrackingResult.affiliate,
        isNew: true
      });

      expect(next).toHaveBeenCalled();
    });

    it('should skip tracking if no referral code provided', async () => {
      await trackReferralMiddleware(req, res, next);

      expect(ReferralTrackingService.trackReferral).not.toHaveBeenCalled();
      expect(req.referralInfo).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    it('should skip tracking if user not authenticated', async () => {
      req.body.referralCode = 'TESTBIZ-123';
      req.user = null;

      await trackReferralMiddleware(req, res, next);

      expect(ReferralTrackingService.trackReferral).not.toHaveBeenCalled();
      expect(req.referralInfo).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    it('should handle tracking errors gracefully', async () => {
      req.body.referralCode = 'TESTBIZ-123';
      
      ReferralTrackingService.trackReferral.mockRejectedValue(new Error('Tracking failed'));

      await trackReferralMiddleware(req, res, next);

      expect(req.referralInfo).toEqual({
        tracked: false,
        error: 'Tracking failed'
      });

      expect(next).toHaveBeenCalled();
    });

    it('should extract device info from user agent', async () => {
      req.body.referralCode = 'TESTBIZ-123';
      req.get.mockImplementation((header) => {
        if (header === 'User-Agent') return 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) Mobile Safari';
        return null;
      });

      ReferralTrackingService.trackReferral.mockResolvedValue({ success: true });

      await trackReferralMiddleware(req, res, next);

      expect(ReferralTrackingService.trackReferral).toHaveBeenCalledWith(
        'TESTBIZ-123',
        expect.any(Object),
        expect.objectContaining({
          deviceInfo: expect.objectContaining({
            type: 'mobile',
            browser: 'Safari',
            os: 'iOS'
          })
        })
      );
    });

    it('should extract UTM parameters from query', async () => {
      req.body.referralCode = 'TESTBIZ-123';
      req.query = {
        utm_source: 'google',
        utm_medium: 'cpc',
        utm_campaign: 'summer_sale'
      };

      ReferralTrackingService.trackReferral.mockResolvedValue({ success: true });

      await trackReferralMiddleware(req, res, next);

      expect(ReferralTrackingService.trackReferral).toHaveBeenCalledWith(
        'TESTBIZ-123',
        expect.any(Object),
        expect.objectContaining({
          utmParameters: {
            utm_source: 'google',
            utm_medium: 'cpc',
            utm_campaign: 'summer_sale',
            utm_term: undefined,
            utm_content: undefined
          }
        })
      );
    });
  });

  describe('attributeBookingMiddleware', () => {
    it('should attribute successful booking to referral', async () => {
      req.originalUrl = '/api/v1/products/book-flight';
      
      const mockAttributionResult = {
        attributed: true,
        affiliate: {
          affiliateId: 'AFF-123456',
          businessName: 'Test Business'
        }
      };

      ReferralTrackingService.attributeBooking.mockResolvedValue(mockAttributionResult);

      // Mock successful booking response
      const mockResponseData = {
        success: true,
        statusCode: 200,
        data: {
          bookingReference: 'BOOK-123456',
          totalAmount: 50000,
          currency: 'NGN'
        }
      };

      await attributeBookingMiddleware(req, res, next);

      // Simulate successful response
      await res.json(mockResponseData);

      expect(ReferralTrackingService.attributeBooking).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingReference: 'BOOK-123456',
          serviceType: 'flight',
          bookingAmount: 50000,
          currency: 'NGN'
        }),
        req.user.id
      );
    });

    it('should not attribute if not a booking endpoint', async () => {
      req.originalUrl = '/api/v1/users/profile';

      await attributeBookingMiddleware(req, res, next);

      const mockResponseData = {
        success: true,
        data: { profile: 'data' }
      };

      await res.json(mockResponseData);

      expect(ReferralTrackingService.attributeBooking).not.toHaveBeenCalled();
    });

    it('should not attribute if response indicates failure', async () => {
      req.originalUrl = '/api/v1/products/book-flight';

      await attributeBookingMiddleware(req, res, next);

      const mockResponseData = {
        success: false,
        statusCode: 400,
        error: 'Booking failed'
      };

      await res.json(mockResponseData);

      expect(ReferralTrackingService.attributeBooking).not.toHaveBeenCalled();
    });

    it('should not attribute if no booking reference in response', async () => {
      req.originalUrl = '/api/v1/products/book-flight';

      await attributeBookingMiddleware(req, res, next);

      const mockResponseData = {
        success: true,
        statusCode: 200,
        data: {
          message: 'Booking initiated'
          // No booking reference
        }
      };

      await res.json(mockResponseData);

      expect(ReferralTrackingService.attributeBooking).not.toHaveBeenCalled();
    });

    it('should handle attribution errors gracefully', async () => {
      req.originalUrl = '/api/v1/products/book-flight';
      
      ReferralTrackingService.attributeBooking.mockRejectedValue(new Error('Attribution failed'));

      await attributeBookingMiddleware(req, res, next);

      const mockResponseData = {
        success: true,
        statusCode: 200,
        data: {
          bookingReference: 'BOOK-123456',
          totalAmount: 50000
        }
      };

      // Should not throw error
      await expect(res.json(mockResponseData)).resolves.not.toThrow();
    });

    it('should add referral attribution info to response', async () => {
      req.originalUrl = '/api/v1/products/book-flight';
      
      const mockAttributionResult = {
        attributed: true,
        affiliate: {
          affiliateId: 'AFF-123456',
          businessName: 'Test Business'
        }
      };

      ReferralTrackingService.attributeBooking.mockResolvedValue(mockAttributionResult);

      await attributeBookingMiddleware(req, res, next);

      const mockResponseData = {
        success: true,
        statusCode: 200,
        data: {
          bookingReference: 'BOOK-123456',
          totalAmount: 50000
        }
      };

      await res.json(mockResponseData);

      expect(mockResponseData.data.referralAttribution).toEqual({
        attributed: true,
        affiliateId: 'AFF-123456',
        businessName: 'Test Business'
      });
    });
  });

  describe('trackGuestReferralMiddleware', () => {
    it('should store pending referral for guest booking', async () => {
      req.body = {
        referralCode: 'TESTBIZ-123',
        guestEmail: 'guest@example.com'
      };

      await trackGuestReferralMiddleware(req, res, next);

      expect(req.pendingReferral).toEqual({
        referralCode: 'TESTBIZ-123',
        guestEmail: 'guest@example.com',
        requestData: expect.objectContaining({
          ipAddress: '192.168.1.1'
        })
      });

      expect(next).toHaveBeenCalled();
    });

    it('should skip if no referral code provided', async () => {
      req.body = {
        guestEmail: 'guest@example.com'
      };

      await trackGuestReferralMiddleware(req, res, next);

      expect(req.pendingReferral).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    it('should skip if no guest email provided', async () => {
      req.body = {
        referralCode: 'TESTBIZ-123'
      };

      await trackGuestReferralMiddleware(req, res, next);

      expect(req.pendingReferral).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      req.body = {
        referralCode: 'TESTBIZ-123',
        guestEmail: 'guest@example.com'
      };

      // Mock error in get method
      req.get.mockImplementation(() => {
        throw new Error('Header error');
      });

      await trackGuestReferralMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('processPendingReferral', () => {
    const userId = new mongoose.Types.ObjectId();

    it('should process pending referral successfully', async () => {
      const pendingReferral = {
        referralCode: 'TESTBIZ-123',
        guestEmail: 'guest@example.com',
        requestData: {
          ipAddress: '192.168.1.1',
          userAgent: 'Chrome'
        }
      };

      const mockTrackingResult = {
        success: true,
        referral: { _id: 'referral123' }
      };

      ReferralTrackingService.trackReferral.mockResolvedValue(mockTrackingResult);

      const result = await processPendingReferral(userId, pendingReferral);

      expect(ReferralTrackingService.trackReferral).toHaveBeenCalledWith(
        'TESTBIZ-123',
        {
          customerId: userId,
          customerEmail: 'guest@example.com'
        },
        pendingReferral.requestData
      );

      expect(result).toBe(mockTrackingResult);
    });

    it('should return null if no pending referral', async () => {
      const result = await processPendingReferral(userId, null);

      expect(result).toBeNull();
      expect(ReferralTrackingService.trackReferral).not.toHaveBeenCalled();
    });

    it('should handle processing errors gracefully', async () => {
      const pendingReferral = {
        referralCode: 'TESTBIZ-123',
        guestEmail: 'guest@example.com',
        requestData: {}
      };

      ReferralTrackingService.trackReferral.mockRejectedValue(new Error('Processing failed'));

      const result = await processPendingReferral(userId, pendingReferral);

      expect(result).toBeNull();
    });
  });

  describe('Helper Functions', () => {
    describe('Device Info Extraction', () => {
      it('should extract mobile device info', async () => {
        req.body.referralCode = 'TESTBIZ-123';
        req.get.mockImplementation((header) => {
          if (header === 'User-Agent') return 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) Mobile Safari';
          return null;
        });

        ReferralTrackingService.trackReferral.mockResolvedValue({ success: true });

        await trackReferralMiddleware(req, res, next);

        const callArgs = ReferralTrackingService.trackReferral.mock.calls[0][2];
        expect(callArgs.deviceInfo).toEqual({
          type: 'mobile',
          browser: 'Safari',
          os: 'iOS'
        });
      });

      it('should extract tablet device info', async () => {
        req.body.referralCode = 'TESTBIZ-123';
        req.get.mockImplementation((header) => {
          if (header === 'User-Agent') return 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) Safari';
          return null;
        });

        ReferralTrackingService.trackReferral.mockResolvedValue({ success: true });

        await trackReferralMiddleware(req, res, next);

        const callArgs = ReferralTrackingService.trackReferral.mock.calls[0][2];
        expect(callArgs.deviceInfo.type).toBe('tablet');
      });

      it('should extract desktop device info', async () => {
        req.body.referralCode = 'TESTBIZ-123';
        req.get.mockImplementation((header) => {
          if (header === 'User-Agent') return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0.4472.124';
          return null;
        });

        ReferralTrackingService.trackReferral.mockResolvedValue({ success: true });

        await trackReferralMiddleware(req, res, next);

        const callArgs = ReferralTrackingService.trackReferral.mock.calls[0][2];
        expect(callArgs.deviceInfo).toEqual({
          type: 'desktop',
          browser: 'Chrome',
          os: 'Windows'
        });
      });

      it('should handle unknown user agent', async () => {
        req.body.referralCode = 'TESTBIZ-123';
        req.get.mockImplementation(() => null);

        ReferralTrackingService.trackReferral.mockResolvedValue({ success: true });

        await trackReferralMiddleware(req, res, next);

        const callArgs = ReferralTrackingService.trackReferral.mock.calls[0][2];
        expect(callArgs.deviceInfo.type).toBe('unknown');
      });
    });

    describe('Service Type Detection', () => {
      it('should detect flight service type', async () => {
        req.originalUrl = '/api/v1/products/book-flight';
        req.user.id = new mongoose.Types.ObjectId();

        ReferralTrackingService.attributeBooking.mockResolvedValue({ attributed: true });

        await attributeBookingMiddleware(req, res, next);

        const mockResponseData = {
          success: true,
          statusCode: 200,
          data: {
            bookingReference: 'BOOK-123456',
            totalAmount: 50000
          }
        };

        await res.json(mockResponseData);

        const callArgs = ReferralTrackingService.attributeBooking.mock.calls[0][0];
        expect(callArgs.serviceType).toBe('flight');
      });

      it('should detect hotel service type', async () => {
        req.originalUrl = '/api/v1/products/book-hotel';
        req.user.id = new mongoose.Types.ObjectId();

        ReferralTrackingService.attributeBooking.mockResolvedValue({ attributed: true });

        await attributeBookingMiddleware(req, res, next);

        const mockResponseData = {
          success: true,
          statusCode: 200,
          data: {
            bookingReference: 'HOTEL-123456',
            totalAmount: 30000
          }
        };

        await res.json(mockResponseData);

        const callArgs = ReferralTrackingService.attributeBooking.mock.calls[0][0];
        expect(callArgs.serviceType).toBe('hotel');
      });

      it('should detect insurance service type', async () => {
        req.originalUrl = '/api/v1/products/purchase-insurance';
        req.user.id = new mongoose.Types.ObjectId();

        ReferralTrackingService.attributeBooking.mockResolvedValue({ attributed: true });

        await attributeBookingMiddleware(req, res, next);

        const mockResponseData = {
          success: true,
          statusCode: 200,
          data: {
            reference: 'INS-123456',
            amount: 5000
          }
        };

        await res.json(mockResponseData);

        const callArgs = ReferralTrackingService.attributeBooking.mock.calls[0][0];
        expect(callArgs.serviceType).toBe('insurance');
      });
    });
  });
});