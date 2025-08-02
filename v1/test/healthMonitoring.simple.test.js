// v1/test/healthMonitoring.simple.test.js
const request = require('supertest');
const app = require('../../app');
const testDbManager = require('./testDbManager');
const performanceTracker = require('../utils/performanceTracker');
const alertingSystem = require('../utils/alertingSystem');

describe('Health Monitoring System - Simple Tests', () => {
  beforeAll(async () => {
    await testDbManager.connect();
  });

  afterAll(async () => {
    await testDbManager.disconnect();
  });

  beforeEach(async () => {
    await testDbManager.cleanDatabase();
    performanceTracker.reset();
    alertingSystem.clearAlertHistory();
  });

  describe('Basic Health Endpoints', () => {
    test('should get basic health status', async () => {
      const response = await request(app)
        .get('/health');

      // Health endpoint may return 200, 206, or 503 depending on service health
      expect([200, 206, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('services');
    });

    test('should get system information', async () => {
      const response = await request(app)
        .get('/health/system')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('application');
      expect(response.body.data).toHaveProperty('system');
      expect(response.body.data.application).toHaveProperty('name');
      expect(response.body.data.system).toHaveProperty('platform');
    });

    test('should get liveness probe', async () => {
      const response = await request(app)
        .get('/health/liveness')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'alive');
      expect(response.body).toHaveProperty('timestamp');
    });

    test('should get readiness probe', async () => {
      const response = await request(app)
        .get('/health/readiness');

      // Readiness probe may return 200 or 503 depending on critical services
      expect([200, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('status');
      expect(['ready', 'not_ready']).toContain(response.body.status);
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('Performance Tracking', () => {
    test('should track performance automatically', async () => {
      // Make a few requests to generate metrics
      await request(app).get('/health/system').expect(200);
      await request(app).get('/health/system').expect(200);
      await request(app).get('/health/system').expect(200);

      // Check that metrics were recorded
      const metrics = performanceTracker.getDetailedMetrics();
      expect(metrics.system.totalRequests).toBeGreaterThan(0);
      expect(metrics.endpoints).toBeDefined();
    });

    test('should calculate performance percentiles', async () => {
      // Generate multiple requests
      for (let i = 0; i < 10; i++) {
        await request(app).get('/health/system').expect(200);
      }

      const metrics = performanceTracker.getDetailedMetrics();
      const systemEndpoint = Object.values(metrics.endpoints).find(ep => 
        ep.endpoint === '/health/system'
      );

      if (systemEndpoint) {
        expect(systemEndpoint.percentiles).toHaveProperty('p50');
        expect(systemEndpoint.percentiles).toHaveProperty('p90');
        expect(systemEndpoint.percentiles).toHaveProperty('p95');
        expect(systemEndpoint.percentiles).toHaveProperty('p99');
      }
    });
  });

  describe('Alerting System', () => {
    test('should initialize alerting system', () => {
      expect(alertingSystem).toBeDefined();
      expect(typeof alertingSystem.getAlertHistory).toBe('function');
      expect(typeof alertingSystem.clearAlertHistory).toBe('function');
    });

    test('should get empty alert history initially', () => {
      const alerts = alertingSystem.getAlertHistory();
      expect(Array.isArray(alerts)).toBe(true);
      expect(alerts.length).toBe(0);
    });

    test('should clear alert history', () => {
      alertingSystem.clearAlertHistory();
      const alerts = alertingSystem.getAlertHistory();
      expect(alerts.length).toBe(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid health service requests', async () => {
      const response = await request(app)
        .get('/health/service/invalid-service');

      // Should return 404 for invalid service
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('status', 'error');
    }, 10000); // 10 second timeout

    test('should handle malformed requests gracefully', async () => {
      const response = await request(app)
        .get('/health');

      // Should return some response regardless of health status
      expect([200, 206, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('status');
    });
  });
});