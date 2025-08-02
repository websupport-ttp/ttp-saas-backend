// v1/test/errorHandling.comprehensive.test.js
const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { 
  ApiError, 
  ValidationError, 
  AuthenticationError, 
  AuthorizationError,
  ThirdPartyServiceError,
  DatabaseError 
} = require('../utils/apiError');
const ErrorLog = require('../models/errorLogModel');
const { circuitBreakerManager } = require('../utils/circuitBreaker');
const { retryManager, fallbackManager } = require('../utils/errorRecovery');
const { errorHandler } = require('../middleware/errorHandler');

// Create a test app with error handling
const createTestApp = () => {
  const testApp = express();
  testApp.use(express.json());
  
  // Add test routes
  testApp.get('/test/validation-error', (req, res, next) => {
    const error = new ValidationError('Validation failed', [
      'Email is required',
      'Password must be at least 8 characters'
    ], { field: 'email' });
    next(error);
  });

  testApp.get('/test/auth-error', (req, res, next) => {
    const error = new AuthenticationError('Token expired', { tokenExpired: true });
    next(error);
  });

  testApp.get('/test/third-party-error', (req, res, next) => {
    const error = new ThirdPartyServiceError('PaymentService', 'processPayment', 
      new Error('Connection refused'), { retryable: true });
    next(error);
  });

  testApp.get('/test/database-error', (req, res, next) => {
    const error = new DatabaseError('findUser', new Error('Connection timeout'));
    next(error);
  });

  testApp.get('/test/logged-error', (req, res, next) => {
    const error = new ValidationError('Test validation error', ['Field required']);
    next(error);
  });

  testApp.get('/test/duplicate-error', (req, res, next) => {
    const error = new ApiError('Duplicate error test', 500);
    next(error);
  });

  testApp.post('/test/mongoose-validation', (req, res, next) => {
    const error = new Error('Validation failed');
    error.name = 'ValidationError';
    error.errors = {
      email: { message: 'Email is required', value: undefined },
      password: { message: 'Password is too short', value: '123' }
    };
    next(error);
  });

  testApp.post('/test/mongoose-duplicate', (req, res, next) => {
    const error = new Error('Duplicate key error');
    error.code = 11000;
    error.keyValue = { email: 'test@example.com' };
    next(error);
  });

  testApp.get('/test/mongoose-cast-error', (req, res, next) => {
    const error = new Error('Cast error');
    error.name = 'CastError';
    error.path = '_id';
    error.value = 'invalid-id';
    error.kind = 'ObjectId';
    next(error);
  });

  testApp.get('/test/jwt-expired', (req, res, next) => {
    const error = new Error('jwt expired');
    error.name = 'TokenExpiredError';
    error.expiredAt = new Date();
    next(error);
  });

  testApp.get('/test/jwt-invalid', (req, res, next) => {
    const error = new Error('invalid token');
    error.name = 'JsonWebTokenError';
    next(error);
  });

  testApp.post('/test/file-size-error', (req, res, next) => {
    const error = new Error('File too large');
    error.code = 'LIMIT_FILE_SIZE';
    error.limit = 1048576; // 1MB
    error.received = 2097152; // 2MB
    next(error);
  });

  testApp.post('/test/file-count-error', (req, res, next) => {
    const error = new Error('Too many files');
    error.code = 'LIMIT_FILE_COUNT';
    error.limit = 5;
    error.received = 10;
    next(error);
  });

  testApp.get('/test/rate-limit', (req, res, next) => {
    const error = new ApiError('Too many requests', 429, [], 'RATE_LIMIT_ERROR', {
      retryAfter: 120,
      limit: 100,
      remaining: 0,
      retryable: true
    });
    next(error);
  });

  testApp.get('/test/dev-error', (req, res, next) => {
    const error = new Error('Development error');
    error.stack = 'Error stack trace...';
    next(error);
  });

  testApp.get('/test/prod-error', (req, res, next) => {
    const error = new Error('Internal server error');
    error.stack = 'Sensitive stack trace...';
    next(error);
  });

  testApp.get('/test/retryable-error', (req, res, next) => {
    const error = new ThirdPartyServiceError('ExternalAPI', 'getData', 
      new Error('Timeout'), { 
        retryable: true, 
        recovery: 'Please try again in a few moments' 
      });
    next(error);
  });

  testApp.get('/test/circuit-breaker', (req, res, next) => {
    const error = new Error('Circuit breaker is OPEN');
    error.circuitBreakerOpen = true;
    error.nextRetryTime = Date.now() + 60000;
    next(error);
  });

  testApp.get('/test/handler-error', (req, res, next) => {
    const error = new Error('Original error');
    next(error);
  });

  testApp.get('/test/malformed-error', (req, res, next) => {
    const error = {};
    error.message = null;
    error.stack = undefined;
    next(error);
  });

  testApp.get('/test/error-context', (req, res, next) => {
    req.user = { userId: 'test-user-123' };
    req.id = 'req-123';
    const error = new ApiError('Context test error');
    next(error);
  });

  // Add error handler
  testApp.use(errorHandler);
  
  return testApp;
};

