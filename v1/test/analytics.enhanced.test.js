// v1/test/analytics.enhanced.test.js
const request = require('supertest');
const app = require('../../app');
const User = require('../models/userModel');
const Ledger = require('../models/ledgerModel');
const AnalyticsCache = require('../models/analyticsCacheModel');
const { UserRoles, TransactionStatus } = require('../utils/constants');
const { setupTestEnvironment } = require('./helpers/testHelper');

// Mock the models
jest.mock('../models/userModel');
jest.mock('../models/ledgerModel');
jest.mock('../models/analyticsCacheModel');

// Mock the authentication middleware
jest.mock('../middleware/authMiddleware', () => ({
  authenticateUser: (req, res, next) => {
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
jest.mock('../middleware/cacheMiddleware', () => ({
  cacheMiddleware: () => (req, res, next) => next(),
  rateLimitByRole: () => (req, res, next) => next(),
  invalidateCache: () => (req, res, next) => next(),
  getCacheStats: jest.fn().mockResolvedValue({ connected: true })
}));

describe('Analytics Controller - Enhanced Tests', () => {
  beforeAll(() => {
    setupTestEnvironment();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setupAnalyticsMocks();
  });

  function setupAnalyticsMocks() {
    // Mock comprehensive revenue analytics
    const revenueResult = [{
      _id: null,
      totalRevenue: 500000,
      totalProfit: 75000,
      totalServiceCharges: 25000,
      totalTransactions: 10,
      averageTransactionValue: 50000,
      profitMarginPercentage: 15,
      revenueByItemType: [
        { itemType: 'Flight', amount: 200000, profit: 30000 },
        { itemType: 'Hotel', amount: 150000, profit: 22500 },
        { itemType: 'Package', amount: 100000, profit: 15000 },
        { itemType: 'Insurance', amount: 30000, profit: 4500 },
        { itemType: 'Visa', amount: 20000, profit: 3000 }
      ]
    }];

    // Mock customer analytics with comprehensive data
    const customerSegments = [
      { segment: 'VIP', totalRevenue: 200000, totalProfit: 35000, transactionCount: 3, averageTransactionValue: 66667 },
      { segment: 'Premium', totalRevenue: 150000, totalProfit: 25000, transactionCount: 3, averageTransactionValue: 50000 },
      { segment: 'Standard', totalRevenue: 100000, totalProfit: 12000, transactionCount: 3, averageTransactionValue: 33333 },
      { segment: 'Basic', totalRevenue: 50000, totalProfit: 3000, transactionCount: 1, averageTransactionValue: 50000 }
    ];

    const bookingChannels = [
      { channel: 'Web', totalRevenue: 250000, transactionCount: 5, averageTransactionValue: 50000 },
      { channel: 'Mobile', totalRevenue: 150000, transactionCount: 3, averageTransactionValue: 50000 },
      { channel: 'Agent', totalRevenue: 100000, transactionCount: 2, averageTransactionValue: 50000 }
    ];

    const customerMetrics = [{
      totalCustomers: 8,
      newCustomers: 6,
      repeatCustomers: 2,
      repeatCustomerRate: 25,
      averageTransactionsPerCustomer: 1.25,
      averageCustomerValue: 62500
    }];

    // Mock product performance with all item types
    const productPerformance = [
      { itemType: 'Flight', totalRevenue: 200000, totalProfit: 30000, transactionCount: 4, averageTransactionValue: 50000, averageProfit: 7500, profitMarginPercentage: 15 },
      { itemType: 'Hotel', totalRevenue: 150000, totalProfit: 22500, transactionCount: 3, averageTransactionValue: 50000, averageProfit: 7500, profitMarginPercentage: 15 },
      { itemType: 'Package', totalRevenue: 100000, totalProfit: 15000, transactionCount: 2, averageTransactionValue: 50000, averageProfit: 7500, profitMarginPercentage: 15 },
      { itemType: 'Insurance', totalRevenue: 30000, totalProfit: 4500, transactionCount: 1, averageTransactionValue: 30000, averageProfit: 4500, profitMarginPercentage: 15 },
      { itemType: 'Visa', totalRevenue: 20000, totalProfit: 3000, transactionCount: 1, averageTransactionValue: 20000, averageProfit: 3000, profitMarginPercentage: 15 }
    ];

    const seasonalityData = [
      { season: 'Peak', totalRevenue: 300000, transactionCount: 6, averageTransactionValue: 50000 },
      { season: 'Off-Peak', totalRevenue: 150000, transactionCount: 3, averageTransactionValue: 50000 },
      { season: 'Shoulder', totalRevenue: 50000, transactionCount: 1, averageTransactionValue: 50000 }
    ];

    // Mock daily trend with multiple days
    const dailyTrend = [
      { date: new Date('2024-01-01'), dailyRevenue: 100000, dailyProfit: 15000, transactionCount: 2, averageTransactionValue: 50000, profitMarginPercentage: 15 },
      { date: new Date('2024-01-02'), dailyRevenue: 150000, dailyProfit: 22500, transactionCount: 3, averageTransactionValue: 50000, profitMarginPercentage: 15 },
      { date: new Date('2024-01-03'), dailyRevenue: 200000, dailyProfit: 30000, transactionCount: 4, averageTransactionValue: 50000, profitMarginPercentage: 15 },
      { date: new Date('2024-01-04'), dailyRevenue: 50000, dailyProfit: 7500, transactionCount: 1, averageTransactionValue: 50000, profitMarginPercentage: 15 }
    ];

    // Setup Ledger.aggregate mock
    Ledger.aggregate.mockImplementation((pipeline) => {
      const pipelineStr = JSON.stringify(pipeline);
      
      if (pipelineStr.includes('revenueByItemType')) {
        return Promise.resolve(revenueResult);
      } else if (pipelineStr.includes('customerSegment')) {
        return Promise.resolve(customerSegments);
      } else if (pipelineStr.includes('bookingChannel')) {
        return Promise.resolve(bookingChannels);
      } else if (pipelineStr.includes('repeatCustomers')) {
        return Promise.resolve(customerMetrics);
      } else if (pipelineStr.includes('itemType') && pipelineStr.includes('profitMarginPercentage')) {
        return Promise.resolve(productPerformance);
      } else if (pipelineStr.includes('seasonality')) {
        return Promise.resolve(seasonalityData);
      } else if (pipelineStr.includes('dailyRevenue')) {
        return Promise.resolve(dailyTrend);
      } else {
        return Promise.resolve([]);
      }
    });

    // Mock Ledger.find for recent transactions
    Ledger.find.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      select: jest.fn().mockResolvedValue([
        { itemType: 'Flight', totalAmountPaid: 50000, createdAt: new Date(), transactionReference: 'TXN001' },
        { itemType: 'Hotel', totalAmountPaid: 40000, createdAt: new Date(), transactionReference: 'TXN002' },
        { itemType: 'Package', totalAmountPaid: 75000, createdAt: new Date(), transactionReference: 'TXN003' }
      ])
    });

    // Mock AnalyticsCache methods
    AnalyticsCache.getCache = jest.fn().mockResolvedValue(null);
    AnalyticsCache.setCache = jest.fn().mockResolvedValue(true);
    AnalyticsCache.deleteMany = jest.fn().mockResolvedValue({ deletedCount: 5 });
    AnalyticsCache.invalidateCacheByCategory = jest.fn().mockResolvedValue({ deletedCount: 3 });
  }

  describe('Revenue Analytics - Comprehensive Tests', () => {
    it('should return revenue analytics with all item types', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/revenue')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalRevenue).toBe(500000);
      expect(response.body.data.totalProfit).toBe(75000);
      expect(response.body.data.profitMarginPercentage).toBe(15);
      expect(response.body.data.revenueByItemType).toHaveLength(5);
      
      // Check all item types are present
      const itemTypes = response.body.data.revenueByItemType.map(item => item.itemType);
      expect(itemTypes).toContain('Flight');
      expect(itemTypes).toContain('Hotel');
      expect(itemTypes).toContain('Package');
      expect(itemTypes).toContain('Insurance');
      expect(itemTypes).toContain('Visa');
    });

    it('should filter revenue by specific item type', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/revenue?itemType=Package')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.filters.itemType).toBe('Package');
    });

    it('should handle different period filters', async () => {
      const periods = ['7d', '30d', '90d', '1y'];
      
      for (const period of periods) {
        const response = await request(app)
          .get(`/api/v1/analytics/revenue?period=${period}`)
          .set('x-test-user-role', UserRoles.MANAGER)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('dateRange');
        expect(response.body.data.dateRange).toHaveProperty('startDate');
        expect(response.body.data.dateRange).toHaveProperty('endDate');
      }
    });
  });

  describe('Customer Analytics - Comprehensive Tests', () => {
    it('should return comprehensive customer behavior analytics', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/customers')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('customerSegments');
      expect(response.body.data).toHaveProperty('bookingChannels');
      expect(response.body.data).toHaveProperty('customerMetrics');

      // Check customer segments
      expect(response.body.data.customerSegments).toHaveLength(4);
      const segments = response.body.data.customerSegments.map(s => s.segment);
      expect(segments).toContain('VIP');
      expect(segments).toContain('Premium');
      expect(segments).toContain('Standard');
      expect(segments).toContain('Basic');

      // Check booking channels
      expect(response.body.data.bookingChannels).toHaveLength(3);
      const channels = response.body.data.bookingChannels.map(c => c.channel);
      expect(channels).toContain('Web');
      expect(channels).toContain('Mobile');
      expect(channels).toContain('Agent');

      // Check customer metrics
      expect(response.body.data.customerMetrics.totalCustomers).toBe(8);
      expect(response.body.data.customerMetrics.repeatCustomerRate).toBe(25);
    });
  });

  describe('Product Performance Analytics - Comprehensive Tests', () => {
    it('should return performance analytics for all product types', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/products')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('itemPerformance');
      expect(response.body.data).toHaveProperty('seasonalityData');

      // Check all item types are present
      expect(response.body.data.itemPerformance).toHaveLength(5);
      const itemTypes = response.body.data.itemPerformance.map(item => item.itemType);
      expect(itemTypes).toContain('Flight');
      expect(itemTypes).toContain('Hotel');
      expect(itemTypes).toContain('Package');
      expect(itemTypes).toContain('Insurance');
      expect(itemTypes).toContain('Visa');

      // Check seasonality data
      expect(response.body.data.seasonalityData).toHaveLength(3);
      const seasons = response.body.data.seasonalityData.map(s => s.season);
      expect(seasons).toContain('Peak');
      expect(seasons).toContain('Off-Peak');
      expect(seasons).toContain('Shoulder');
    });
  });

  describe('Daily Revenue Trend - Comprehensive Tests', () => {
    it('should return daily revenue trend with multiple data points', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/revenue/trend')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('trend');
      expect(Array.isArray(response.body.data.trend)).toBe(true);
      expect(response.body.data.trend).toHaveLength(4);
      expect(response.body.data.totalDataPoints).toBe(4);

      // Check trend data structure
      response.body.data.trend.forEach(day => {
        expect(day).toHaveProperty('date');
        expect(day).toHaveProperty('dailyRevenue');
        expect(day).toHaveProperty('dailyProfit');
        expect(day).toHaveProperty('transactionCount');
        expect(day).toHaveProperty('profitMarginPercentage');
      });
    });
  });

  describe('Profit Margin Analysis - Comprehensive Tests', () => {
    it('should calculate accurate profit margins by service type', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/profit-margins')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('overall');
      expect(response.body.data).toHaveProperty('byServiceType');
      expect(response.body.data).toHaveProperty('performanceRanking');

      // Check overall metrics
      expect(response.body.data.overall.totalRevenue).toBe(500000);
      expect(response.body.data.overall.totalProfit).toBe(75000);
      expect(response.body.data.overall.profitMarginPercentage).toBe(15);

      // Check service type breakdown
      expect(response.body.data.byServiceType).toHaveLength(5);
      
      // Check performance ranking
      expect(response.body.data.performanceRanking).toHaveLength(5);
      expect(response.body.data.performanceRanking[0]).toHaveProperty('rank', 1);
    });
  });

  describe('Real-time Metrics - Comprehensive Tests', () => {
    it('should return comprehensive real-time metrics', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/realtime')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('today');
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('recentTransactions');
      expect(response.body.data).toHaveProperty('lastUpdated');

      // Check recent transactions
      expect(Array.isArray(response.body.data.recentTransactions)).toBe(true);
      expect(response.body.data.recentTransactions.length).toBeGreaterThan(0);
    });
  });

  describe('Analytics Summary - Comprehensive Tests', () => {
    it('should return comprehensive analytics summary with period comparison', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/summary')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('currentPeriod');
      expect(response.body.data).toHaveProperty('previousPeriod');
      expect(response.body.data).toHaveProperty('changes');
      expect(response.body.data).toHaveProperty('realTime');
      expect(response.body.data).toHaveProperty('dateRanges');

      // Check changes calculations
      expect(response.body.data.changes).toHaveProperty('revenueChange');
      expect(response.body.data.changes).toHaveProperty('profitChange');
      expect(response.body.data.changes).toHaveProperty('transactionChange');
      expect(response.body.data.changes).toHaveProperty('avgTransactionChange');
    });
  });

  describe('Cache Management - Comprehensive Tests', () => {
    it('should clear all analytics cache', async () => {
      const response = await request(app)
        .delete('/api/v1/analytics/cache')
        .set('x-test-user-role', UserRoles.EXECUTIVE)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('deletedCount');
      expect(response.body.data.category).toBe('all');
    });

    it('should clear cache by category', async () => {
      const response = await request(app)
        .delete('/api/v1/analytics/cache?category=revenue')
        .set('x-test-user-role', UserRoles.EXECUTIVE)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('deletedCount');
      expect(response.body.data.category).toBe('revenue');
    });
  });

  describe('Role-based Access Control - Comprehensive Tests', () => {
    it('should allow access for all authorized roles', async () => {
      const authorizedRoles = [UserRoles.MANAGER, UserRoles.EXECUTIVE, UserRoles.ADMIN];
      
      for (const role of authorizedRoles) {
        const response = await request(app)
          .get('/api/v1/analytics/summary')
          .set('x-test-user-role', role)
          .expect(200);

        expect(response.body.success).toBe(true);
      }
    });

    it('should deny access for unauthorized roles', async () => {
      const unauthorizedRoles = [UserRoles.USER, 'Guest', 'Customer'];
      
      for (const role of unauthorizedRoles) {
        await request(app)
          .get('/api/v1/analytics/summary')
          .set('x-test-user-role', role)
          .expect(403);
      }
    });

    it('should require Executive+ role for cache management', async () => {
      // Manager should be denied
      await request(app)
        .delete('/api/v1/analytics/cache')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(403);

      // Executive should be allowed
      await request(app)
        .delete('/api/v1/analytics/cache')
        .set('x-test-user-role', UserRoles.EXECUTIVE)
        .expect(200);

      // Admin should be allowed
      await request(app)
        .delete('/api/v1/analytics/cache')
        .set('x-test-user-role', UserRoles.ADMIN)
        .expect(200);
    });
  });

  describe('Data Validation - Comprehensive Tests', () => {
    it('should validate all supported item types', async () => {
      const validItemTypes = ['Flight', 'Hotel', 'Insurance', 'Visa', 'Package'];
      
      for (const itemType of validItemTypes) {
        const response = await request(app)
          .get(`/api/v1/analytics/revenue?itemType=${itemType}`)
          .set('x-test-user-role', UserRoles.MANAGER)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.filters.itemType).toBe(itemType);
      }
    });

    it('should reject invalid item types', async () => {
      const invalidItemTypes = ['InvalidType', 'Car', 'Train', 'Bus'];
      
      for (const itemType of invalidItemTypes) {
        await request(app)
          .get(`/api/v1/analytics/revenue?itemType=${itemType}`)
          .set('x-test-user-role', UserRoles.MANAGER)
          .expect(400);
      }
    });

    it('should validate date range boundaries', async () => {
      const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      const pastDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
      
      // Future start date should be rejected
      await request(app)
        .get(`/api/v1/analytics/revenue?startDate=${futureDate}`)
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(400);

      // Valid past date range should be accepted
      const response = await request(app)
        .get(`/api/v1/analytics/revenue?startDate=${pastDate}&endDate=${new Date().toISOString()}`)
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Performance and Caching - Comprehensive Tests', () => {
    it('should handle cache hits and misses', async () => {
      // First request - cache miss
      AnalyticsCache.getCache.mockResolvedValueOnce(null);
      
      const response1 = await request(app)
        .get('/api/v1/analytics/revenue')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response1.body.success).toBe(true);
      expect(AnalyticsCache.setCache).toHaveBeenCalled();

      // Second request - cache hit
      const cachedData = {
        totalRevenue: 500000,
        totalProfit: 75000,
        totalTransactions: 10,
        averageTransactionValue: 50000,
        profitMarginPercentage: 15,
        revenueByItemType: []
      };
      
      AnalyticsCache.getCache.mockResolvedValueOnce(cachedData);
      
      const response2 = await request(app)
        .get('/api/v1/analytics/revenue')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response2.body.success).toBe(true);
      expect(response2.body.data.totalRevenue).toBe(500000);
    });

    it('should handle empty data gracefully', async () => {
      // Mock empty aggregation results
      Ledger.aggregate.mockResolvedValueOnce([]);
      
      const response = await request(app)
        .get('/api/v1/analytics/revenue')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalRevenue).toBe(0);
      expect(response.body.data.totalTransactions).toBe(0);
      expect(response.body.data.revenueByItemType).toEqual([]);
    });
  });
});