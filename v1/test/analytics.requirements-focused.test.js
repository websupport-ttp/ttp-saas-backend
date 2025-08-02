// v1/test/analytics.requirements-focused.test.js
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

describe('Analytics Controller - Requirements Focused Tests', () => {
  beforeAll(() => {
    setupTestEnvironment();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setupAnalyticsMocks();
  });

  function setupAnalyticsMocks() {
    // Setup comprehensive mock data for analytics testing
    const revenueAggregationResult = [{
      _id: null,
      totalRevenue: 500000,
      totalProfit: 75000,
      totalServiceCharges: 25000,
      totalTransactions: 50,
      averageTransactionValue: 10000,
      profitMarginPercentage: 15,
      revenueByItemType: [
        { itemType: 'Flight', amount: 200000, profit: 30000 },
        { itemType: 'Hotel', amount: 150000, profit: 22500 },
        { itemType: 'Package', amount: 100000, profit: 15000 },
        { itemType: 'Insurance', amount: 30000, profit: 4500 },
        { itemType: 'Visa', amount: 20000, profit: 3000 }
      ]
    }];

    const customerSegmentResult = [
      { segment: 'VIP', totalRevenue: 200000, totalProfit: 35000, transactionCount: 10, averageTransactionValue: 20000 },
      { segment: 'Premium', totalRevenue: 150000, totalProfit: 25000, transactionCount: 15, averageTransactionValue: 10000 },
      { segment: 'Standard', totalRevenue: 100000, totalProfit: 12000, transactionCount: 20, averageTransactionValue: 5000 },
      { segment: 'Basic', totalRevenue: 50000, totalProfit: 3000, transactionCount: 5, averageTransactionValue: 10000 }
    ];

    const bookingChannelResult = [
      { channel: 'Web', totalRevenue: 250000, transactionCount: 25, averageTransactionValue: 10000 },
      { channel: 'Mobile', totalRevenue: 150000, transactionCount: 15, averageTransactionValue: 10000 },
      { channel: 'Agent', totalRevenue: 100000, transactionCount: 10, averageTransactionValue: 10000 }
    ];

    const customerMetricsResult = [{
      totalCustomers: 45,
      newCustomers: 35,
      repeatCustomers: 10,
      repeatCustomerRate: 22.22,
      averageTransactionsPerCustomer: 1.11,
      averageCustomerValue: 11111.11
    }];

    const productAggregationResult = [
      { itemType: 'Flight', totalRevenue: 200000, totalProfit: 30000, transactionCount: 20, averageTransactionValue: 10000, averageProfit: 1500, profitMarginPercentage: 15 },
      { itemType: 'Hotel', totalRevenue: 150000, totalProfit: 22500, transactionCount: 15, averageTransactionValue: 10000, averageProfit: 1500, profitMarginPercentage: 15 },
      { itemType: 'Package', totalRevenue: 100000, totalProfit: 15000, transactionCount: 10, averageTransactionValue: 10000, averageProfit: 1500, profitMarginPercentage: 15 },
      { itemType: 'Insurance', totalRevenue: 30000, totalProfit: 4500, transactionCount: 3, averageTransactionValue: 10000, averageProfit: 1500, profitMarginPercentage: 15 },
      { itemType: 'Visa', totalRevenue: 20000, totalProfit: 3000, transactionCount: 2, averageTransactionValue: 10000, averageProfit: 1500, profitMarginPercentage: 15 }
    ];

    const seasonalityResult = [
      { season: 'Peak', totalRevenue: 300000, transactionCount: 30, averageTransactionValue: 10000 },
      { season: 'Off-Peak', totalRevenue: 150000, transactionCount: 15, averageTransactionValue: 10000 },
      { season: 'Shoulder', totalRevenue: 50000, transactionCount: 5, averageTransactionValue: 10000 }
    ];

    const dailyTrendResult = [
      { date: new Date('2024-01-01'), dailyRevenue: 100000, dailyProfit: 15000, transactionCount: 10, averageTransactionValue: 10000, profitMarginPercentage: 15 },
      { date: new Date('2024-01-02'), dailyRevenue: 150000, dailyProfit: 22500, transactionCount: 15, averageTransactionValue: 10000, profitMarginPercentage: 15 },
      { date: new Date('2024-01-03'), dailyRevenue: 200000, dailyProfit: 30000, transactionCount: 20, averageTransactionValue: 10000, profitMarginPercentage: 15 },
      { date: new Date('2024-01-04'), dailyRevenue: 50000, dailyProfit: 7500, transactionCount: 5, averageTransactionValue: 10000, profitMarginPercentage: 15 }
    ];

    // Setup Ledger.aggregate mock to return different results based on pipeline
    Ledger.aggregate.mockImplementation((pipeline) => {
      const pipelineStr = JSON.stringify(pipeline);
      
      if (pipelineStr.includes('revenueByItemType')) {
        return Promise.resolve(revenueAggregationResult);
      } else if (pipelineStr.includes('customerSegment')) {
        return Promise.resolve(customerSegmentResult);
      } else if (pipelineStr.includes('bookingChannel')) {
        return Promise.resolve(bookingChannelResult);
      } else if (pipelineStr.includes('repeatCustomers')) {
        return Promise.resolve(customerMetricsResult);
      } else if (pipelineStr.includes('itemType') && pipelineStr.includes('profitMarginPercentage')) {
        return Promise.resolve(productAggregationResult);
      } else if (pipelineStr.includes('seasonality')) {
        return Promise.resolve(seasonalityResult);
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

  describe('Task Requirement 2.1: Revenue Calculation Accuracy', () => {
    it('should calculate total revenue accurately from aggregated transaction data', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/revenue')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalRevenue).toBe(500000);
      expect(response.body.data.totalProfit).toBe(75000);
      expect(response.body.data.totalTransactions).toBe(50);
      expect(response.body.data.averageTransactionValue).toBe(10000);
      expect(response.body.data.profitMarginPercentage).toBe(15);
    });

    it('should accurately calculate revenue breakdown by item type', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/revenue')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.revenueByItemType).toHaveLength(5);
      
      // Verify Flight revenue calculation
      const flightRevenue = response.body.data.revenueByItemType.find(item => item.itemType === 'Flight');
      expect(flightRevenue.totalRevenue).toBe(200000);
      expect(flightRevenue.totalProfit).toBe(30000);
      expect(flightRevenue.transactionCount).toBe(1);
      expect(flightRevenue.averageValue).toBe(200000);

      // Verify Package revenue calculation
      const packageRevenue = response.body.data.revenueByItemType.find(item => item.itemType === 'Package');
      expect(packageRevenue.totalRevenue).toBe(100000);
      expect(packageRevenue.totalProfit).toBe(15000);
      expect(packageRevenue.transactionCount).toBe(1);
      expect(packageRevenue.averageValue).toBe(100000);
    });

    it('should handle zero revenue scenarios correctly', async () => {
      // Mock empty aggregation result
      Ledger.aggregate.mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/api/v1/analytics/revenue')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalRevenue).toBe(0);
      expect(response.body.data.totalProfit).toBe(0);
      expect(response.body.data.totalTransactions).toBe(0);
      expect(response.body.data.averageTransactionValue).toBe(0);
      expect(response.body.data.profitMarginPercentage).toBe(0);
      expect(response.body.data.revenueByItemType).toEqual([]);
    });

    it('should maintain precision in financial calculations', async () => {
      // Test with decimal values
      const precisionData = [{
        _id: null,
        totalRevenue: 123456.78,
        totalProfit: 18518.52,
        totalServiceCharges: 6172.84,
        totalTransactions: 10,
        averageTransactionValue: 12345.678,
        profitMarginPercentage: 15.0001,
        revenueByItemType: [
          { itemType: 'Flight', amount: 61728.39, profit: 9259.26 },
          { itemType: 'Hotel', amount: 37037.04, profit: 5555.56 },
          { itemType: 'Package', amount: 24691.35, profit: 3703.70 }
        ]
      }];

      Ledger.aggregate.mockResolvedValueOnce(precisionData);

      const response = await request(app)
        .get('/api/v1/analytics/revenue')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalRevenue).toBeCloseTo(123456.78, 2);
      expect(response.body.data.totalProfit).toBeCloseTo(18518.52, 2);
      expect(response.body.data.profitMarginPercentage).toBeCloseTo(15.0001, 4);
      expect(response.body.data.averageTransactionValue).toBeCloseTo(12345.678, 3);
    });
  });

  describe('Task Requirement 5.1, 5.2, 5.3: Customer Behavior Analytics Validation', () => {
    it('should accurately segment customers and calculate behavior metrics', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/customers')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('customerSegments');
      expect(response.body.data).toHaveProperty('bookingChannels');
      expect(response.body.data).toHaveProperty('customerMetrics');

      // Validate customer segments
      expect(response.body.data.customerSegments).toHaveLength(4);
      const vipSegment = response.body.data.customerSegments.find(s => s.segment === 'VIP');
      expect(vipSegment.totalRevenue).toBe(200000);
      expect(vipSegment.averageTransactionValue).toBe(20000);
      expect(vipSegment.transactionCount).toBe(10);

      // Validate booking channels
      expect(response.body.data.bookingChannels).toHaveLength(3);
      const webChannel = response.body.data.bookingChannels.find(c => c.channel === 'Web');
      expect(webChannel.totalRevenue).toBe(250000);
      expect(webChannel.transactionCount).toBe(25);
      expect(webChannel.averageTransactionValue).toBe(10000);

      // Validate customer metrics
      expect(response.body.data.customerMetrics.totalCustomers).toBe(45);
      expect(response.body.data.customerMetrics.newCustomers).toBe(35);
      expect(response.body.data.customerMetrics.repeatCustomers).toBe(10);
      expect(response.body.data.customerMetrics.repeatCustomerRate).toBeCloseTo(22.22, 2);
      expect(response.body.data.customerMetrics.averageCustomerValue).toBeCloseTo(11111.11, 2);
    });

    it('should handle customer analytics with no repeat customers', async () => {
      const noRepeatCustomersData = [{
        totalCustomers: 20,
        newCustomers: 20,
        repeatCustomers: 0,
        repeatCustomerRate: 0,
        averageTransactionsPerCustomer: 1,
        averageCustomerValue: 5000
      }];

      Ledger.aggregate.mockImplementation((pipeline) => {
        const pipelineStr = JSON.stringify(pipeline);
        if (pipelineStr.includes('repeatCustomers')) {
          return Promise.resolve(noRepeatCustomersData);
        }
        return Promise.resolve([]);
      });

      const response = await request(app)
        .get('/api/v1/analytics/customers')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.customerMetrics.totalCustomers).toBe(20);
      expect(response.body.data.customerMetrics.repeatCustomerRate).toBe(0);
      expect(response.body.data.customerMetrics.newCustomers).toBe(20);
      expect(response.body.data.customerMetrics.repeatCustomers).toBe(0);
    });

    it('should validate customer lifetime value calculations', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/customers')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // Calculate expected total revenue from segments
      const totalSegmentRevenue = response.body.data.customerSegments.reduce((sum, segment) => sum + segment.totalRevenue, 0);
      expect(totalSegmentRevenue).toBe(500000); // VIP(200k) + Premium(150k) + Standard(100k) + Basic(50k)
      
      // Validate average customer value calculation
      const expectedAvgCustomerValue = totalSegmentRevenue / response.body.data.customerMetrics.totalCustomers;
      expect(response.body.data.customerMetrics.averageCustomerValue).toBeCloseTo(expectedAvgCustomerValue, 2);
    });
  });

  describe('Task Requirement 5.4: Profit Margin Calculations', () => {
    it('should calculate profit margins correctly for each service type', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/profit-margins')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('overall');
      expect(response.body.data).toHaveProperty('byServiceType');
      expect(response.body.data).toHaveProperty('performanceRanking');

      // Validate overall profit margin
      expect(response.body.data.overall.totalRevenue).toBe(500000);
      expect(response.body.data.overall.totalProfit).toBe(75000);
      expect(response.body.data.overall.profitMarginPercentage).toBe(15);

      // Validate service type breakdown
      expect(response.body.data.byServiceType).toHaveLength(5);
      
      // Check that all service types are present
      const serviceTypes = response.body.data.byServiceType.map(s => s.serviceType);
      expect(serviceTypes).toContain('Flight');
      expect(serviceTypes).toContain('Hotel');
      expect(serviceTypes).toContain('Package');
      expect(serviceTypes).toContain('Insurance');
      expect(serviceTypes).toContain('Visa');

      // Validate performance ranking
      expect(response.body.data.performanceRanking).toHaveLength(5);
      expect(response.body.data.performanceRanking[0]).toHaveProperty('rank', 1);
      expect(response.body.data.performanceRanking[4]).toHaveProperty('rank', 5);
    });

    it('should handle zero profit margin calculations', async () => {
      // Mock zero profit scenario
      const zeroProfitData = [{
        _id: null,
        totalRevenue: 100000,
        totalProfit: 0,
        totalServiceCharges: 5000,
        totalTransactions: 10,
        averageTransactionValue: 10000,
        profitMarginPercentage: 0,
        revenueByItemType: [
          { itemType: 'Flight', amount: 100000, profit: 0 }
        ]
      }];

      let callCount = 0;
      Ledger.aggregate.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.resolve(zeroProfitData);
        if (callCount === 2) return Promise.resolve([
          { itemType: 'Flight', totalRevenue: 100000, totalProfit: 0, transactionCount: 10, profitMarginPercentage: 0 }
        ]);
        return Promise.resolve([]);
      });

      const response = await request(app)
        .get('/api/v1/analytics/profit-margins')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.overall.profitMarginPercentage).toBe(0);
      expect(response.body.data.byServiceType).toHaveLength(1);
      expect(response.body.data.byServiceType[0].profitMarginPercentage).toBe('0.00');
    });

    it('should rank services correctly by profit margin performance', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/profit-margins')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.performanceRanking).toHaveLength(5);
      
      // Verify ranking is in descending order of profit margin
      for (let i = 0; i < response.body.data.performanceRanking.length - 1; i++) {
        const current = response.body.data.performanceRanking[i];
        const next = response.body.data.performanceRanking[i + 1];
        expect(current.profitMarginPercentage).toBeGreaterThanOrEqual(next.profitMarginPercentage);
        expect(current.rank).toBe(i + 1);
      }
    });
  });

  describe('Data Filtering and Caching Tests', () => {
    it('should implement caching correctly with proper cache keys', async () => {
      // First request - cache miss
      AnalyticsCache.getCache.mockResolvedValueOnce(null);
      
      const response1 = await request(app)
        .get('/api/v1/analytics/revenue')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response1.body.success).toBe(true);
      expect(AnalyticsCache.setCache).toHaveBeenCalledWith(
        expect.stringContaining('revenue_'),
        expect.any(Object),
        60,
        'revenue'
      );

      // Second request - cache hit
      const cachedData = {
        totalRevenue: 500000,
        totalProfit: 75000,
        totalTransactions: 50,
        averageTransactionValue: 10000,
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

    it('should filter data by date range correctly', async () => {
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

    it('should filter data by item type correctly', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/revenue?itemType=Package')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.filters.itemType).toBe('Package');
    });

    it('should handle period-based filtering', async () => {
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

    it('should clear cache by category', async () => {
      const response = await request(app)
        .delete('/api/v1/analytics/cache?category=revenue')
        .set('x-test-user-role', UserRoles.EXECUTIVE)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('deletedCount');
      expect(response.body.data.category).toBe('revenue');
      expect(AnalyticsCache.invalidateCacheByCategory).toHaveBeenCalledWith('revenue');
    });

    it('should clear all cache when no category specified', async () => {
      const response = await request(app)
        .delete('/api/v1/analytics/cache')
        .set('x-test-user-role', UserRoles.EXECUTIVE)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('deletedCount');
      expect(response.body.data.category).toBe('all');
      expect(AnalyticsCache.deleteMany).toHaveBeenCalledWith({});
    });

    it('should validate complex filter combinations', async () => {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date().toISOString();

      const response = await request(app)
        .get(`/api/v1/analytics/revenue?itemType=Flight&startDate=${startDate}&endDate=${endDate}`)
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.filters.itemType).toBe('Flight');
      expect(response.body.data.dateRange.startDate).toBe(startDate);
      expect(response.body.data.dateRange.endDate).toBe(endDate);
    });
  });

  describe('Real-time Metrics and Performance', () => {
    it('should return current day metrics', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/realtime')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('today');
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('recentTransactions');
      expect(response.body.data).toHaveProperty('lastUpdated');
      
      // Validate recent transactions structure
      expect(Array.isArray(response.body.data.recentTransactions)).toBe(true);
      if (response.body.data.recentTransactions.length > 0) {
        const transaction = response.body.data.recentTransactions[0];
        expect(transaction).toHaveProperty('itemType');
        expect(transaction).toHaveProperty('totalAmountPaid');
        expect(transaction).toHaveProperty('transactionReference');
      }
    });

    it('should handle empty data gracefully', async () => {
      // Mock empty aggregation results
      Ledger.aggregate.mockResolvedValue([]);
      Ledger.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue([])
      });
      
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