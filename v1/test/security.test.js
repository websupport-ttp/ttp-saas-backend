// v1/test/security.test.js
const request = require('supertest');
const app = require('../../app');
const { validatePassword, generateSecureToken } = require('../utils/securityConfig');

describe('Security Enhancements', () => {
  describe('Password Validation', () => {
    it('should validate strong passwords', () => {
      const result = validatePassword('StrongP@ssw0rd123');
      expect(result.isValid).toBe(true);
      expect(result.strength.strength).toBe('strong');
    });

    it('should reject weak passwords', () => {
      const result = validatePassword('weak');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject common passwords', () => {
      const result = validatePassword('password123');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password is too common, please choose a more secure password');
    });
  });

  describe('Security Headers', () => {
    it('should include security headers in responses', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['x-request-id']).toBeDefined();
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to auth endpoints', async () => {
      // Make multiple requests to trigger rate limiting
      const promises = Array(12).fill().map(() => 
        request(app)
          .post('/api/v1/auth/login')
          .send({ emailOrPhone: 'test@example.com', password: 'wrongpassword' })
      );

      const responses = await Promise.all(promises);
      
      // Some requests should be rate limited (429 status)
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize malicious input', async () => {
      const maliciousInput = {
        email: 'test@example.com<script>alert("xss")</script>',
        firstName: 'John<img src=x onerror=alert(1)>',
        lastName: 'Doe'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(maliciousInput);

      // Should either reject the input or sanitize it
      expect(response.status).toBeOneOf([400, 201]);
      
      if (response.status === 201) {
        // If accepted, the malicious content should be sanitized
        expect(response.body.data?.user?.firstName).not.toContain('<script>');
        expect(response.body.data?.user?.firstName).not.toContain('<img');
      }
    });
  });

  describe('Token Security', () => {
    it('should generate secure tokens', () => {
      const token1 = generateSecureToken();
      const token2 = generateSecureToken();
      
      expect(token1).toBeDefined();
      expect(token2).toBeDefined();
      expect(token1).not.toBe(token2);
      expect(token1.length).toBe(64); // 32 bytes = 64 hex chars
    });
  });

  describe('CORS Configuration', () => {
    it('should handle CORS properly', async () => {
      const response = await request(app)
        .options('/api/v1/auth/login')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toBeDefined();
    });
  });
});

// Helper matcher for Jest
expect.extend({
  toBeOneOf(received, expected) {
    const pass = expected.includes(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be one of ${expected}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be one of ${expected}`,
        pass: false,
      };
    }
  },
});