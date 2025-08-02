// v1/test/middleware/qrCodeRateLimit.test.js
const request = require('supertest');
const express = require('express');
const { 
  qrCodeGenerationLimiter,
  qrCodeValidationLimiter,
  qrCodeMetadataLimiter,
  qrCodeDownloadLimiter,
  qrCodeHealthLimiter,
  qrCodeSensitiveLimiter
} = require('../../middleware/rateLimitMiddleware');

describe('QR Code Rate Limiting', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('QR Code Generation Rate Limiting', () => {
    beforeEach(() => {
      app.post('/test-generation', qrCodeGenerationLimiter, (req, res) => {
        res.json({ success: true });
      });
    });

    it('should allow requests within rate limit', async () => {
      const response = await request(app)
        .post('/test-generation')
        .send({ type: 'affiliate', data: { affiliateId: 'test' } });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should include rate limit headers', async () => {
      const response = await request(app)
        .post('/test-generation')
        .send({ type: 'affiliate', data: { affiliateId: 'test' } });

      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(response.headers['ratelimit-remaining']).toBeDefined();
      expect(response.headers['ratelimit-reset']).toBeDefined();
    });
  });

  describe('QR Code Validation Rate Limiting', () => {
    beforeEach(() => {
      app.post('/test-validation', qrCodeValidationLimiter, (req, res) => {
        res.json({ success: true });
      });
    });

    it('should allow validation requests within rate limit', async () => {
      const response = await request(app)
        .post('/test-validation')
        .send({ qrData: 'test-qr-data' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('QR Code Metadata Rate Limiting', () => {
    beforeEach(() => {
      app.get('/test-metadata/:qrId', qrCodeMetadataLimiter, (req, res) => {
        res.json({ success: true });
      });
    });

    it('should allow metadata requests within rate limit', async () => {
      const response = await request(app)
        .get('/test-metadata/qr_test-id');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('QR Code Download Rate Limiting', () => {
    beforeEach(() => {
      app.get('/test-download/:qrId', qrCodeDownloadLimiter, (req, res) => {
        res.json({ success: true });
      });
    });

    it('should allow download requests within rate limit', async () => {
      const response = await request(app)
        .get('/test-download/qr_test-id');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('QR Code Health Rate Limiting', () => {
    beforeEach(() => {
      app.get('/test-health', qrCodeHealthLimiter, (req, res) => {
        res.json({ success: true });
      });
    });

    it('should allow health check requests within rate limit', async () => {
      const response = await request(app)
        .get('/test-health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('QR Code Sensitive Operations Rate Limiting', () => {
    beforeEach(() => {
      app.post('/test-sensitive', qrCodeSensitiveLimiter, (req, res) => {
        res.json({ success: true });
      });
    });

    it('should allow sensitive requests within rate limit', async () => {
      const response = await request(app)
        .post('/test-sensitive')
        .send({ type: 'withdrawal', data: { withdrawalId: 'test' } });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should apply stricter limits for sensitive operations', async () => {
      // The sensitive limiter should have lower limits than regular generation
      // This test verifies the configuration is applied correctly
      const response = await request(app)
        .post('/test-sensitive')
        .send({ type: 'commission', data: { transactionId: 'test' } });

      expect(response.status).toBe(200);
      // Check that rate limit headers show lower limits
      const limit = parseInt(response.headers['ratelimit-limit']);
      expect(limit).toBeLessThanOrEqual(20); // Should be lower than regular generation limit
    });
  });

  describe('Rate Limit Error Responses', () => {
    beforeEach(() => {
      // Create a very restrictive limiter for testing
      const testLimiter = require('express-rate-limit')({
        windowMs: 60 * 1000, // 1 minute
        max: 1, // Only 1 request per minute
        standardHeaders: true,
        legacyHeaders: false,
        message: (req, res) => {
          res.status(429).json({
            success: false,
            message: 'Rate limit exceeded for testing'
          });
        }
      });

      app.post('/test-rate-limit', testLimiter, (req, res) => {
        res.json({ success: true });
      });
    });

    it('should return 429 when rate limit is exceeded', async () => {
      // First request should succeed
      await request(app)
        .post('/test-rate-limit')
        .send({ test: 'data' });

      // Second request should be rate limited
      const response = await request(app)
        .post('/test-rate-limit')
        .send({ test: 'data' });

      expect(response.status).toBe(429);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Rate limit exceeded');
    });
  });
});