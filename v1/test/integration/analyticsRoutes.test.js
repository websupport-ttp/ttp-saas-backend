// v1/test/integration/analyticsRoutes.test.js
const request = require('supertest');
const app = require('../../../app');
const User = require('../../models/userModel');
const Ledger = require('../../models/ledgerModel');
const AnalyticsCache = require('../../models/analyticsCacheModel');
const { setupTestEnvironment } = require('../helpers/testHelper');
const { UserRoles, TransactionStatus } = require('../../utils/constants');

// Mock the models
jest.mock('../../models/userModel');
jest.mock('../../models/ledgerModel');
jest.mock('../../models/analyticsCacheModel');

// Mock the authentication middleware
jest.mock('../../middleware/authMiddleware', () => ({
  authenticateUser: (req, res, next) => {
    // Mock user based on test context
    if (req.headers['x-test-user-role']) {
      req.user = {
        userId: 'test-user-id',
        role: req.headers['x-test-user-role']
      };
    }
    next();
  },
  authorizeRoles: (...roles) => (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    next();
  }
}));

// Mock cache middleware
jest.mock('../../middleware/cacheMiddleware', () => ({
  cacheMiddleware: () => (req, res, next) => next(),
  rateLimitByRole: () => (req, res, next) => next(),
  invalidateCache: () => (req, res, next) => next(),
  getCacheStats: jest.fn().mockResolvedValue({ connected: true })
}));

