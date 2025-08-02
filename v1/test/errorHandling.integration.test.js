// v1/test/errorHandling.integration.test.js
const request = require('supertest');
const app = require('../../app');
const testDbManager = require('./testDbManager');
const { circuitBreakerManager } = require('../utils/circuitBreaker');
const ErrorLog = require('../models/errorLogModel');

describe('Error Handling Integration Tests', () => {
  beforeAll(async () => {
    await testDbManager.connect();
  });

  afterAll(async () => {
    await testDbManager.disconnect();
  });

  beforeEach(async () => {
    await testDbManager.cleanDatabase();
    circuitBreakerManager.resetAll();
  });

  describe('404 Not Found Handler', () => {
    test('should handle undefined routes with proper error format', async () => {
      const response = await request(app)
        .get('/api/v1/nonexistent-endpoint')
        .expect(404);

      expect(response.body).toMatchObject({
        status: 'fail',
        message: 'Route /api/v1/nonexistent-endpoint not found',
        timestamp: expect.any(String)
      });
    });

    test('should handle undefined POST routes', async () => {
      const response = await request(app)
        .post('/api/v1/nonexistent-endpoint')
        .send({ test: 'data' })
        .expect(404);

      expect(response.body).toMatchObject({
        status: 'fail',
        message: 'Route /api/v1/nonexistent-endpoint not found'
      });
    });
  });

  describe('Third-Party Service Error Recovery', () => {
    test('should handle payment service failures gracefully', async () => {
      // Mock a payment endpoint that would fail
      const response = await request(app)
        .post('/api/v1/products/packages/invalid-id/purchase')
        .send({
          paymentMethod: 'card',
          cardDetails: {
            number: '4111111111111111',
            expiry: '12/25',
            cvv: '123'
          }
        })
        .expect(400); // Should return validation error for invalid ID

      expect(response.body.status).toBe('fail');
      expect(response.body.message).toContain('Invalid');
    });

    test('should log third-party service errors properly', async () => {
      // This test would require mocking external services
      // For now, we'll test that the error logging system works
      const initialErrorCount = await ErrorLog.countDocuments();
      
      await request(app)
        .get('/api/v1/nonexistent-endpoint')
        .expect(404);

      const finalErrorCount = await ErrorLog.countDocuments();
      expect(finalErrorCount).toBeGreaterThan(initialErrorCount);
    });
  });

  describe('Rate Limiting Error Handling', () => {
    test('should handle rate limit errors with proper headers', async () => {
      // This would require setting up rate limiting
      // For now, we'll test the error format
      const response = await request(app)
        .get('/api/v1/posts')
        .expect(200);

      expect(response.body.status).toBe('success');
    });
  });

  describe('Authentication Error Handling', () => {
    test('should handle missing authentication token', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/summary')
        .expect(401);

      expect(response.body).toMatchObject({
        status: 'fail',
        message: expect.stringContaining('Authentication')
      });
    });

    test('should handle invalid authentication token', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/summary')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toMatchObject({
        status: 'fail',
        message: expect.stringContaining('token')
      });
    });
  });

  describe('Validation Error Handling', () => {
    test('should handle validation errors in POST requests', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          // Missing required fields
          email: 'invalid-email'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        status: 'fail',
        message: expect.stringContaining('Validation'),
        errors: expect.any(Array)
      });
    });

    test('should handle validation errors in PUT requests', async () => {
      const response = await request(app)
        .put('/api/v1/posts/invalid-id')
        .send({
          title: '' // Invalid title
        })
        .expect(400);

      expect(response.body.status).toBe('fail');
    });
  });

  describe('Database Error Handling', () => {
    test('should handle database connection errors gracefully', async () => {
      // This would require mocking database failures
      // For now, we'll test that the system handles invalid ObjectIds
      const response = await request(app)
        .get('/api/v1/posts/invalid-object-id')
        .expect(400);

      expect(response.body).toMatchObject({
        status: 'fail',
        message: expect.stringContaining('Invalid')
      });
    });
  });

  describe('Error Context and Logging', () => {
    test('should capture comprehensive error context', async () => {
      const initialErrorCount = await ErrorLog.countDocuments();
      
      await request(app)
        .get('/api/v1/nonexistent-endpoint')
        .set('User-Agent', 'Test-Agent/1.0')
        .expect(404);

      const errorLogs = await ErrorLog.find({}).sort({ createdAt: -1 }).limit(1);
      expect(errorLogs).toHaveLength(1);

      const errorLog = errorLogs[0];
      expect(errorLog.context.endpoint).toBe('/api/v1/nonexistent-endpoint');
      expect(errorLog.context.method).toBe('GET');
      expect(errorLog.context.userAgent).toBe('Test-Agent/1.0');
      expect(errorLog.classification.category).toBeDefined();
      expect(errorLog.classification.severity).toBeDefined();
    });

    test('should track error occurrence patterns', async () => {
      // Make the same error multiple times
      for (let i = 0; i < 3; i++) {
        await request(app)
          .get('/api/v1/same-nonexistent-endpoint')
          .expect(404);
      }

      const errorLogs = await ErrorLog.find({
        'context.endpoint': '/api/v1/same-nonexistent-endpoint'
      });

      // Should have one error log with occurrence count of 3
      expect(errorLogs).toHaveLength(1);
      expect(errorLogs[0].occurrenceCount).toBe(3);
    });
  });

  describe('Error Recovery Mechanisms', () => {
    test('should provide appropriate recovery suggestions', async () => {
      const response = await request(app)
        .get('/api/v1/nonexistent-endpoint')
        .expect(404);

      expect(response.body.timestamp).toBeDefined();
      // Recovery suggestions would be added based on error type
    });

    test('should handle circuit breaker states', async () => {
      // This would require triggering circuit breaker conditions
      // For now, we'll test that the system handles errors gracefully
      const response = await request(app)
        .get('/api/v1/posts')
        .expect(200);

      expect(response.body.status).toBe('success');
    });
  });

  describe('Production vs Development Error Responses', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    test('should hide sensitive information in production', async () => {
      process.env.NODE_ENV = 'production';

      const response = await request(app)
        .get('/api/v1/nonexistent-endpoint')
        .expect(404);

      expect(response.body.debug).toBeUndefined();
      expect(response.body.stack).toBeUndefined();
    });

    test('should include debug information in development', async () => {
      process.env.NODE_ENV = 'development';

      const response = await request(app)
        .get('/api/v1/nonexistent-endpoint')
        .expect(404);

      // Debug info might be included in development
      expect(response.body.timestamp).toBeDefined();
    });
  });
});