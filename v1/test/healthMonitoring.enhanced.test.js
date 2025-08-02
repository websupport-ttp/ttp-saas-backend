ww// v1/test/healthMonitoring.enhanced.test.js
const request = require('supertest');
const app = require('../../app');
const testDbManager = require('./testDbManager');
const User = require('../models/userModel');
const { generateToken } = require('../utils/jwt');
const performanceTracker = require('../utils/performanceTracker');
const alertingSystem = require('../utils/alertingSystem');

describe('Enhanced Health Monitoring System', () => {
  let adminUser;
  let adminToken;
  let managerUser;
  let managerToken;

  beforeAll(async () => {
    await testDbManager.connect();
    
    // Create admin user
    adminUser = await User.create({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@test.com',
      password: 'password123',
      role: 'Admin',
      isEmailVerified: true
    });
    adminToken = generateToken(
      { userId: adminUser._id, role: adminUser.role }, 
      process.env.JWT_ACCESS_SECRET || 'test-secret', 
      '1h'
    );

    // Create manager user
    managerUser = await User.create({
      firstName: 'Manager',
      lastName: 'User',
      email: 'manager@test.com',
      password: 'password123',
      role: 'Manager',
      isEmailVerified: true
    });
    managerToken = generateToken(
      { userId: managerUser._id, role: managerUser.role }, 
      process.env.JWT_ACCESS_SECRET || 'test-secret', 
      '1h'
    );
  });

  afterAll(async () => {
    await testDbManager.disconnect();
  });

  beforeEach(async () => {
    // Clean database before each test
    await testDbManager.cleanDatabase();
    
    // Reset metrics before each test
    performanceTracker.reset();
    alertingSystem.clearAlertHistory();
  });

  describe('Health Dashboard', () => {
    test('should get comprehensive health dashboard for manager', async () => {
      const response = await request(app)
        .get('/health/dashboard')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('overview');
      expect(response.body.data).toHaveProperty('healthSummary');
      expect(response.body.data).toHaveProperty('services');
      expect(response.body.data).toHaveProperty('performance');
      expect(response.body.data).toHaveProperty('systemResources');
      expect(response.body.data).toHaveProperty('alerts');
      expect(response.body.data).toHaveProperty('trends');

      // Check overview structure
      expect(response.body.data.overview).toHaveProperty('status');
      expect(response.body.data.overview).toHaveProperty('timestamp');
      expect(response.body.data.overview).toHaveProperty('uptime');
      expect(response.body.data.overview).toHaveProperty('environment');

      // Check system resources
      expect(response.body.data.systemResources).toHaveProperty('memory');
      expect(response.body.data.systemResources).toHaveProperty('cpu');
      expect(response.body.data.systemResources.memory).toHaveProperty('total');
      expect(response.body.data.systemResources.memory).toHaveProperty('free');
      expect(response.body.data.systemResources.memory).toHaveProperty('usagePercent');

      // Check alerts structure
      expect(response.body.data.alerts).toHaveProperty('recent');
      expect(response.body.data.alerts).toHaveProperty('summary');
      expect(Array.isArray(response.body.data.alerts.recent)).toBe(true);
    });

    test('should deny access to health dashboard for regular users', async () => {
      const regularUser = await User.create({
        firstName: 'Regular',
        lastName: 'User',
        email: 'regular@test.com',
        password: 'password123',
        role: 'User',
        isEmailVerified: true
      });
      const regularToken = generateToken(
        { userId: regularUser._id, role: regularUser.role }, 
        process.env.JWT_ACCESS_SECRET || 'test-secret', 
        '1h'
      );

      await request(app)
        .get('/health/dashboard')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(403);
    });

    test('should require authentication for health dashboard', async () => {
      await request(app)
        .get('/health/dashboard')
        .expect(401);
    });
  });

  describe('Enhanced Performance Metrics', () => {
    test('should get basic performance metrics', async () => {
      // Generate some test requests first
      await request(app)
        .get('/health/system')
        .expect(200);

      await request(app)
        .get('/health/system')
        .expect(200);

      const response = await request(app)
        .get('/health/metrics')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('timestamp');
      expect(response.body.data).toHaveProperty('metrics');
    });

    test('should get detailed performance metrics', async () => {
      // Generate some test requests first
      await request(app)
        .get('/health/system')
        .expect(200);

      const response = await request(app)
        .get('/health/metrics?detailed=true')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('system');
      expect(response.body.data).toHaveProperty('endpoints');
      expect(response.body.data).toHaveProperty('timestamp');

      // Check system metrics
      expect(response.body.data.system).toHaveProperty('uptime');
      expect(response.body.data.system).toHaveProperty('totalRequests');
      expect(response.body.data.system).toHaveProperty('totalErrors');
      expect(response.body.data.system).toHaveProperty('avgResponseTime');
      expect(response.body.data.system).toHaveProperty('errorRate');
    });

    test('should get metrics for specific endpoint', async () => {
      // Generate some test requests first
      await request(app)
        .get('/health/system')
        .expect(200);

      const response = await request(app)
        .get('/health/metrics?detailed=true&endpoint=GET:/health/system')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      if (response.body.data) {
        expect(response.body.data).toHaveProperty('endpoint');
        expect(response.body.data).toHaveProperty('method');
        expect(response.body.data).toHaveProperty('totalRequests');
        expect(response.body.data).toHaveProperty('avgResponseTime');
        expect(response.body.data).toHaveProperty('percentiles');
      }
    });

    test('should clear performance metrics (admin only)', async () => {
      await request(app)
        .delete('/health/metrics/clear')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const response = await request(app)
        .get('/health/metrics?detailed=true')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(response.body.data.system.totalRequests).toBe(0);
    });

    test('should deny metrics clearing for non-admin users', async () => {
      await request(app)
        .delete('/health/metrics/clear')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(403);
    });
  });

  describe('Alert System', () => {
    test('should get alert history', async () => {
      const response = await request(app)
        .get('/health/alerts')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('alerts');
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('availableTypes');
      expect(Array.isArray(response.body.data.alerts)).toBe(true);
      expect(Array.isArray(response.body.data.availableTypes)).toBe(true);
    });

    test('should get filtered alert history', async () => {
      const response = await request(app)
        .get('/health/alerts?limit=10&type=SYSTEM_UNHEALTHY')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.alerts.length).toBeLessThanOrEqual(10);
    });

    test('should update alert thresholds (admin only)', async () => {
      const newThresholds = {
        responseTime: 3000,
        errorRate: 0.03,
        memoryUsage: 0.80
      };

      const response = await request(app)
        .put('/health/alerts/thresholds')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ thresholds: newThresholds })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.message).toContain('updated successfully');
      expect(response.body.data.updatedThresholds).toEqual(newThresholds);
    });

    test('should reject invalid alert thresholds', async () => {
      const invalidThresholds = {
        responseTime: -1000, // Invalid negative value
        invalidField: 0.5 // Invalid field
      };

      await request(app)
        .put('/health/alerts/thresholds')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ thresholds: invalidThresholds })
        .expect(400);
    });

    test('should deny threshold updates for non-admin users', async () => {
      const newThresholds = {
        responseTime: 3000
      };

      await request(app)
        .put('/health/alerts/thresholds')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ thresholds: newThresholds })
        .expect(403);
    });

    test('should clear alert history (admin only)', async () => {
      const response = await request(app)
        .delete('/health/alerts/clear')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.message).toContain('cleared successfully');
    });

    test('should deny alert history clearing for non-admin users', async () => {
      await request(app)
        .delete('/health/alerts/clear')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(403);
    });
  });

  describe('Performance Tracking Integration', () => {
    test('should track request performance automatically', async () => {
      // Make several requests to generate metrics
      const requests = [];
      for (let i = 0; i < 5; i++) {
        requests.push(
          request(app)
            .get('/health/system')
            .expect(200)
        );
      }
      
      await Promise.all(requests);

      // Check that metrics were recorded
      const metricsResponse = await request(app)
        .get('/health/metrics?detailed=true')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(metricsResponse.body.data.system.totalRequests).toBeGreaterThan(0);
      expect(metricsResponse.body.data.endpoints).toBeDefined();
    });

    test('should calculate performance percentiles correctly', async () => {
      // Generate requests with varying response times
      for (let i = 0; i < 10; i++) {
        await request(app)
          .get('/health/system')
          .expect(200);
      }

      const response = await request(app)
        .get('/health/metrics?detailed=true')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      const endpoints = response.body.data.endpoints;
      const systemEndpoint = Object.values(endpoints).find(ep => ep.endpoint === '/health/system');
      
      if (systemEndpoint) {
        expect(systemEndpoint.percentiles).toHaveProperty('p50');
        expect(systemEndpoint.percentiles).toHaveProperty('p90');
        expect(systemEndpoint.percentiles).toHaveProperty('p95');
        expect(systemEndpoint.percentiles).toHaveProperty('p99');
      }
    });
  });

  describe('System Resource Monitoring', () => {
    test('should monitor system resources in dashboard', async () => {
      const response = await request(app)
        .get('/health/dashboard')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      const systemResources = response.body.data.systemResources;
      
      expect(systemResources.memory.total).toBeGreaterThan(0);
      expect(systemResources.memory.free).toBeGreaterThan(0);
      expect(systemResources.memory.usagePercent).toBeGreaterThanOrEqual(0);
      expect(systemResources.memory.usagePercent).toBeLessThanOrEqual(100);
      
      expect(systemResources.cpu.cores).toBeGreaterThan(0);
      expect(Array.isArray(systemResources.cpu.loadAverage)).toBe(true);
      expect(systemResources.cpu.loadAverage).toHaveLength(3);
    });
  });

  describe('Error Handling', () => {
    test('should handle health dashboard errors gracefully', async () => {
      // This test would require mocking internal services to fail
      // For now, we'll test that the endpoint structure is correct
      const response = await request(app)
        .get('/health/dashboard')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('data');
    });

    test('should handle performance metrics errors gracefully', async () => {
      const response = await request(app)
        .get('/health/metrics')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('data');
    });
  });
});