// v1/test/middleware/affiliateErrorHandler.test.js
const { StatusCodes } = require('http-status-codes');
const affiliateErrorHandler = require('../../middleware/affiliateErrorHandler');
const { 
  AffiliateError, 
  WalletError, 
  CommissionError, 
  WithdrawalError,
  QRCodeError 
} = require('../../utils/affiliateErrors');
const { ApiError } = require('../../utils/apiError');

// Mock dependencies
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

jest.mock('../../utils/errorMonitoring', () => ({
  logError: jest.fn()
}));

describe('affiliateErrorHandler', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      method: 'POST',
      originalUrl: '/api/v1/affiliate/register',
      get: jest.fn().mockReturnValue('Mozilla/5.0'),
      ip: '127.0.0.1',
      user: { id: 'user123' },
      affiliate: { affiliateId: 'AFF-123' },
      body: { businessName: 'Test Business' },
      params: { id: 'param123' },
      query: { filter: 'active' },
      requestId: 'req-123',
      route: { path: '/api/v1/affiliate/register' }
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    next = jest.fn();

    jest.clearAllMocks();
  });

  describe('AffiliateError handling', () => {
    it('should handle affiliate not found error', () => {
      const error = AffiliateError.notFound('AFF-123');
      
      affiliateErrorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(StatusCodes.NOT_FOUND);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Affiliate Not Found',
          message: 'Affiliate with ID AFF-123 not found',
          statusCode: StatusCodes.NOT_FOUND,
          code: 'AFFILIATE_ERROR',
          suggestions: expect.arrayContaining([
            'Verify the affiliate ID is correct',
            'Check if the affiliate account exists',
            'Contact support if the issue persists'
          ])
        })
      );
    });

    it('should handle affiliate access denied error', () => {
      const error = AffiliateError.notApproved('AFF-123', 'pending');
      
      affiliateErrorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(StatusCodes.FORBIDDEN);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Affiliate Access Denied',
          suggestions: expect.arrayContaining([
            'Ensure affiliate account is approved and active',
            'Check account status with administrator',
            'Review terms and conditions compliance'
          ])
        })
      );
    });

    it('should handle affiliate conflict error', () => {
      const error = AffiliateError.alreadyExists('business@example.com');
      
      affiliateErrorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(StatusCodes.CONFLICT);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Affiliate Conflict',
          suggestions: expect.arrayContaining([
            'Check for duplicate registration attempts',
            'Verify business information is unique',
            'Contact support for account recovery'
          ])
        })
      );
    });

    it('should handle affiliate validation errors', () => {
      const validationErrors = ['Business name is required', 'Invalid email format'];
      const error = AffiliateError.registrationValidation(validationErrors);
      
      affiliateErrorHandler(error, req, res, next);
      
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          validationErrors,
          suggestions: expect.arrayContaining([
            'Review and correct the validation errors',
            'Ensure all required fields are provided',
            'Check data format requirements'
          ])
        })
      );
    });
  });

  describe('WalletError handling', () => {
    it('should handle insufficient balance error', () => {
      const error = WalletError.insufficientBalance(1000, 500, 'NGN');
      
      affiliateErrorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Wallet Error',
          walletInfo: {
            requestedAmount: 1000,
            availableBalance: 500,
            currency: 'NGN'
          },
          suggestions: expect.arrayContaining([
            'Check wallet balance before making transactions',
            'Ensure transaction amounts are positive',
            'Verify wallet is not frozen or suspended'
          ])
        })
      );
    });

    it('should handle wallet conflict error', () => {
      const error = WalletError.concurrentModification('WALLET-123');
      
      affiliateErrorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(StatusCodes.CONFLICT);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Wallet Error',
          suggestions: expect.arrayContaining([
            'Avoid concurrent wallet operations',
            'Retry the operation after a short delay',
            'Contact support if the issue persists'
          ])
        })
      );
    });
  });

  describe('CommissionError handling', () => {
    it('should handle commission conflict error', () => {
      const error = CommissionError.duplicate('BOOK-123', 'AFF-123');
      
      affiliateErrorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(StatusCodes.CONFLICT);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Commission Error',
          bookingReference: 'BOOK-123',
          suggestions: expect.arrayContaining([
            'Check if commission already exists for this booking',
            'Verify booking reference is correct',
            'Contact support for commission disputes'
          ])
        })
      );
    });

    it('should handle commission processing error', () => {
      const error = CommissionError.processingFailed('COMM-123', 'calculation', 'Invalid rate');
      
      affiliateErrorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Commission Error',
          suggestions: expect.arrayContaining([
            'Commission calculation will be retried automatically',
            'Check booking details are complete',
            'Contact support if the issue persists'
          ])
        })
      );
    });
  });

  describe('WithdrawalError handling', () => {
    it('should handle withdrawal validation error', () => {
      const validationErrors = ['Invalid account number', 'Bank code is required'];
      const error = WithdrawalError.bankDetailsValidation(validationErrors);
      
      affiliateErrorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Withdrawal Error',
          validationErrors,
          suggestions: expect.arrayContaining([
            'Ensure withdrawal amount meets minimum requirements',
            'Verify bank details are correct and complete',
            'Check wallet has sufficient balance'
          ])
        })
      );
    });

    it('should handle withdrawal conflict error', () => {
      const error = WithdrawalError.pendingWithdrawalExists('AFF-123');
      
      affiliateErrorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(StatusCodes.CONFLICT);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Withdrawal Error',
          suggestions: expect.arrayContaining([
            'Complete or cancel existing withdrawal request',
            'Wait for current withdrawal to process',
            'Contact support for withdrawal status'
          ])
        })
      );
    });

    it('should include withdrawal context information', () => {
      const error = new WithdrawalError('Processing failed');
      error.context = { withdrawalId: 'WD-123', amount: 5000 };
      
      affiliateErrorHandler(error, req, res, next);
      
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          withdrawalId: 'WD-123',
          amount: 5000,
          currency: 'NGN'
        })
      );
    });
  });

  describe('QRCodeError handling', () => {
    it('should handle expired QR code error', () => {
      const error = QRCodeError.expired('QR-123', new Date());
      
      affiliateErrorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(StatusCodes.GONE);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'QR Code Error',
          suggestions: expect.arrayContaining([
            'Generate a new QR code',
            'Check QR code expiration settings',
            'Use the latest QR code provided'
          ])
        })
      );
    });

    it('should handle invalid QR code error', () => {
      const error = QRCodeError.invalid('corrupted-data');
      
      affiliateErrorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'QR Code Error',
          suggestions: expect.arrayContaining([
            'Ensure QR code data is not corrupted',
            'Scan QR code with proper lighting',
            'Generate a new QR code if needed'
          ])
        })
      );
    });
  });

  describe('ApiError handling', () => {
    it('should handle generic API errors', () => {
      const error = new ApiError('Generic API error', StatusCodes.BAD_REQUEST, ['error1'], 'API_ERROR');
      
      affiliateErrorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'ApiError',
          message: 'Generic API error',
          statusCode: StatusCodes.BAD_REQUEST,
          code: 'API_ERROR',
          errors: ['error1']
        })
      );
    });
  });

  describe('Generic error handling', () => {
    it('should handle unknown errors safely', () => {
      const error = new Error('Unknown error');
      
      affiliateErrorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Internal Server Error',
          message: 'An unexpected error occurred. Please try again later.',
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          code: 'INTERNAL_SERVER_ERROR',
          suggestions: expect.arrayContaining([
            'Try the operation again after a short delay',
            'Check if the service is temporarily unavailable',
            'Contact support if the issue persists'
          ])
        })
      );
    });
  });

  describe('Error monitoring integration', () => {
    it('should call error monitor with proper context', () => {
      const error = new AffiliateError('Test error');
      const errorMonitor = require('../../utils/errorMonitoring');
      
      affiliateErrorHandler(error, req, res, next);
      
      expect(errorMonitor.logError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          method: 'POST',
          url: '/api/v1/affiliate/register',
          userAgent: 'Mozilla/5.0',
          ip: '127.0.0.1',
          userId: 'user123',
          affiliateId: 'AFF-123',
          requestId: 'req-123'
        }),
        'affiliate_post',
        expect.objectContaining({
          body: { businessName: 'Test Business' },
          params: { id: 'param123' },
          query: { filter: 'active' }
        })
      );
    });

    it('should sanitize sensitive data in request body', () => {
      const error = new AffiliateError('Test error');
      const errorMonitor = require('../../utils/errorMonitoring');
      
      req.body = {
        businessName: 'Test Business',
        password: 'secret123',
        accountNumber: '1234567890'
      };
      
      affiliateErrorHandler(error, req, res, next);
      
      expect(errorMonitor.logError).toHaveBeenCalledWith(
        error,
        expect.any(Object),
        expect.any(String),
        expect.objectContaining({
          body: {
            businessName: 'Test Business',
            password: '[REDACTED]',
            accountNumber: '[REDACTED]'
          }
        })
      );
    });
  });

  describe('Response format', () => {
    it('should include correlation ID and timestamp in all responses', () => {
      const error = new AffiliateError('Test error');
      
      affiliateErrorHandler(error, req, res, next);
      
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          correlationId: 'req-123',
          timestamp: expect.any(String)
        })
      );
    });

    it('should extract operation name from different route patterns', () => {
      const testCases = [
        { path: '/api/v1/affiliate/register', method: 'POST', expected: 'affiliate_registration' },
        { path: '/api/v1/wallet/credit', method: 'POST', expected: 'wallet_credit' },
        { path: '/api/v1/commission/calculate', method: 'POST', expected: 'commission_calculation' },
        { path: '/api/v1/withdrawal', method: 'POST', expected: 'withdrawal_request' },
        { path: '/api/v1/qr', method: 'POST', expected: 'qr_generation' }
      ];

      testCases.forEach(({ path, method, expected }) => {
        req.route.path = path;
        req.method = method;
        const error = new AffiliateError('Test error');
        const errorMonitor = require('../../utils/errorMonitoring');
        
        affiliateErrorHandler(error, req, res, next);
        
        expect(errorMonitor.logError).toHaveBeenCalledWith(
          error,
          expect.any(Object),
          expected,
          expect.any(Object)
        );
      });
    });

    it('should handle missing route information gracefully', () => {
      delete req.route;
      req.path = '/unknown/path';
      
      const error = new AffiliateError('Test error');
      const errorMonitor = require('../../utils/errorMonitoring');
      
      affiliateErrorHandler(error, req, res, next);
      
      expect(errorMonitor.logError).toHaveBeenCalledWith(
        error,
        expect.any(Object),
        'post_/unknown/path',
        expect.any(Object)
      );
    });
  });

  describe('Suggestion generation', () => {
    it('should generate appropriate suggestions for different status codes', () => {
      const testCases = [
        { statusCode: StatusCodes.BAD_REQUEST, expectedSuggestion: 'Check request parameters and format' },
        { statusCode: StatusCodes.UNAUTHORIZED, expectedSuggestion: 'Ensure you are properly authenticated' },
        { statusCode: StatusCodes.FORBIDDEN, expectedSuggestion: 'Verify you have permission for this operation' },
        { statusCode: StatusCodes.NOT_FOUND, expectedSuggestion: 'Verify the resource identifier is correct' },
        { statusCode: StatusCodes.CONFLICT, expectedSuggestion: 'Check for duplicate or conflicting data' },
        { statusCode: StatusCodes.TOO_MANY_REQUESTS, expectedSuggestion: 'Reduce request frequency' }
      ];

      testCases.forEach(({ statusCode, expectedSuggestion }) => {
        const error = new ApiError('Test error', statusCode);
        
        affiliateErrorHandler(error, req, res, next);
        
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            suggestions: expect.arrayContaining([expectedSuggestion])
          })
        );
      });
    });
  });
});