describe('Analytics Routes Integration Tests', () => {
  let testTransactions;

  beforeAll(() => {
    setupTestEnvironment();
    
    // Mock test transactions data
    testTransactions = [
      {
        _id: 'txn001',
        userId: 'manager-user-id',
        itemType: 'Flight',
        totalAmountPaid: 50000,
        profitMargin: 5000,
        serviceCharge: 2500,
        status: TransactionStatus.COMPLETED,
        transactionReference: 'TXN001',
        customerSegment: 'Premium',
        bookingChannel: 'Web',
        seasonality: 'Peak',
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // Yesterday
      },
      {
        _id: 'txn002',
        userId: 'executive-user-id',
        itemType: 'Hotel',
        totalAmountPaid: 30000,
        profitMargin: 3000,
        serviceCharge: 1500,
        status: TransactionStatus.COMPLETED,
        transactionReference: 'TXN002',
        customerSegment: 'Standard',
        bookingChannel: 'Mobile',
        seasonality: 'Off-Peak',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
      },
      {
        _id: 'txn003',
        userId: 'admin-user-id',
        itemType: 'Package',
        totalAmountPaid: 100000,
        profitMargin: 15000,
        serviceCharge: 5000,
        status: TransactionStatus.COMPLETED,
        transactionReference: 'TXN003',
        customerSegment: 'VIP',
        bookingChannel: 'Agent',
        seasonality: 'Peak',
        createdAt: new Date() // Today
      }
    ];

    // Mock Ledger methods
    Ledger.aggregate = jest.fn();
    Ledger.find = jest.fn();
    Ledger.deleteMany = jest.fn().mockResolvedValue({ deletedCount: 0 });
    Ledger.insertMany = jest.fn().mockResolvedValue(testTransactions);

    // Mock AnalyticsCache methods
    AnalyticsCache.getCache = jest.fn().mockResolvedValue(null);
    AnalyticsCache.setCache = jest.fn().mockResolvedValue(true);
    AnalyticsCache.deleteMany = jest.fn().mockResolvedValue({ deletedCount: 0 });
    AnalyticsCache.invalidateCacheByCategory = jest.fn().mockResolvedValue({ deletedCount: 0 });
  });

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Setup default mock responses for analytics aggregations
    setupAnalyticsMocks();
  });

  // Helper function to setup analytics mocks
  function setupAnalyticsMocks() {
    // Mock revenue analytics aggregation
    const revenueAggregationResult = [{
      _id: null,
      totalRevenue: 180000,
      totalProfit: 23000,
      totalServiceCharges: 9000,
      totalTransactions: 3,
      averageTransactionValue: 60000,
      profitMarginPercentage: 12.78,
      revenueByItemType: [
        { itemType: 'Flight', amount: 50000, profit: 5000 },
        { itemType: 'Hotel', amount: 30000, profit: 3000 },
        { itemType: 'Package', amount: 100000, profit: 15000 }
      ]
    }];

    // Mock customer analytics aggregation
    const customerAggregationResult = [
      { segment: 'Premium', totalRevenue: 50000, transactionCount: 1 },
      { segment: 'Standard', totalRevenue: 30000, transactionCount: 1 },
      { segment: 'VIP', totalRevenue: 100000, transactionCount: 1 }
    ];

    // Mock product analytics aggregation
    const productAggregationResult = [
      { itemType: 'Flight', totalRevenue: 50000, totalProfit: 5000, transactionCount: 1, profitMarginPercentage: 10 },
      { itemType: 'Hotel', totalRevenue: 30000, totalProfit: 3000, transactionCount: 1, profitMarginPercentage: 10 },
      { itemType: 'Package', totalRevenue: 100000, totalProfit: 15000, transactionCount: 1, profitMarginPercentage: 15 }
    ];

    // Mock daily trend aggregation
    const dailyTrendResult = [
      { date: new Date(), dailyRevenue: 100000, dailyProfit: 15000, transactionCount: 1 },
      { date: new Date(Date.now() - 24 * 60 * 60 * 1000), dailyRevenue: 50000, dailyProfit: 5000, transactionCount: 1 },
      { date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), dailyRevenue: 30000, dailyProfit: 3000, transactionCount: 1 }
    ];

    // Setup Ledger.aggregate mock to return different results based on pipeline
    Ledger.aggregate.mockImplementation((pipeline) => {
      // Check the pipeline to determine what type of aggregation is being performed
      const pipelineStr = JSON.stringify(pipeline);
      
      if (pipelineStr.includes('revenueByItemType')) {
        return Promise.resolve(revenueAggregationResult);
      } else if (pipelineStr.includes('customerSegment')) {
        return Promise.resolve(customerAggregationResult);
      } else if (pipelineStr.includes('itemType')) {
        return Promise.resolve(productAggregationResult);
      } else if (pipelineStr.includes('dailyRevenue')) {
        return Promise.resolve(dailyTrendResult);
      } else {
        return Promise.resolve([]);
      }
    });

    // Mock Ledger.find for recent transactions
    Ledger.find.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      select: jest.fn().mockResolvedValue(testTransactions.slice(0, 5))
    });
  }

  describe('Authentication and Authorization', () => {
    test('should deny access without authentication', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/summary')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('should deny access for regular users', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/summary')
        .set('x-test-user-role', UserRoles.USER)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    test('should allow access for Manager role', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/summary')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should allow access for Executive role', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/summary')
        .set('x-test-user-role', UserRoles.EXECUTIVE)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should allow access for Admin role', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/summary')
        .set('x-test-user-role', UserRoles.ADMIN)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Analytics Endpoints', () => {
    test('GET /api/v1/analytics/summary should return analytics summary', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/summary')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('currentPeriod');
      expect(response.body.data).toHaveProperty('previousPeriod');
      expect(response.body.data).toHaveProperty('changes');
      expect(response.body.data).toHaveProperty('realTime');
    });

    test('GET /api/v1/analytics/dashboard should return dashboard data', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/dashboard')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('overview');
      expect(response.body.data).toHaveProperty('revenue');
      expect(response.body.data).toHaveProperty('customers');
      expect(response.body.data).toHaveProperty('products');
    });

    test('GET /api/v1/analytics/revenue should return revenue analytics', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/revenue')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalRevenue');
      expect(response.body.data).toHaveProperty('totalProfit');
      expect(response.body.data).toHaveProperty('revenueByItemType');
    });

    test('GET /api/v1/analytics/revenue/trend should return revenue trend', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/revenue/trend')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('trend');
      expect(Array.isArray(response.body.data.trend)).toBe(true);
    });

    test('GET /api/v1/analytics/customers should return customer analytics', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/customers')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('customerSegments');
      expect(response.body.data).toHaveProperty('bookingChannels');
      expect(response.body.data).toHaveProperty('customerMetrics');
    });

    test('GET /api/v1/analytics/products should return product analytics', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/products')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('itemPerformance');
      expect(Array.isArray(response.body.data.itemPerformance)).toBe(true);
    });

    test('GET /api/v1/analytics/profit-margins should return profit margin analytics', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/profit-margins')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('overall');
      expect(response.body.data).toHaveProperty('byServiceType');
      expect(response.body.data).toHaveProperty('performanceRanking');
    });
  });

  describe('Real-time Endpoints', () => {
    test('GET /api/v1/analytics/realtime should return real-time metrics', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/realtime')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('today');
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('recentTransactions');
    });
  });

  describe('Cache Management', () => {
    test('DELETE /api/v1/analytics/cache should require Executive+ role', async () => {
      // Manager should be denied
      await request(app)
        .delete('/api/v1/analytics/cache')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(403);

      // Executive should be allowed
      const response = await request(app)
        .delete('/api/v1/analytics/cache')
        .set('x-test-user-role', UserRoles.EXECUTIVE)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Caching Functionality', () => {
    test('should cache responses and return cached data on subsequent requests', async () => {
      // First request - should not be cached
      const firstResponse = await request(app)
        .get('/api/v1/analytics/summary')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(firstResponse.body.success).toBe(true);

      // Second request - should use same data
      const secondResponse = await request(app)
        .get('/api/v1/analytics/summary')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(secondResponse.body.success).toBe(true);
    });
  });

  describe('Rate Limiting', () => {
    test('should include rate limit headers', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/summary')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should enforce different rate limits for different roles', async () => {
      // Manager should have access
      const managerResponse = await request(app)
        .get('/api/v1/analytics/summary')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      // Executive should also have access
      const executiveResponse = await request(app)
        .get('/api/v1/analytics/summary')
        .set('x-test-user-role', UserRoles.EXECUTIVE)
        .expect(200);

      expect(managerResponse.body.success).toBe(true);
      expect(executiveResponse.body.success).toBe(true);
    });
  });

  describe('Query Parameters', () => {
    test('should handle date range parameters', async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date().toISOString();

      const response = await request(app)
        .get(`/api/v1/analytics/revenue?startDate=${startDate}&endDate=${endDate}`)
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.dateRange.startDate).toBe(startDate);
      expect(response.body.data.dateRange.endDate).toBe(endDate);
    });

    test('should handle item type filtering', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/revenue?itemType=Flight')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.filters.itemType).toBe('Flight');
    });

    test('should handle period parameters', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/summary?period=7d')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('dateRanges');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid date formats', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/revenue?startDate=invalid-date')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Invalid');
    });

    test('should handle invalid item types', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/revenue?itemType=InvalidType')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });
  });
});