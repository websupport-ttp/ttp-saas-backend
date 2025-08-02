// v1/test/analytics.test.js
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
jest.mock('../middleware/cacheMiddleware', () => ({
  cacheMiddleware: () => (req, res, next) => next(),
  rateLimitByRole: () => (req, res, next) => next(),
  invalidateCache: () => (req, res, next) => next(),
  getCacheStats: jest.fn().mockResolvedValue({ connected: true })
}));

describe('Analytics Controller', () => {
  beforeAll(() => {
    setupTestEnvironment();
  });

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup mock data for analytics aggregations
    setupAnalyticsMocks();
  });

  // Helper function to setup analytics mocks
  function setupAnalyticsMocks() {
    // Mock revenue analytics aggregation
    const revenueAggregationResult = [{
      _id: null,
      totalRevenue: 158000,
      totalProfit: 23000,
      totalServiceCharges: 8000,
      totalTransactions: 2,
      averageTransactionValue: 79000,
      profitMarginPercentage: 14.56,
      revenueByItemType: [
        { itemType: 'Flight', amount: 105000, profit: 15000 },
        { itemType: 'Hotel', amount: 53000, profit: 8000 }
      ]
    }];

    // Mock customer analytics aggregation
    const customerSegmentResult = [
      { segment: 'Individual', totalRevenue: 105000, totalProfit: 15000, transactionCount: 1, averageTransactionValue: 105000 },
      { segment: 'Business', totalRevenue: 53000, totalProfit: 8000, transactionCount: 1, averageTransactionValue: 53000 }
    ];

    const bookingChannelResult = [
      { channel: 'Web', totalRevenue: 105000, transactionCount: 1, averageTransactionValue: 105000 },
      { channel: 'Mobile', totalRevenue: 53000, transactionCount: 1, averageTransactionValue: 53000 }
    ];

    const customerMetricsResult = [{
      totalCustomers: 2,
      newCustomers: 2,
      repeatCustomers: 0,
      repeatCustomerRate: 0,
      averageTransactionsPerCustomer: 1,
      averageCustomerValue: 79000
    }];

    // Mock product analytics aggregation
    const productAggregationResult = [
      { itemType: 'Flight', totalRevenue: 105000, totalProfit: 15000, transactionCount: 1, averageTransactionValue: 105000, averageProfit: 15000, profitMarginPercentage: 14.29 },
      { itemType: 'Hotel', totalRevenue: 53000, totalProfit: 8000, transactionCount: 1, averageTransactionValue: 53000, averageProfit: 8000, profitMarginPercentage: 15.09 }
    ];

    const seasonalityResult = [
      { season: 'Peak', totalRevenue: 105000, transactionCount: 1, averageTransactionValue: 105000 },
      { season: 'Off-Peak', totalRevenue: 53000, transactionCount: 1, averageTransactionValue: 53000 }
    ];

    // Mock daily trend aggregation
    const dailyTrendResult = [
      { date: new Date(), dailyRevenue: 158000, dailyProfit: 23000, transactionCount: 2, averageTransactionValue: 79000, profitMarginPercentage: 14.56 }
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
        { itemType: 'Flight', totalAmountPaid: 105000, createdAt: new Date(), transactionReference: 'TXN001' },
        { itemType: 'Hotel', totalAmountPaid: 53000, createdAt: new Date(), transactionReference: 'TXN002' }
      ])
    });

    // Mock AnalyticsCache methods
    AnalyticsCache.getCache = jest.fn().mockResolvedValue(null);
    AnalyticsCache.setCache = jest.fn().mockResolvedValue(true);
    AnalyticsCache.deleteMany = jest.fn().mockResolvedValue({ deletedCount: 0 });

    // Mock User and Ledger deleteMany
    User.deleteMany = jest.fn().mockResolvedValue({ deletedCount: 0 });
    Ledger.deleteMany = jest.fn().mockResolvedValue({ deletedCount: 0 });
    Ledger.insertMany = jest.fn().mockResolvedValue([]);
  }

  describe('GET /api/v1/analytics/revenue', () => {
    it('should return revenue analytics for manager', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/revenue')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalRevenue');
      expect(response.body.data).toHaveProperty('totalProfit');
      expect(response.body.data).toHaveProperty('totalTransactions');
      expect(response.body.data).toHaveProperty('revenueByItemType');
      expect(response.body.data.totalRevenue).toBe(158000);
      expect(response.body.data.totalProfit).toBe(23000);
    });

    it('should deny access to regular user', async () => {
      await request(app)
        .get('/api/v1/analytics/revenue')
        .set('x-test-user-role', UserRoles.USER)
        .expect(403);
    });

    it('should filter by item type', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/revenue?itemType=Flight')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.data.totalRevenue).toBe(158000);
      expect(response.body.data.totalProfit).toBe(23000);
      expect(response.body.data.filters.itemType).toBe('Flight');
    });
  });

  describe('GET /api/v1/analytics/customers', () => {
    it('should return customer behavior analytics', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/customers')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('customerSegments');
      expect(response.body.data).toHaveProperty('bookingChannels');
      expect(response.body.data).toHaveProperty('customerMetrics');
      
      // Check customer segments
      expect(response.body.data.customerSegments).toHaveLength(2);
      const individualSegment = response.body.data.customerSegments.find(s => s.segment === 'Individual');
      const businessSegment = response.body.data.customerSegments.find(s => s.segment === 'Business');
      
      expect(individualSegment.totalRevenue).toBe(105000);
      expect(businessSegment.totalRevenue).toBe(53000);
    });
  });

  describe('GET /api/v1/analytics/products', () => {
    it('should return product performance analytics', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/products')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('itemPerformance');
      expect(response.body.data).toHaveProperty('seasonalityData');
      
      // Check item performance
      expect(response.body.data.itemPerformance).toHaveLength(2);
      const flightPerformance = response.body.data.itemPerformance.find(p => p.itemType === 'Flight');
      const hotelPerformance = response.body.data.itemPerformance.find(p => p.itemType === 'Hotel');
      
      expect(flightPerformance.totalRevenue).toBe(105000);
      expect(hotelPerformance.totalRevenue).toBe(53000);
    });
  });

  describe('GET /api/v1/analytics/profit-margins', () => {
    it('should return detailed profit margin analysis', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/profit-margins')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('overall');
      expect(response.body.data).toHaveProperty('byServiceType');
      expect(response.body.data).toHaveProperty('performanceRanking');
      
      // Check overall metrics
      expect(response.body.data.overall.totalRevenue).toBe(158000);
      expect(response.body.data.overall.totalProfit).toBe(23000);
      
      // Check service type breakdown
      expect(response.body.data.byServiceType).toHaveLength(2);
      const flightMargin = response.body.data.byServiceType.find(s => s.serviceType === 'Flight');
      expect(flightMargin.profitMarginPercentage).toBe('14.29'); // 15000/105000 * 100
    });
  });

  describe('GET /api/v1/analytics/dashboard', () => {
    it('should return comprehensive dashboard data', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/dashboard')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('overview');
      expect(response.body.data).toHaveProperty('revenue');
      expect(response.body.data).toHaveProperty('customers');
      expect(response.body.data).toHaveProperty('products');
      expect(response.body.data).toHaveProperty('trends');
      
      // Check overview
      expect(response.body.data.overview.totalRevenue).toBe(158000);
      expect(response.body.data.overview.totalTransactions).toBe(2);
    });
  });

  describe('GET /api/v1/analytics/realtime', () => {
    it('should return real-time metrics', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/realtime')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('today');
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('recentTransactions');
      expect(response.body.data).toHaveProperty('lastUpdated');
    });
  });

  describe('GET /api/v1/analytics/summary', () => {
    it('should return analytics summary with period comparison', async () => {
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
    });
  });

  describe('Date range filtering', () => {
    it('should accept period parameter', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/revenue?period=7d')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.data).toHaveProperty('dateRange');
      expect(response.body.data.dateRange).toHaveProperty('startDate');
      expect(response.body.data.dateRange).toHaveProperty('endDate');
    });

    it('should accept custom date range', async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date().toISOString();
      
      const response = await request(app)
        .get(`/api/v1/analytics/revenue?startDate=${startDate}&endDate=${endDate}`)
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.data.dateRange.startDate).toBe(startDate);
      expect(response.body.data.dateRange.endDate).toBe(endDate);
    });

    it('should reject invalid date format', async () => {
      await request(app)
        .get('/api/v1/analytics/revenue?startDate=invalid-date')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(400);
    });

    it('should reject start date after end date', async () => {
      const startDate = new Date().toISOString();
      const endDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      await request(app)
        .get(`/api/v1/analytics/revenue?startDate=${startDate}&endDate=${endDate}`)
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(400);
    });
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication', async () => {
      await request(app)
        .get('/api/v1/analytics/revenue')
        .expect(401);
    });

    it('should require manager+ role', async () => {
      await request(app)
        .get('/api/v1/analytics/revenue')
        .set('x-test-user-role', UserRoles.USER)
        .expect(403);
    });
  });

  describe('Cache functionality', () => {
    it('should cache analytics data', async () => {
      // First request should populate cache
      const response1 = await request(app)
        .get('/api/v1/analytics/revenue')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response1.body.success).toBe(true);

      // Second request should use cached data
      const response2 = await request(app)
        .get('/api/v1/analytics/revenue')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response2.body.success).toBe(true);
      expect(response2.body.data.totalRevenue).toBe(response1.body.data.totalRevenue);
    });
  });

  describe('Data filtering and validation', () => {
    it('should validate date range parameters', async () => {
      // Test invalid date format
      await request(app)
        .get('/api/v1/analytics/revenue?startDate=not-a-date')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(400);
    });

    it('should validate item type parameter', async () => {
      // Test invalid item type
      await request(app)
        .get('/api/v1/analytics/revenue?itemType=InvalidType')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(400);
    });

    it('should handle empty data gracefully', async () => {
      // Mock empty data response
      Ledger.aggregate.mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/api/v1/analytics/revenue')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalRevenue).toBe(0);
      expect(response.body.data.totalTransactions).toBe(0);
    });
  });

  describe('Revenue Calculation Accuracy Tests', () => {
    it('should calculate total revenue accurately from multiple transactions', async () => {
      // Setup specific test data for revenue calculation
      const testTransactions = [
        { totalAmountPaid: 50000, profitMargin: 7500, serviceCharge: 2500, itemType: 'Flight' },
        { totalAmountPaid: 30000, profitMargin: 4500, serviceCharge: 1500, itemType: 'Hotel' },
        { totalAmountPaid: 75000, profitMargin: 11250, serviceCharge: 3750, itemType: 'Package' }
      ];

      const expectedTotalRevenue = testTransactions.reduce((sum, t) => sum + t.totalAmountPaid, 0);
      const expectedTotalProfit = testTransactions.reduce((sum, t) => sum + t.profitMargin, 0);
      const expectedTotalServiceCharges = testTransactions.reduce((sum, t) => sum + t.serviceCharge, 0);
      const expectedAvgTransaction = expectedTotalRevenue / testTransactions.length;
      const expectedProfitMargin = (expectedTotalProfit / expectedTotalRevenue) * 100;

      // Mock aggregation to return our test data
      Ledger.aggregate.mockResolvedValueOnce([{
        _id: null,
        totalRevenue: expectedTotalRevenue,
        totalProfit: expectedTotalProfit,
        totalServiceCharges: expectedTotalServiceCharges,
        totalTransactions: testTransactions.length,
        averageTransactionValue: expectedAvgTransaction,
        profitMarginPercentage: expectedProfitMargin,
        revenueByItemType: testTransactions.map(t => ({
          itemType: t.itemType,
          amount: t.totalAmountPaid,
          profit: t.profitMargin
        }))
      }]);

      const response = await request(app)
        .get('/api/v1/analytics/revenue')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalRevenue).toBe(expectedTotalRevenue);
      expect(response.body.data.totalProfit).toBe(expectedTotalProfit);
      expect(response.body.data.totalServiceCharges).toBe(expectedTotalServiceCharges);
      expect(response.body.data.totalTransactions).toBe(testTransactions.length);
      expect(response.body.data.averageTransactionValue).toBe(expectedAvgTransaction);
      expect(response.body.data.profitMarginPercentage).toBeCloseTo(expectedProfitMargin, 2);
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
    });

    it('should calculate revenue by item type accurately', async () => {
      // Mock the raw transaction data that would be processed by the service
      const rawTransactions = [
        { itemType: 'Flight', amount: 50000, profit: 7500 },
        { itemType: 'Flight', amount: 50000, profit: 7500 },
        { itemType: 'Hotel', amount: 25000, profit: 3750 },
        { itemType: 'Hotel', amount: 25000, profit: 3750 },
        { itemType: 'Hotel', amount: 25000, profit: 3750 },
        { itemType: 'Package', amount: 50000, profit: 7500 }
      ];

      // Mock the aggregation result as it would come from the service
      Ledger.aggregate.mockResolvedValueOnce([{
        _id: null,
        totalRevenue: 225000,
        totalProfit: 33750,
        totalServiceCharges: 11250,
        totalTransactions: 6,
        averageTransactionValue: 37500,
        profitMarginPercentage: 15,
        revenueByItemType: rawTransactions
      }]);

      const response = await request(app)
        .get('/api/v1/analytics/revenue')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.revenueByItemType).toHaveLength(3);
      
      const flightData = response.body.data.revenueByItemType.find(item => item.itemType === 'Flight');
      expect(flightData).toBeDefined();
      expect(flightData.totalRevenue).toBe(100000);
      expect(flightData.totalProfit).toBe(15000);
      expect(flightData.transactionCount).toBe(2);
      expect(flightData.averageValue).toBe(50000);
    });
  });

  describe('Customer Behavior Analytics Validation', () => {
    it('should validate customer segmentation accuracy', async () => {
      const customerSegments = [
        { segment: 'VIP', totalRevenue: 200000, totalProfit: 40000, transactionCount: 4, averageTransactionValue: 50000 },
        { segment: 'Premium', totalRevenue: 150000, totalProfit: 22500, transactionCount: 3, averageTransactionValue: 50000 },
        { segment: 'Standard', totalRevenue: 100000, totalProfit: 12000, transactionCount: 5, averageTransactionValue: 20000 }
      ];

      const bookingChannels = [
        { channel: 'Web', totalRevenue: 250000, transactionCount: 8, averageTransactionValue: 31250 },
        { channel: 'Mobile', totalRevenue: 150000, transactionCount: 3, averageTransactionValue: 50000 },
        { channel: 'Agent', totalRevenue: 50000, transactionCount: 1, averageTransactionValue: 50000 }
      ];

      const customerMetrics = {
        totalCustomers: 10,
        newCustomers: 7,
        repeatCustomers: 3,
        repeatCustomerRate: 30,
        averageTransactionsPerCustomer: 1.2,
        averageCustomerValue: 45000
      };

      // Mock customer analytics aggregations
      Ledger.aggregate.mockImplementation((pipeline) => {
        const pipelineStr = JSON.stringify(pipeline);
        if (pipelineStr.includes('customerSegment')) {
          return Promise.resolve(customerSegments);
        } else if (pipelineStr.includes('bookingChannel')) {
          return Promise.resolve(bookingChannels);
        } else if (pipelineStr.includes('repeatCustomers')) {
          return Promise.resolve([customerMetrics]);
        }
        return Promise.resolve([]);
      });

      const response = await request(app)
        .get('/api/v1/analytics/customers')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // Validate customer segments
      expect(response.body.data.customerSegments).toHaveLength(3);
      const vipSegment = response.body.data.customerSegments.find(s => s.segment === 'VIP');
      expect(vipSegment.totalRevenue).toBe(200000);
      expect(vipSegment.averageTransactionValue).toBe(50000);
      
      // Validate booking channels
      expect(response.body.data.bookingChannels).toHaveLength(3);
      const webChannel = response.body.data.bookingChannels.find(c => c.channel === 'Web');
      expect(webChannel.totalRevenue).toBe(250000);
      expect(webChannel.transactionCount).toBe(8);
      
      // Validate customer metrics
      expect(response.body.data.customerMetrics.totalCustomers).toBe(10);
      expect(response.body.data.customerMetrics.repeatCustomerRate).toBe(30);
      expect(response.body.data.customerMetrics.averageCustomerValue).toBe(45000);
    });

    it('should handle customer analytics with no repeat customers', async () => {
      const customerMetrics = {
        totalCustomers: 5,
        newCustomers: 5,
        repeatCustomers: 0,
        repeatCustomerRate: 0,
        averageTransactionsPerCustomer: 1,
        averageCustomerValue: 30000
      };

      Ledger.aggregate.mockImplementation((pipeline) => {
        const pipelineStr = JSON.stringify(pipeline);
        if (pipelineStr.includes('repeatCustomers')) {
          return Promise.resolve([customerMetrics]);
        }
        return Promise.resolve([]);
      });

      const response = await request(app)
        .get('/api/v1/analytics/customers')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.customerMetrics.repeatCustomerRate).toBe(0);
      expect(response.body.data.customerMetrics.newCustomers).toBe(5);
      expect(response.body.data.customerMetrics.repeatCustomers).toBe(0);
    });
  });

  describe('Profit Margin Calculations', () => {
    it('should calculate profit margins correctly for each service type', async () => {
      const serviceTypes = [
        { itemType: 'Flight', totalRevenue: 100000, totalProfit: 15000, transactionCount: 2 },
        { itemType: 'Hotel', totalRevenue: 80000, totalProfit: 12000, transactionCount: 4 },
        { itemType: 'Package', totalRevenue: 60000, totalProfit: 12000, transactionCount: 1 },
        { itemType: 'Insurance', totalRevenue: 20000, totalProfit: 4000, transactionCount: 10 },
        { itemType: 'Visa', totalRevenue: 15000, totalProfit: 3000, transactionCount: 5 }
      ];

      const totalRevenue = serviceTypes.reduce((sum, s) => sum + s.totalRevenue, 0);
      const totalProfit = serviceTypes.reduce((sum, s) => sum + s.totalProfit, 0);
      const totalTransactions = serviceTypes.reduce((sum, s) => sum + s.transactionCount, 0);

      // Mock the aggregation calls - the profit margins endpoint makes multiple calls
      let callCount = 0;
      Ledger.aggregate.mockImplementation(() => {
        callCount++;
        
        // First call: Revenue analytics aggregation
        if (callCount === 1) {
          return Promise.resolve([{
            _id: null,
            totalRevenue,
            totalProfit,
            totalServiceCharges: totalRevenue * 0.05,
            totalTransactions,
            averageTransactionValue: totalRevenue / totalTransactions,
            profitMarginPercentage: (totalProfit / totalRevenue) * 100,
            revenueByItemType: serviceTypes.map(s => ({
              itemType: s.itemType,
              amount: s.totalRevenue,
              profit: s.totalProfit
            }))
          }]);
        }
        
        // Second call: Product performance aggregation
        if (callCount === 2) {
          return Promise.resolve(serviceTypes.map(s => ({
            itemType: s.itemType,
            totalRevenue: s.totalRevenue,
            totalProfit: s.totalProfit,
            transactionCount: s.transactionCount,
            averageTransactionValue: s.totalRevenue / s.transactionCount,
            averageProfit: s.totalProfit / s.transactionCount,
            profitMarginPercentage: (s.totalProfit / s.totalRevenue) * 100
          })));
        }
        
        // Other calls return empty arrays
        return Promise.resolve([]);
      });

      const response = await request(app)
        .get('/api/v1/analytics/profit-margins')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.byServiceType).toHaveLength(5);
      
      // Validate Flight profit margin: 15000/100000 * 100 = 15%
      const flightMargin = response.body.data.byServiceType.find(s => s.serviceType === 'Flight');
      expect(parseFloat(flightMargin.profitMarginPercentage)).toBeCloseTo(15, 1);
      
      // Validate Package profit margin: 12000/60000 * 100 = 20%
      const packageMargin = response.body.data.byServiceType.find(s => s.serviceType === 'Package');
      expect(parseFloat(packageMargin.profitMarginPercentage)).toBeCloseTo(20, 1);
      
      // Validate Insurance profit margin: 4000/20000 * 100 = 20%
      const insuranceMargin = response.body.data.byServiceType.find(s => s.serviceType === 'Insurance');
      expect(parseFloat(insuranceMargin.profitMarginPercentage)).toBeCloseTo(20, 1);
      
      // Check performance ranking
      expect(response.body.data.performanceRanking).toHaveLength(5);
      expect(response.body.data.performanceRanking[0].rank).toBe(1);
    });

    it('should handle zero revenue in profit margin calculations', async () => {
      // Mock both calls that the profit margins endpoint makes
      let callCount = 0;
      Ledger.aggregate.mockImplementation(() => {
        callCount++;
        
        // First call: Revenue analytics aggregation (returns empty result)
        if (callCount === 1) {
          return Promise.resolve([]);
        }
        
        // Second call: Product performance aggregation (returns empty result)
        if (callCount === 2) {
          return Promise.resolve([]);
        }
        
        // Other calls return empty arrays
        return Promise.resolve([]);
      });

      const response = await request(app)
        .get('/api/v1/analytics/profit-margins')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.overall.profitMarginPercentage).toBe(0);
      expect(response.body.data.byServiceType).toHaveLength(0);
    });
  });

  describe('Data Filtering and Caching Tests', () => {
    it('should filter data by date range correctly', async () => {
      const startDate = new Date('2024-01-01').toISOString();
      const endDate = new Date('2024-01-31').toISOString();

      const response = await request(app)
        .get(`/api/v1/analytics/revenue?startDate=${startDate}&endDate=${endDate}`)
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.dateRange.startDate).toBe(startDate);
      expect(response.body.data.dateRange.endDate).toBe(endDate);
      
      // Verify that Ledger.aggregate was called with correct date filter
      expect(Ledger.aggregate).toHaveBeenCalled();
      const aggregateCall = Ledger.aggregate.mock.calls[0][0];
      const matchStage = aggregateCall.find(stage => stage.$match);
      expect(matchStage.$match.createdAt.$gte).toEqual(new Date(startDate));
      expect(matchStage.$match.createdAt.$lte).toEqual(new Date(endDate));
    });

    it('should filter data by item type correctly', async () => {
      const itemType = 'Flight';
      
      const response = await request(app)
        .get(`/api/v1/analytics/revenue?itemType=${itemType}`)
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.filters.itemType).toBe(itemType);
      
      // Verify that Ledger.aggregate was called with correct item type filter
      expect(Ledger.aggregate).toHaveBeenCalled();
      const aggregateCall = Ledger.aggregate.mock.calls[0][0];
      const matchStage = aggregateCall.find(stage => stage.$match);
      expect(matchStage.$match.itemType).toBe(itemType);
    });

    it('should handle period-based filtering', async () => {
      const periods = ['7d', '30d', '90d', '1y'];
      
      for (const period of periods) {
        jest.clearAllMocks();
        
        const response = await request(app)
          .get(`/api/v1/analytics/revenue?period=${period}`)
          .set('x-test-user-role', UserRoles.MANAGER)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.dateRange).toHaveProperty('startDate');
        expect(response.body.data.dateRange).toHaveProperty('endDate');
        
        // Verify date range is calculated correctly
        const startDate = new Date(response.body.data.dateRange.startDate);
        const endDate = new Date(response.body.data.dateRange.endDate);
        const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
        
        switch (period) {
          case '7d':
            expect(daysDiff).toBeCloseTo(7, 1);
            break;
          case '30d':
            expect(daysDiff).toBeCloseTo(30, 1);
            break;
          case '90d':
            expect(daysDiff).toBeCloseTo(90, 1);
            break;
          case '1y':
            expect(daysDiff).toBeCloseTo(365, 5);
            break;
        }
      }
    });

    it('should implement caching correctly', async () => {
      // Test cache miss scenario
      AnalyticsCache.getCache.mockResolvedValueOnce(null);
      AnalyticsCache.setCache.mockResolvedValueOnce(true);

      const response1 = await request(app)
        .get('/api/v1/analytics/revenue')
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response1.body.success).toBe(true);
      expect(AnalyticsCache.getCache).toHaveBeenCalled();
      expect(AnalyticsCache.setCache).toHaveBeenCalled();

      // Test cache hit scenario
      const cachedData = {
        totalRevenue: 100000,
        totalProfit: 15000,
        totalTransactions: 2,
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
      expect(response2.body.data.totalRevenue).toBe(100000);
      expect(response2.body.data.totalProfit).toBe(15000);
    });

    it('should clear cache by category', async () => {
      AnalyticsCache.invalidateCacheByCategory.mockResolvedValueOnce({ deletedCount: 5 });

      const response = await request(app)
        .delete('/api/v1/analytics/cache?category=revenue')
        .set('x-test-user-role', UserRoles.EXECUTIVE)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.deletedCount).toBe(5);
      expect(response.body.data.category).toBe('revenue');
      expect(AnalyticsCache.invalidateCacheByCategory).toHaveBeenCalledWith('revenue');
    });

    it('should clear all cache when no category specified', async () => {
      AnalyticsCache.deleteMany.mockResolvedValueOnce({ deletedCount: 10 });

      const response = await request(app)
        .delete('/api/v1/analytics/cache')
        .set('x-test-user-role', UserRoles.EXECUTIVE)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.deletedCount).toBe(10);
      expect(response.body.data.category).toBe('all');
      expect(AnalyticsCache.deleteMany).toHaveBeenCalledWith({});
    });

    it('should validate complex filter combinations', async () => {
      const startDate = new Date('2024-01-01').toISOString();
      const endDate = new Date('2024-01-31').toISOString();
      const itemType = 'Package';

      const response = await request(app)
        .get(`/api/v1/analytics/revenue?startDate=${startDate}&endDate=${endDate}&itemType=${itemType}`)
        .set('x-test-user-role', UserRoles.MANAGER)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.dateRange.startDate).toBe(startDate);
      expect(response.body.data.dateRange.endDate).toBe(endDate);
      expect(response.body.data.filters.itemType).toBe(itemType);
    });
  });

  describe('Real-time metrics', () => {
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
    });
  });
});