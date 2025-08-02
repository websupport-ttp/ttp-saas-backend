// v1/test/integration/routeDebug.test.js
// Debug test to check what routes are actually available

const request = require('supertest');
const app = require('./testApp');

describe('Route Debug Tests', () => {
  it('should check if analytics routes are mounted', async () => {
    console.log('Testing analytics routes...');
    
    // Test various analytics endpoints to see which ones exist
    const endpoints = [
      '/api/v1/analytics/summary',
      '/api/v1/analytics/dashboard',
      '/api/v1/analytics/revenue',
      '/api/v1/analytics/customers',
      '/api/v1/analytics/products',
      '/api/v1/analytics/realtime'
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await request(app).get(endpoint);
        console.log(`${endpoint}: ${response.status} - ${response.statusText}`);
      } catch (error) {
        console.log(`${endpoint}: ERROR - ${error.message}`);
      }
    }
  });

  it('should check if product routes are mounted', async () => {
    console.log('Testing product routes...');
    
    const endpoints = [
      '/api/v1/products/packages',
      '/api/v1/products/visa/apply',
      '/api/v1/products/packages/test-id/purchase'
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await request(app).get(endpoint);
        console.log(`${endpoint}: ${response.status} - ${response.statusText}`);
      } catch (error) {
        console.log(`${endpoint}: ERROR - ${error.message}`);
      }
    }
  });

  it('should check if auth routes are mounted', async () => {
    console.log('Testing auth routes...');
    
    const endpoints = [
      '/api/v1/auth/register',
      '/api/v1/auth/login',
      '/api/v1/users/me'
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await request(app).post(endpoint);
        console.log(`${endpoint}: ${response.status} - ${response.statusText}`);
      } catch (error) {
        console.log(`${endpoint}: ERROR - ${error.message}`);
      }
    }
  });

  it('should check if post routes are mounted', async () => {
    console.log('Testing post routes...');
    
    const endpoints = [
      '/api/v1/posts',
      '/api/v1/posts/featured',
      '/api/v1/categories'
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await request(app).get(endpoint);
        console.log(`${endpoint}: ${response.status} - ${response.statusText}`);
      } catch (error) {
        console.log(`${endpoint}: ERROR - ${error.message}`);
      }
    }
  });

  it('should check health routes', async () => {
    console.log('Testing health routes...');
    
    const endpoints = [
      '/health',
      '/health/system',
      '/health/liveness',
      '/health/readiness'
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await request(app).get(endpoint);
        console.log(`${endpoint}: ${response.status} - ${response.statusText}`);
      } catch (error) {
        console.log(`${endpoint}: ERROR - ${error.message}`);
      }
    }
  });
});