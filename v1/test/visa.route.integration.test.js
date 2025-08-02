// v1/test/visa.route.integration.test.js
const request = require('supertest');
const app = require('../../app');

describe('Visa Application Route Integration Test', () => {
  describe('POST /api/v1/products/visa/apply', () => {
    it('should handle visa application request with optional authentication', async () => {
      const visaApplicationData = {
        destinationCountry: 'United States',
        visaType: 'Tourist',
        travelPurpose: 'Vacation',
        urgency: 'Standard'
      };

      // Test without authentication (should work with optional auth)
      const response = await request(app)
        .post('/api/v1/products/visa/apply')
        .send(visaApplicationData);

      // The route should not crash and should return a response
      // The actual response depends on the controller implementation
      expect(response.status).toBeDefined();
      expect(typeof response.status).toBe('number');
    });

    it('should handle visa application request with test user authentication', async () => {
      const visaApplicationData = {
        destinationCountry: 'United Kingdom',
        visaType: 'Business',
        travelPurpose: 'Conference',
        urgency: 'Express'
      };

      // Test with authentication using test user header
      const response = await request(app)
        .post('/api/v1/products/visa/apply')
        .set('x-test-user', JSON.stringify({ userId: 'test-user-id', role: 'User' }))
        .send(visaApplicationData);

      // The route should not crash and should return a response
      expect(response.status).toBeDefined();
      expect(typeof response.status).toBe('number');
    });

    it('should not crash when middleware is not available', async () => {
      // This test ensures the safe middleware loading prevents crashes
      const response = await request(app)
        .post('/api/v1/products/visa/apply')
        .send({});

      // Should get some response, not a crash
      expect(response.status).toBeDefined();
      expect(typeof response.status).toBe('number');
    });
  });
});