describe('Comprehensive Error Handling Tests', () => {
  let testApp;

  beforeAll(async () => {
    // Ensure test database connection
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI_TEST || 'mongodb://localhost:27017/travel-place-test');
    }
  });

  afterAll(async () => {
    // Clean up test data
    await ErrorLog.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Create fresh test app for each test
    testApp = createTestApp();
    
    // Clear error logs before each test
    await ErrorLog.deleteMany({});
    
    // Reset circuit breakers
    circuitBreakerManager.resetAll();
  });

  describe('Error Classification and Response Formatting', () => {
    test('should handle ValidationError with proper response format', async () => {
      const response = await request(testApp)
        .get('/test/validation-error')
        .expect(400);

      expect(response.body).toMatchObject({
        status: 'fail',
        message: 'Validation failed',
        errors: [
          'Email is required',
          'Password must be at least 8 characters'
        ]
      });

      expect(response.body.timestamp).toBeDefined();
      expect(response.body.debug?.errorId).toBeDefined();
      expect(response.body.debug?.errorCode).toBe('VALIDATION_ERROR');
    });

    test('should handle AuthenticationError with proper response format', async () => {
      const response = await request(testApp)
        .get('/test/auth-error')
        .expect(401);

      expect(response.body).toMatchObject({
        status: 'fail',
        message: 'Token expired'
      });

      expect(response.body.debug?.errorCode).toBe('AUTHENTICATION_ERROR');
    });

    test('should handle ThirdPartyServiceError with circuit breaker information', async () => {
      const response = await request(testApp)
        .get('/test/third-party-error')
        .expect(502);

      expect(response.body).toMatchObject({
        status: 'error',
        message: 'PaymentService service error during processPayment'
      });

      expect(response.body.debug?.errorCode).toBe('THIRD_PARTY_SERVICE_ERROR');
      expect(response.body.retryable).toBe(true);
    });

    test('should handle DatabaseError with proper classification', async () => {
      const response = await request(testApp)
        .get('/test/database-error')
        .expect(500);

      expect(response.body).toMatchObject({
        status: 'error',
        message: 'Database error during findUser'
      });

      expect(response.body.debug?.errorCode).toBe('DATABASE_ERROR');
    });
  });

  describe('Error Logging and Tracking', () => {
    test('should log errors to database with proper classification', async () => {
      await request(testApp)
        .get('/test/logged-error')
        .expect(400);

      // Check if error was logged to database
      const errorLogs = await ErrorLog.find({});
      expect(errorLogs).toHaveLength(1);

      const errorLog = errorLogs[0];
      expect(errorLog.message).toBe('Test validation error');
      expect(errorLog.errorCode).toBe('VALIDATION_ERROR');
      expect(errorLog.classification.category).toBe('validation');
      expect(errorLog.classification.severity).toBe('low');
      expect(errorLog.context.endpoint).toBe('/test/logged-error');
      expect(errorLog.context.method).toBe('GET');
    });

    test('should track duplicate errors with occurrence count', async () => {
      // Make the same request multiple times
      await request(testApp).get('/test/duplicate-error').expect(500);
      await request(testApp).get('/test/duplicate-error').expect(500);
      await request(testApp).get('/test/duplicate-error').expect(500);

      const errorLogs = await ErrorLog.find({});
      expect(errorLogs).toHaveLength(1);

      const errorLog = errorLogs[0];
      expect(errorLog.occurrenceCount).toBe(3);
      expect(errorLog.firstOccurrence).toBeDefined();
      expect(errorLog.lastOccurrence).toBeDefined();
    });

    test('should provide error statistics', async () => {
      // Create various types of errors
      await ErrorLog.create([
        {
          errorId: 'ERR_001',
          level: 'error',
          message: 'Critical error',
          classification: { category: 'database', severity: 'critical' }
        },
        {
          errorId: 'ERR_002',
          level: 'warn',
          message: 'Warning error',
          classification: { category: 'validation', severity: 'low' }
        },
        {
          errorId: 'ERR_003',
          level: 'error',
          message: 'High severity error',
          classification: { category: 'external_service', severity: 'high' }
        }
      ]);

      const stats = await ErrorLog.getErrorStats();
      expect(stats.totalErrors).toBe(3);
      expect(stats.unresolvedErrors).toBe(3);
      expect(stats.criticalErrors).toBe(1);
      expect(stats.highSeverityErrors).toBe(1);
    });
  });

  describe('Mongoose Error Handling', () => {
    test('should handle Mongoose validation errors', async () => {
      const response = await request(testApp)
        .post('/test/mongoose-validation')
        .expect(400);

      expect(response.body.message).toBe('Validation failed');
      expect(response.body.errors).toContain('Email is required');
      expect(response.body.errors).toContain('Password is too short');
    });

    test('should handle Mongoose duplicate key errors', async () => {
      const response = await request(testApp)
        .post('/test/mongoose-duplicate')
        .expect(400);

      expect(response.body.message).toContain('email \'test@example.com\' already exists');
    });

    test('should handle Mongoose CastError', async () => {
      const response = await request(testApp)
        .get('/test/mongoose-cast-error')
        .expect(400);

      expect(response.body.message).toBe('Invalid _id: invalid-id');
    });
  });

  describe('JWT Error Handling', () => {
    test('should handle JWT token expired error', async () => {
      const response = await request(testApp)
        .get('/test/jwt-expired')
        .expect(401);

      expect(response.body.message).toBe('Your session has expired. Please log in again.');
    });

    test('should handle JWT invalid token error', async () => {
      const response = await request(testApp)
        .get('/test/jwt-invalid')
        .expect(401);

      expect(response.body.message).toBe('Invalid authentication token. Please log in again.');
    });
  });

  describe('File Upload Error Handling', () => {
    test('should handle file size limit error', async () => {
      const response = await request(testApp)
        .post('/test/file-size-error')
        .expect(400);

      expect(response.body.message).toBe('File size too large. Please upload a smaller file.');
    });

    test('should handle file count limit error', async () => {
      const response = await request(testApp)
        .post('/test/file-count-error')
        .expect(400);

      expect(response.body.message).toBe('Too many files uploaded. Please reduce the number of files.');
    });
  });

  describe('Rate Limiting Error Handling', () => {
    test('should handle rate limit errors with retry information', async () => {
      const response = await request(testApp)
        .get('/test/rate-limit')
        .expect(429);

      expect(response.body.message).toBe('Too many requests');
      expect(response.body.retryable).toBe(true);
      expect(response.body.retryAfter).toBe(120);
      expect(response.headers['retry-after']).toBe('120');
    });
  });

  describe('Production vs Development Error Responses', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    test('should include debug information in development', async () => {
      process.env.NODE_ENV = 'development';

      const response = await request(testApp)
        .get('/test/dev-error')
        .expect(500);

      expect(response.body.debug).toBeDefined();
      expect(response.body.debug.stack).toBeDefined();
    });

    test('should hide sensitive information in production', async () => {
      process.env.NODE_ENV = 'production';

      const response = await request(testApp)
        .get('/test/prod-error')
        .expect(500);

      expect(response.body.message).toBe('An unexpected error occurred. Please try again later.');
      expect(response.body.debug).toBeUndefined();
    });
  });

  describe('Error Recovery Mechanisms', () => {
    test('should provide recovery suggestions for retryable errors', async () => {
      const response = await request(testApp)
        .get('/test/retryable-error')
        .expect(502);

      expect(response.body.retryable).toBe(true);
      expect(response.body.recovery).toBe('Please try again in a few moments');
    });

    test('should handle circuit breaker open state', async () => {
      const response = await request(testApp)
        .get('/test/circuit-breaker')
        .expect(500);

      expect(response.headers['x-circuit-breaker']).toBe('OPEN');
    });
  });

  describe('Error Handler Resilience', () => {
    test('should handle errors in error handler gracefully', async () => {
      // Mock ErrorLog.logError to throw an error
      const originalLogError = ErrorLog.logError;
      ErrorLog.logError = jest.fn().mockRejectedValue(new Error('Database logging failed'));

      const response = await request(testApp)
        .get('/test/handler-error')
        .expect(500);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toBeDefined();

      // Restore original function
      ErrorLog.logError = originalLogError;
    });

    test('should handle malformed error objects', async () => {
      const response = await request(testApp)
        .get('/test/malformed-error')
        .expect(500);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('An unexpected error occurred');
    });
  });

  describe('Error Context and Metadata', () => {
    test('should capture comprehensive error context', async () => {
      await request(testApp)
        .get('/test/error-context')
        .set('User-Agent', 'Test Agent')
        .expect(500);

      const errorLogs = await ErrorLog.find({});
      expect(errorLogs).toHaveLength(1);

      const errorLog = errorLogs[0];
      expect(errorLog.context.userId).toBe('test-user-123');
      expect(errorLog.context.requestId).toBe('req-123');
      expect(errorLog.context.userAgent).toBe('Test Agent');
      expect(errorLog.context.method).toBe('GET');
      expect(errorLog.context.endpoint).toBe('/test/error-context');
    });
  });
});

