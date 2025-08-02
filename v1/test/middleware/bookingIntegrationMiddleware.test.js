// v1/test/middleware/bookingIntegrationMiddleware.test.js
const {
  trackBookingReferralMiddleware,
  processBookingCommissionMiddleware,
  enhanceBookingConfirmationMiddleware
} = require('../../middleware/bookingIntegrationMiddleware');
const BookingIntegrationService = require('../../services/bookingIntegrationService');

// Mock the BookingIntegrationService
jest.mock('../../services/bookingIntegrationService');

describe('Booking Integration Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {},
      originalUrl: '/api/v1/products/flights/book',
      ip: '127.0.0.1',
      get: jest.fn(),
      query: {},
      user: { userId: 'user123' }
    };

    res = {
      json: jest.fn()
    };

    next = jest.fn();

    jest.clearAllMocks();
  });

  describe('trackBookingReferralMiddleware', () => {
    it('should track referral when referral code is provided', async () => {
      req.body = {
        referralCode: 'TRAVEL-TEST-123',
        passengerDetails: {
          email: 'john.doe@example.com'
        }
      };

      req.get.mockImplementation((header) => {
        if (header === 'User-Agent') return 'Test Agent';
        if (header === 'Referer') return 'https://example.com';
        return null;
      });

      const mockTrackingResult = {
        tracked: true,
        affiliate: { businessName: 'Test Agency' },
        isNew: true
      };

      BookingIntegrationService.processReferralTracking.mockResolvedValue(mockTrackingResult);

      await trackBookingReferralMiddleware(req, res, next);

      expect(BookingIntegrationService.processReferralTracking).toHaveBeenCalledWith(
        {
          referralCode: 'TRAVEL-TEST-123',
          serviceType: 'flight',
          bookingAmount: 0,
          currency: 'NGN'
        },
        {
          customerId: 'user123',
          customerEmail: 'john.doe@example.com'
        },
        expect.objectContaining({
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent',
          referrerUrl: 'https://example.com'
        })
      );

      expect(req.referralInfo).toEqual(mockTrackingResult);
      expect(next).toHaveBeenCalled();
    });

    it('should skip tracking when no referral code is provided', async () => {
      req.body = {
        passengerDetails: {
          email: 'john.doe@example.com'
        }
      };

      await trackBookingReferralMiddleware(req, res, next);

      expect(BookingIntegrationService.processReferralTracking).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('should handle tracking errors gracefully', async () => {
      req.body = {
        referralCode: 'TRAVEL-TEST-123',
        passengerDetails: {
          email: 'john.doe@example.com'
        }
      };

      BookingIntegrationService.processReferralTracking.mockRejectedValue(
        new Error('Tracking failed')
      );

      await trackBookingReferralMiddleware(req, res, next);

      expect(req.referralInfo).toEqual({
        tracked: false,
        error: 'Tracking failed'
      });
      expect(next).toHaveBeenCalled();
    });

    it('should determine service type from URL', async () => {
      const testCases = [
        { url: '/api/v1/products/flights/book', expected: 'flight' },
        { url: '/api/v1/products/hotels/book', expected: 'hotel' },
        { url: '/api/v1/products/travel-insurance/purchase/individual', expected: 'insurance' },
        { url: '/api/v1/products/visa/apply', expected: 'visa' },
        { url: '/api/v1/products/packages/123/purchase', expected: 'package' }
      ];

      for (const testCase of testCases) {
        req.originalUrl = testCase.url;
        req.body = {
          referralCode: 'TEST-CODE',
          customerDetails: { email: 'test@example.com' }
        };

        BookingIntegrationService.processReferralTracking.mockResolvedValue({
          tracked: true
        });

        await trackBookingReferralMiddleware(req, res, next);

        expect(BookingIntegrationService.processReferralTracking).toHaveBeenCalledWith(
          expect.objectContaining({
            serviceType: testCase.expected
          }),
          expect.any(Object),
          expect.any(Object)
        );
      }
    });

    it('should extract customer email from different request structures', async () => {
      const testCases = [
        {
          body: { customerDetails: { Email: 'test1@example.com' }, referralCode: 'TEST' },
          expected: 'test1@example.com'
        },
        {
          body: { customerDetails: { email: 'test2@example.com' }, referralCode: 'TEST' },
          expected: 'test2@example.com'
        },
        {
          body: { passengerDetails: { email: 'test3@example.com' }, referralCode: 'TEST' },
          expected: 'test3@example.com'
        },
        {
          body: { guestDetails: { email: 'test4@example.com' }, referralCode: 'TEST' },
          expected: 'test4@example.com'
        },
        {
          body: { 
            familyMembersDetails: [{ Email: 'test5@example.com' }], 
            referralCode: 'TEST' 
          },
          expected: 'test5@example.com'
        },
        {
          body: { guestEmail: 'test6@example.com', referralCode: 'TEST' },
          expected: 'test6@example.com'
        }
      ];

      for (const testCase of testCases) {
        req.body = testCase.body;

        BookingIntegrationService.processReferralTracking.mockResolvedValue({
          tracked: true
        });

        await trackBookingReferralMiddleware(req, res, next);

        expect(BookingIntegrationService.processReferralTracking).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({
            customerEmail: testCase.expected
          }),
          expect.any(Object)
        );
      }
    });
  });

  describe('processBookingCommissionMiddleware', () => {
    it('should process commission on successful payment verification', async () => {
      const originalJson = res.json;
      let interceptedData;

      // Mock successful payment verification response
      const mockResponse = {
        success: true,
        data: {
          transactionReference: 'TTP-FL-123',
          status: 'Completed'
        }
      };

      const mockCompletionResult = {
        processed: true,
        commission: {
          commissionAmount: 12500,
          affiliate: { businessName: 'Test Agency' }
        },
        qrCode: { data: 'qr-data' }
      };

      BookingIntegrationService.processBookingCompletion.mockResolvedValue(mockCompletionResult);

      req.originalUrl = '/api/v1/products/packages/verify-payment';

      await processBookingCommissionMiddleware(req, res, next);

      // Simulate calling the intercepted res.json
      await res.json(mockResponse);

      expect(BookingIntegrationService.processBookingCompletion).toHaveBeenCalledWith('TTP-FL-123');
      expect(mockResponse.data.referralInfo).toBeDefined();
      expect(mockResponse.data.referralInfo.commissionProcessed).toBe(true);
      expect(mockResponse.data.referralInfo.qrCode).toBeDefined();
    });

    it('should not process commission for non-verification endpoints', async () => {
      req.originalUrl = '/api/v1/products/flights/book';

      const mockResponse = {
        success: true,
        data: { reference: 'TTP-FL-123' }
      };

      await processBookingCommissionMiddleware(req, res, next);
      await res.json(mockResponse);

      expect(BookingIntegrationService.processBookingCompletion).not.toHaveBeenCalled();
    });

    it('should handle commission processing errors gracefully', async () => {
      req.originalUrl = '/api/v1/products/packages/verify-payment';

      const mockResponse = {
        success: true,
        data: { transactionReference: 'TTP-FL-123' }
      };

      BookingIntegrationService.processBookingCompletion.mockRejectedValue(
        new Error('Commission processing failed')
      );

      await processBookingCommissionMiddleware(req, res, next);
      await res.json(mockResponse);

      // Should not affect the response
      expect(mockResponse.data.referralInfo).toBeUndefined();
    });

    it('should extract transaction reference from different response structures', async () => {
      const testCases = [
        {
          response: { success: true, data: { transactionReference: 'REF1' } },
          expected: 'REF1'
        },
        {
          response: { success: true, data: { reference: 'REF2' } },
          expected: 'REF2'
        },
        {
          response: { success: true, data: { paymentReference: 'REF3' } },
          expected: 'REF3'
        }
      ];

      req.originalUrl = '/api/v1/products/packages/verify-payment';

      for (const testCase of testCases) {
        BookingIntegrationService.processBookingCompletion.mockResolvedValue({
          processed: true
        });

        await processBookingCommissionMiddleware(req, res, next);
        await res.json(testCase.response);

        expect(BookingIntegrationService.processBookingCompletion).toHaveBeenCalledWith(
          testCase.expected
        );
      }
    });
  });

  describe('enhanceBookingConfirmationMiddleware', () => {
    it('should enhance booking confirmation with referral info', async () => {
      req.body = { referralCode: 'TRAVEL-TEST-123' };
      req.referralInfo = {
        tracked: true,
        affiliate: { businessName: 'Test Agency' }
      };
      req.originalUrl = '/api/v1/products/flights/book';

      const mockResponse = {
        success: true,
        data: {
          authorizationUrl: 'https://checkout.paystack.com/test',
          reference: 'TTP-FL-123'
        }
      };

      await enhanceBookingConfirmationMiddleware(req, res, next);
      await res.json(mockResponse);

      expect(mockResponse.data.referralInfo).toBeDefined();
      expect(mockResponse.data.referralInfo.referralCode).toBe('TRAVEL-TEST-123');
      expect(mockResponse.data.referralInfo.affiliateBusinessName).toBe('Test Agency');
      expect(mockResponse.data.referralInfo.tracked).toBe(true);
    });

    it('should not enhance response when no referral code', async () => {
      req.body = {};
      req.originalUrl = '/api/v1/products/flights/book';

      const mockResponse = {
        success: true,
        data: { reference: 'TTP-FL-123' }
      };

      await enhanceBookingConfirmationMiddleware(req, res, next);
      await res.json(mockResponse);

      expect(mockResponse.data.referralInfo).toBeUndefined();
    });

    it('should not enhance response when referral not tracked', async () => {
      req.body = { referralCode: 'INVALID-CODE' };
      req.referralInfo = { tracked: false };
      req.originalUrl = '/api/v1/products/flights/book';

      const mockResponse = {
        success: true,
        data: { reference: 'TTP-FL-123' }
      };

      await enhanceBookingConfirmationMiddleware(req, res, next);
      await res.json(mockResponse);

      expect(mockResponse.data.referralInfo).toBeUndefined();
    });

    it('should identify booking initiation endpoints correctly', async () => {
      const bookingEndpoints = [
        '/api/v1/products/flights/book',
        '/api/v1/products/hotels/book',
        '/api/v1/products/travel-insurance/purchase/individual',
        '/api/v1/products/packages/123/purchase',
        '/api/v1/products/visa/apply'
      ];

      const nonBookingEndpoints = [
        '/api/v1/products/flights/search',
        '/api/v1/products/packages/verify-payment',
        '/api/v1/products/visa/123/status'
      ];

      req.body = { referralCode: 'TEST-CODE' };
      req.referralInfo = { tracked: true, affiliate: { businessName: 'Test' } };

      // Test booking endpoints
      for (const endpoint of bookingEndpoints) {
        req.originalUrl = endpoint;
        const mockResponse = {
          success: true,
          data: { authorizationUrl: 'https://test.com' }
        };

        await enhanceBookingConfirmationMiddleware(req, res, next);
        await res.json(mockResponse);

        expect(mockResponse.data.referralInfo).toBeDefined();
      }

      // Test non-booking endpoints
      for (const endpoint of nonBookingEndpoints) {
        req.originalUrl = endpoint;
        const mockResponse = {
          success: true,
          data: { result: 'success' }
        };

        await enhanceBookingConfirmationMiddleware(req, res, next);
        await res.json(mockResponse);

        expect(mockResponse.data.referralInfo).toBeUndefined();
      }
    });

    it('should handle enhancement errors gracefully', async () => {
      req.body = { referralCode: 'TRAVEL-TEST-123' };
      req.referralInfo = {
        tracked: true,
        affiliate: { businessName: 'Test Agency' }
      };
      req.originalUrl = '/api/v1/products/flights/book';

      // Mock response with no data property to cause error
      const mockResponse = { success: true };

      await enhanceBookingConfirmationMiddleware(req, res, next);
      
      // Should not throw error
      expect(() => res.json(mockResponse)).not.toThrow();
    });
  });

  describe('Helper Functions', () => {
    it('should extract device info from user agent', async () => {
      const testCases = [
        {
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
          expected: { type: 'mobile', browser: 'Safari', os: 'iOS' }
        },
        {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124',
          expected: { type: 'desktop', browser: 'Chrome', os: 'Windows' }
        },
        {
          userAgent: 'Mozilla/5.0 (Android 11; Mobile; rv:89.0) Gecko/89.0 Firefox/89.0',
          expected: { type: 'mobile', browser: 'Firefox', os: 'Android' }
        }
      ];

      for (const testCase of testCases) {
        req.body = { referralCode: 'TEST-CODE', customerDetails: { email: 'test@example.com' } };
        req.get.mockImplementation((header) => {
          if (header === 'User-Agent') return testCase.userAgent;
          return null;
        });

        BookingIntegrationService.processReferralTracking.mockResolvedValue({ tracked: true });

        await trackBookingReferralMiddleware(req, res, next);

        expect(BookingIntegrationService.processReferralTracking).toHaveBeenCalledWith(
          expect.any(Object),
          expect.any(Object),
          expect.objectContaining({
            deviceInfo: expect.objectContaining(testCase.expected)
          })
        );
      }
    });

    it('should extract UTM parameters from query string', async () => {
      req.body = { referralCode: 'TEST-CODE', customerDetails: { email: 'test@example.com' } };
      req.query = {
        utm_source: 'google',
        utm_medium: 'cpc',
        utm_campaign: 'summer_sale',
        utm_term: 'travel',
        utm_content: 'ad1'
      };

      BookingIntegrationService.processReferralTracking.mockResolvedValue({ tracked: true });

      await trackBookingReferralMiddleware(req, res, next);

      expect(BookingIntegrationService.processReferralTracking).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        expect.objectContaining({
          utmParameters: {
            utm_source: 'google',
            utm_medium: 'cpc',
            utm_campaign: 'summer_sale',
            utm_term: 'travel',
            utm_content: 'ad1'
          }
        })
      );
    });
  });
});