// v1/test/utils/errorMonitoring.test.js
const errorMonitor = require('../../utils/errorMonitoring');
const { 
  AffiliateError, 
  WalletError, 
  CommissionError, 
  WithdrawalError,
  QRCodeError 
} = require('../../utils/affiliateErrors');

// Mock logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

describe('ErrorMonitor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear error patterns for clean tests
    errorMonitor.errorPatterns.clear();
  });

  describe('logError', () => {
    it('should log affiliate error with proper categorization', () => {
      const error = new AffiliateError('Affiliate not found');
      const context = { affiliateId: 'AFF-123', userId: 'user123' };
      
      errorMonitor.logError(error, context, 'affiliate_lookup');
      
      expect(require('../../utils/logger').error).toHaveBeenCalledWith(
        'ERROR in affiliate system',
        expect.objectContaining({
          category: 'affiliate',
          operation: 'affiliate_lookup',
          message: 'Affiliate not found',
          severity: 'medium',
          statusCode: 400,
          errorCode: 'AFFILIATE_ERROR'
        })
      );
    });

    it('should log wallet error with wallet-specific information', () => {
      const error = new WalletError('Insufficient balance');
      const context = { affiliateId: 'AFF-123', walletId: 'WALLET-123', amount: 1000 };
      
      errorMonitor.logError(error, context, 'wallet_debit');
      
      expect(require('../../utils/logger').error).toHaveBeenCalledWith(
        'ERROR in affiliate system',
        expect.objectContaining({
          category: 'wallet',
          operation: 'wallet_debit',
          message: 'Insufficient balance',
          affiliateId: 'AFF-123',
          walletId: 'WALLET-123',
          amount: 1000
        })
      );
    });

    it('should log commission error with commission-specific information', () => {
      const error = new CommissionError('Commission calculation failed');
      const context = { 
        affiliateId: 'AFF-123', 
        commissionId: 'COMM-123', 
        bookingReference: 'BOOK-123' 
      };
      
      errorMonitor.logError(error, context, 'commission_calculation');
      
      expect(require('../../utils/logger').error).toHaveBeenCalledWith(
        'ERROR in affiliate system',
        expect.objectContaining({
          category: 'commission',
          operation: 'commission_calculation',
          message: 'Commission calculation failed',
          affiliateId: 'AFF-123',
          commissionId: 'COMM-123',
          bookingReference: 'BOOK-123'
        })
      );
    });

    it('should log withdrawal error with withdrawal-specific information', () => {
      const error = new WithdrawalError('Processing failed');
      const context = { 
        affiliateId: 'AFF-123', 
        withdrawalId: 'WD-123', 
        amount: 5000 
      };
      
      errorMonitor.logError(error, context, 'withdrawal_processing');
      
      expect(require('../../utils/logger').error).toHaveBeenCalledWith(
        'ERROR in affiliate system',
        expect.objectContaining({
          category: 'withdrawal',
          operation: 'withdrawal_processing',
          message: 'Processing failed',
          affiliateId: 'AFF-123',
          withdrawalId: 'WD-123',
          amount: 5000
        })
      );
    });

    it('should log QR code error with QR-specific information', () => {
      const error = new QRCodeError('Generation failed');
      const context = { qrType: 'affiliate' };
      
      errorMonitor.logError(error, context, 'qr_generation');
      
      expect(require('../../utils/logger').error).toHaveBeenCalledWith(
        'ERROR in affiliate system',
        expect.objectContaining({
          category: 'qrcode',
          operation: 'qr_generation',
          message: 'Generation failed',
          qrType: 'affiliate'
        })
      );
    });

    it('should log generic errors with default categorization', () => {
      const error = new Error('Generic error');
      error.statusCode = 500;
      
      errorMonitor.logError(error, {}, 'generic_operation');
      
      expect(require('../../utils/logger').error).toHaveBeenCalledWith(
        'CRITICAL ERROR in affiliate system',
        expect.objectContaining({
          category: 'general',
          operation: 'generic_operation',
          message: 'Generic error',
          severity: 'critical',
          statusCode: 500
        })
      );
    });
  });

  describe('determineSeverity', () => {
    it('should classify 5xx errors as critical', () => {
      const error = new Error('Server error');
      error.statusCode = 500;
      
      const severity = errorMonitor.determineSeverity(error);
      expect(severity).toBe('critical');
    });

    it('should classify wallet credit/debit errors as high priority', () => {
      const error = new WalletError('Credit failed');
      error.context = { operation: 'credit' };
      
      const severity = errorMonitor.determineSeverity(error);
      expect(severity).toBe('high');
    });

    it('should classify commission processing errors as high priority', () => {
      const error = new CommissionError('Processing failed');
      error.context = { operation: 'process' };
      
      const severity = errorMonitor.determineSeverity(error);
      expect(severity).toBe('high');
    });

    it('should classify withdrawal processing errors as high priority', () => {
      const error = new WithdrawalError('Processing failed');
      error.context = { operation: 'process' };
      
      const severity = errorMonitor.determineSeverity(error);
      expect(severity).toBe('high');
    });

    it('should classify 4xx errors as medium priority', () => {
      const error = new Error('Client error');
      error.statusCode = 400;
      
      const severity = errorMonitor.determineSeverity(error);
      expect(severity).toBe('medium');
    });

    it('should default to error level for unknown errors', () => {
      const error = new Error('Unknown error');
      
      const severity = errorMonitor.determineSeverity(error);
      expect(severity).toBe('error');
    });
  });

  describe('trackErrorPattern', () => {
    it('should track new error patterns', () => {
      const error = new AffiliateError('Test error');
      const errorInfo = {
        category: 'affiliate',
        errorCode: 'AFFILIATE_ERROR',
        operation: 'test_operation',
        errorId: 'ERR-123',
        timestamp: new Date().toISOString(),
        context: { test: 'data' }
      };
      
      errorMonitor.trackErrorPattern(errorInfo);
      
      const patternKey = 'affiliate:AFFILIATE_ERROR:test_operation';
      const pattern = errorMonitor.errorPatterns.get(patternKey);
      
      expect(pattern).toBeDefined();
      expect(pattern.count).toBe(1);
      expect(pattern.errors).toHaveLength(1);
      expect(pattern.errors[0].errorId).toBe('ERR-123');
    });

    it('should increment count for existing patterns', () => {
      const errorInfo = {
        category: 'wallet',
        errorCode: 'WALLET_ERROR',
        operation: 'credit',
        errorId: 'ERR-123',
        timestamp: new Date().toISOString(),
        context: {}
      };
      
      errorMonitor.trackErrorPattern(errorInfo);
      errorMonitor.trackErrorPattern({ ...errorInfo, errorId: 'ERR-124' });
      
      const patternKey = 'wallet:WALLET_ERROR:credit';
      const pattern = errorMonitor.errorPatterns.get(patternKey);
      
      expect(pattern.count).toBe(2);
      expect(pattern.errors).toHaveLength(2);
    });

    it('should limit stored errors to prevent memory leaks', () => {
      const errorInfo = {
        category: 'test',
        errorCode: 'TEST_ERROR',
        operation: 'test',
        timestamp: new Date().toISOString(),
        context: {}
      };
      
      // Add 150 errors (more than the 100 limit)
      for (let i = 0; i < 150; i++) {
        errorMonitor.trackErrorPattern({ ...errorInfo, errorId: `ERR-${i}` });
      }
      
      const patternKey = 'test:TEST_ERROR:test';
      const pattern = errorMonitor.errorPatterns.get(patternKey);
      
      expect(pattern.count).toBe(150);
      expect(pattern.errors).toHaveLength(100); // Should be limited to 100
      expect(pattern.errors[0].errorId).toBe('ERR-50'); // Should keep the last 100
    });
  });

  describe('checkAlertConditions', () => {
    beforeEach(() => {
      // Mock alert thresholds for testing
      errorMonitor.alertThresholds = {
        error: 3,
        warning: 2,
        critical: 1
      };
      errorMonitor.monitoringWindow = 60000; // 1 minute
    });

    it('should trigger alert when error threshold is exceeded', () => {
      const errorInfo = {
        category: 'affiliate',
        errorCode: 'AFFILIATE_ERROR',
        operation: 'test',
        severity: 'error',
        timestamp: new Date().toISOString()
      };
      
      // Add errors to exceed threshold
      for (let i = 0; i < 4; i++) {
        errorMonitor.trackErrorPattern({ ...errorInfo, errorId: `ERR-${i}` });
        errorMonitor.checkAlertConditions(errorInfo);
      }
      
      expect(require('../../utils/logger').error).toHaveBeenCalledWith(
        'ALERT: High frequency error pattern detected',
        expect.objectContaining({
          severity: 'error',
          category: 'affiliate',
          errorCode: 'AFFILIATE_ERROR',
          operation: 'test',
          errorCount: 4
        })
      );
    });

    it('should not trigger alert for old errors outside monitoring window', () => {
      const oldTimestamp = new Date(Date.now() - 2 * 60 * 1000).toISOString(); // 2 minutes ago
      const errorInfo = {
        category: 'affiliate',
        errorCode: 'AFFILIATE_ERROR',
        operation: 'test',
        severity: 'error',
        timestamp: oldTimestamp
      };
      
      // Add old errors
      for (let i = 0; i < 5; i++) {
        errorMonitor.trackErrorPattern({ ...errorInfo, errorId: `ERR-${i}` });
      }
      
      errorMonitor.checkAlertConditions(errorInfo);
      
      expect(require('../../utils/logger').error).not.toHaveBeenCalledWith(
        'ALERT: High frequency error pattern detected',
        expect.any(Object)
      );
    });
  });

  describe('sanitizeContext', () => {
    it('should remove sensitive fields from context', () => {
      const context = {
        userId: 'user123',
        password: 'secret123',
        token: 'jwt-token',
        accountNumber: '1234567890',
        normalField: 'normal-value'
      };
      
      const sanitized = errorMonitor.sanitizeContext(context);
      
      expect(sanitized.userId).toBe('user123');
      expect(sanitized.normalField).toBe('normal-value');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.token).toBe('[REDACTED]');
      expect(sanitized.accountNumber).toBe('[REDACTED]');
    });

    it('should handle non-object contexts', () => {
      expect(errorMonitor.sanitizeContext(null)).toBe(null);
      expect(errorMonitor.sanitizeContext('string')).toBe('string');
      expect(errorMonitor.sanitizeContext(123)).toBe(123);
    });
  });

  describe('getErrorStatistics', () => {
    beforeEach(() => {
      // Add some test error patterns
      const now = Date.now();
      const recentTimestamp = new Date(now - 30000).toISOString(); // 30 seconds ago
      
      const errors = [
        { category: 'affiliate', errorCode: 'AFFILIATE_ERROR', operation: 'lookup', count: 5 },
        { category: 'wallet', errorCode: 'WALLET_ERROR', operation: 'credit', count: 3 },
        { category: 'commission', errorCode: 'COMMISSION_ERROR', operation: 'calculate', count: 2 }
      ];
      
      errors.forEach(({ category, errorCode, operation, count }) => {
        const patternKey = `${category}:${errorCode}:${operation}`;
        const pattern = {
          count: count * 2, // Total count higher than recent
          firstOccurrence: now - 3600000, // 1 hour ago
          lastOccurrence: now,
          errors: Array(count).fill().map((_, i) => ({
            errorId: `ERR-${category}-${i}`,
            timestamp: recentTimestamp,
            context: {}
          }))
        };
        errorMonitor.errorPatterns.set(patternKey, pattern);
      });
    });

    it('should return comprehensive error statistics', () => {
      const stats = errorMonitor.getErrorStatistics({
        timeWindow: 60000 // 1 minute
      });
      
      expect(stats.totalErrors).toBe(10); // 5 + 3 + 2
      expect(stats.errorsByCategory).toEqual({
        affiliate: 5,
        wallet: 3,
        commission: 2
      });
      expect(stats.errorsByOperation).toEqual({
        lookup: 5,
        credit: 3,
        calculate: 2
      });
      expect(stats.topErrorPatterns).toHaveLength(3);
      expect(stats.topErrorPatterns[0].count).toBe(5); // Sorted by count
    });

    it('should filter by category when specified', () => {
      const stats = errorMonitor.getErrorStatistics({
        timeWindow: 60000,
        category: 'wallet'
      });
      
      expect(stats.totalErrors).toBe(3);
      expect(stats.errorsByCategory).toEqual({ wallet: 3 });
      expect(stats.topErrorPatterns).toHaveLength(1);
      expect(stats.topErrorPatterns[0].category).toBe('wallet');
    });

    it('should exclude old errors outside time window', () => {
      const stats = errorMonitor.getErrorStatistics({
        timeWindow: 10000 // 10 seconds (shorter than our test data)
      });
      
      expect(stats.totalErrors).toBe(0);
      expect(Object.keys(stats.errorsByCategory)).toHaveLength(0);
    });
  });

  describe('createErrorContext', () => {
    it('should create error context with operation and data', () => {
      const context = errorMonitor.createErrorContext('test_operation', {
        userId: 'user123',
        affiliateId: 'AFF-123'
      });
      
      expect(context.operation).toBe('test_operation');
      expect(context.userId).toBe('user123');
      expect(context.affiliateId).toBe('AFF-123');
      expect(context.timestamp).toBeDefined();
      expect(context.requestId).toBeDefined();
    });

    it('should use provided requestId if available', () => {
      const context = errorMonitor.createErrorContext('test_operation', {
        requestId: 'custom-request-id'
      });
      
      expect(context.requestId).toBe('custom-request-id');
    });
  });

  describe('generateErrorId', () => {
    it('should generate unique error IDs', () => {
      const id1 = errorMonitor.generateErrorId();
      const id2 = errorMonitor.generateErrorId();
      
      expect(id1).toMatch(/^ERR_[A-Z0-9_]+$/);
      expect(id2).toMatch(/^ERR_[A-Z0-9_]+$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('cleanupOldErrors', () => {
    it('should remove old error patterns', () => {
      const oldTimestamp = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // 25 hours ago
      const recentTimestamp = new Date().toISOString();
      
      // Add old pattern
      const oldPattern = {
        count: 5,
        firstOccurrence: Date.now() - 25 * 60 * 60 * 1000,
        lastOccurrence: Date.now() - 25 * 60 * 60 * 1000,
        errors: [{ errorId: 'ERR-OLD', timestamp: oldTimestamp, context: {} }]
      };
      errorMonitor.errorPatterns.set('old:ERROR:operation', oldPattern);
      
      // Add recent pattern
      const recentPattern = {
        count: 3,
        firstOccurrence: Date.now() - 60000,
        lastOccurrence: Date.now(),
        errors: [{ errorId: 'ERR-RECENT', timestamp: recentTimestamp, context: {} }]
      };
      errorMonitor.errorPatterns.set('recent:ERROR:operation', recentPattern);
      
      errorMonitor.cleanupOldErrors();
      
      expect(errorMonitor.errorPatterns.has('old:ERROR:operation')).toBe(false);
      expect(errorMonitor.errorPatterns.has('recent:ERROR:operation')).toBe(true);
    });
  });
});