describe('Error Recovery Utilities Tests', () => {
  describe('RetryManager', () => {
    test('should retry failed operations with exponential backoff', async () => {
      let attempts = 0;
      const failingFunction = jest.fn(() => {
        attempts++;
        if (attempts <= 2) { // Fail on attempts 1 and 2, succeed on attempt 3
          const error = new Error('Temporary failure');
          error.statusCode = 500; // Make it retryable
          throw error;
        }
        return 'success';
      });

      const result = await retryManager.executeWithRetry(failingFunction, {
        maxRetries: 2 // This means 3 total attempts (initial + 2 retries)
      });

      expect(result).toBe('success');
      expect(failingFunction).toHaveBeenCalledTimes(3);
    });

    test('should not retry non-retryable errors', async () => {
      const validationError = new ValidationError('Invalid input');
      const failingFunction = jest.fn(() => {
        throw validationError;
      });

      await expect(
        retryManager.executeWithRetry(failingFunction, { maxRetries: 3 })
      ).rejects.toThrow('Invalid input');

      expect(failingFunction).toHaveBeenCalledTimes(1);
    });
  });

  describe('FallbackManager', () => {
    test('should execute fallback when primary operation fails', async () => {
      const primaryFn = jest.fn().mockRejectedValue(new Error('Primary failed'));
      const fallbackFn = jest.fn().mockResolvedValue('fallback result');

      fallbackManager.registerFallback('testOperation', fallbackFn);

      const result = await fallbackManager.executeWithFallback(
        'testOperation',
        primaryFn
      );

      expect(result).toBe('fallback result');
      expect(primaryFn).toHaveBeenCalledTimes(1);
      expect(fallbackFn).toHaveBeenCalledTimes(1);
    });

    test('should not execute fallback if not registered', async () => {
      const primaryFn = jest.fn().mockRejectedValue(new Error('Primary failed'));

      await expect(
        fallbackManager.executeWithFallback('unknownOperation', primaryFn)
      ).rejects.toThrow('Primary failed');

      expect(primaryFn).toHaveBeenCalledTimes(1);
    });
  });
});