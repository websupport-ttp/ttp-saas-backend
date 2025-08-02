// v1/controllers/analyticsController.js
const { StatusCodes } = require('http-status-codes');
const { ApiError } = require('../utils/apiError');
const asyncHandler = require('../middleware/asyncHandler');
const AnalyticsService = require('../services/analyticsService');
const { z } = require('zod');

/**
 * @description Analytics Controller for business intelligence dashboard
 * Provides endpoints for revenue, customer behavior, and product performance analytics
 * Restricted to Manager+ roles for security
 */

// Validation schemas
const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  itemType: z.enum(['Flight', 'Hotel', 'Insurance', 'Visa', 'Package']).optional(),
});

const dashboardQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  period: z.enum(['7d', '30d', '90d', '1y']).optional(),
});

/**
 * @function getDateRange
 * @description Helper function to parse and validate date ranges
 * @param {Object} query - Query parameters
 * @returns {Object} Parsed start and end dates
 */
const getDateRange = (query) => {
  let startDate, endDate;

  if (query.period) {
    const now = new Date();
    endDate = now;
    
    switch (query.period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
  } else {
    startDate = query.startDate ? new Date(query.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    endDate = query.endDate ? new Date(query.endDate) : new Date();
  }

  // Validate dates
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new ApiError('Invalid date format. Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)', StatusCodes.BAD_REQUEST);
  }

  if (startDate >= endDate) {
    throw new ApiError('Start date must be before end date', StatusCodes.BAD_REQUEST);
  }

  return { startDate, endDate };
};

/**
 * @route GET /api/v1/analytics/revenue
 * @description Get revenue analytics with optional filtering
 * @access Manager+
 */
const getRevenueAnalytics = asyncHandler(async (req, res) => {
  // Validate query parameters
  const validation = dateRangeSchema.safeParse(req.query);
  if (!validation.success) {
    throw new ApiError('Invalid query parameters', StatusCodes.BAD_REQUEST, validation.error.errors);
  }

  const { startDate, endDate } = getDateRange(req.query);
  const { itemType } = req.query;

  const revenueData = await AnalyticsService.getRevenueAnalytics(startDate, endDate, itemType);

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Revenue analytics retrieved successfully',
    data: {
      ...revenueData,
      dateRange: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      filters: {
        itemType: itemType || 'all',
      },
    },
  });
});

/**
 * @route GET /api/v1/analytics/revenue/trend
 * @description Get daily revenue trend for specified date range
 * @access Manager+
 */
const getRevenueTrend = asyncHandler(async (req, res) => {
  const validation = dateRangeSchema.safeParse(req.query);
  if (!validation.success) {
    throw new ApiError('Invalid query parameters', StatusCodes.BAD_REQUEST, validation.error.errors);
  }

  const { startDate, endDate } = getDateRange(req.query);

  const trendData = await AnalyticsService.getDailyRevenueTrend(startDate, endDate);

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Revenue trend data retrieved successfully',
    data: {
      trend: trendData,
      dateRange: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      totalDataPoints: trendData.length,
    },
  });
});

/**
 * @route GET /api/v1/analytics/customers
 * @description Get customer behavior analytics
 * @access Manager+
 */
const getCustomerAnalytics = asyncHandler(async (req, res) => {
  const validation = dateRangeSchema.safeParse(req.query);
  if (!validation.success) {
    throw new ApiError('Invalid query parameters', StatusCodes.BAD_REQUEST, validation.error.errors);
  }

  const { startDate, endDate } = getDateRange(req.query);

  const customerData = await AnalyticsService.getCustomerBehaviorAnalytics(startDate, endDate);

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Customer analytics retrieved successfully',
    data: {
      ...customerData,
      dateRange: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    },
  });
});

/**
 * @route GET /api/v1/analytics/products
 * @description Get product performance analytics with profit margins
 * @access Manager+
 */
const getProductAnalytics = asyncHandler(async (req, res) => {
  const validation = dateRangeSchema.safeParse(req.query);
  if (!validation.success) {
    throw new ApiError('Invalid query parameters', StatusCodes.BAD_REQUEST, validation.error.errors);
  }

  const { startDate, endDate } = getDateRange(req.query);

  const productData = await AnalyticsService.getProductPerformanceAnalytics(startDate, endDate);

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Product analytics retrieved successfully',
    data: {
      ...productData,
      dateRange: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    },
  });
});

/**
 * @route GET /api/v1/analytics/profit-margins
 * @description Get detailed profit margin analysis by service type
 * @access Manager+
 */
const getProfitMarginAnalytics = asyncHandler(async (req, res) => {
  const validation = dateRangeSchema.safeParse(req.query);
  if (!validation.success) {
    throw new ApiError('Invalid query parameters', StatusCodes.BAD_REQUEST, validation.error.errors);
  }

  const { startDate, endDate } = getDateRange(req.query);
  const { itemType } = req.query;

  // Get revenue data which includes profit margin calculations
  const revenueData = await AnalyticsService.getRevenueAnalytics(startDate, endDate, itemType);
  const productData = await AnalyticsService.getProductPerformanceAnalytics(startDate, endDate);

  // Calculate additional profit margin insights
  const profitMarginInsights = {
    overall: {
      totalRevenue: revenueData.totalRevenue,
      totalProfit: revenueData.totalProfit,
      profitMarginPercentage: revenueData.profitMarginPercentage,
      totalServiceCharges: revenueData.totalServiceCharges,
    },
    byServiceType: revenueData.revenueByItemType.map(item => ({
      serviceType: item.itemType,
      totalRevenue: item.totalRevenue,
      totalProfit: item.totalProfit,
      profitMarginPercentage: item.totalRevenue > 0 ? 
        ((item.totalProfit / item.totalRevenue) * 100).toFixed(2) : 0,
      transactionCount: item.transactionCount,
      averageProfit: item.transactionCount > 0 ? 
        (item.totalProfit / item.transactionCount).toFixed(2) : 0,
      averageRevenue: item.averageValue,
    })),
    performanceRanking: productData.itemPerformance
      .sort((a, b) => b.profitMarginPercentage - a.profitMarginPercentage)
      .map((item, index) => ({
        rank: index + 1,
        serviceType: item.itemType,
        profitMarginPercentage: item.profitMarginPercentage,
        totalProfit: item.totalProfit,
        totalRevenue: item.totalRevenue,
      })),
  };

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Profit margin analytics retrieved successfully',
    data: {
      ...profitMarginInsights,
      dateRange: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      filters: {
        itemType: itemType || 'all',
      },
    },
  });
});

/**
 * @route GET /api/v1/analytics/dashboard
 * @description Get comprehensive dashboard analytics
 * @access Manager+
 */
const getDashboardAnalytics = asyncHandler(async (req, res) => {
  const validation = dashboardQuerySchema.safeParse(req.query);
  if (!validation.success) {
    throw new ApiError('Invalid query parameters', StatusCodes.BAD_REQUEST, validation.error.errors);
  }

  const { startDate, endDate } = getDateRange(req.query);

  const dashboardData = await AnalyticsService.getDashboardAnalytics(startDate, endDate);

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Dashboard analytics retrieved successfully',
    data: {
      ...dashboardData,
      dateRange: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    },
  });
});

/**
 * @route GET /api/v1/analytics/realtime
 * @description Get real-time metrics (not cached)
 * @access Manager+
 */
const getRealTimeMetrics = asyncHandler(async (req, res) => {
  const realTimeData = await AnalyticsService.getRealTimeMetrics();

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Real-time metrics retrieved successfully',
    data: realTimeData,
  });
});

/**
 * @route GET /api/v1/analytics/summary
 * @description Get analytics summary with key performance indicators
 * @access Manager+
 */
const getAnalyticsSummary = asyncHandler(async (req, res) => {
  const { startDate, endDate } = getDateRange(req.query);

  // Get data for current period and previous period for comparison
  const currentPeriodDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
  const previousStartDate = new Date(startDate.getTime() - currentPeriodDays * 24 * 60 * 60 * 1000);
  const previousEndDate = new Date(startDate.getTime() - 1);

  const [currentData, previousData, realTimeData] = await Promise.all([
    AnalyticsService.getRevenueAnalytics(startDate, endDate),
    AnalyticsService.getRevenueAnalytics(previousStartDate, previousEndDate),
    AnalyticsService.getRealTimeMetrics(),
  ]);

  // Calculate percentage changes
  const calculateChange = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous * 100).toFixed(2);
  };

  const summary = {
    currentPeriod: {
      totalRevenue: currentData.totalRevenue,
      totalProfit: currentData.totalProfit,
      totalTransactions: currentData.totalTransactions,
      averageTransactionValue: currentData.averageTransactionValue,
      profitMarginPercentage: currentData.profitMarginPercentage,
    },
    previousPeriod: {
      totalRevenue: previousData.totalRevenue,
      totalProfit: previousData.totalProfit,
      totalTransactions: previousData.totalTransactions,
      averageTransactionValue: previousData.averageTransactionValue,
      profitMarginPercentage: previousData.profitMarginPercentage,
    },
    changes: {
      revenueChange: calculateChange(currentData.totalRevenue, previousData.totalRevenue),
      profitChange: calculateChange(currentData.totalProfit, previousData.totalProfit),
      transactionChange: calculateChange(currentData.totalTransactions, previousData.totalTransactions),
      avgTransactionChange: calculateChange(currentData.averageTransactionValue, previousData.averageTransactionValue),
    },
    realTime: realTimeData,
    dateRanges: {
      current: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      previous: {
        startDate: previousStartDate.toISOString(),
        endDate: previousEndDate.toISOString(),
      },
    },
  };

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Analytics summary retrieved successfully',
    data: summary,
  });
});

/**
 * @route GET /api/v1/analytics/affiliates/performance
 * @description Get affiliate performance analytics
 * @access Manager+
 */
const getAffiliatePerformanceAnalytics = asyncHandler(async (req, res) => {
  const validation = dateRangeSchema.safeParse(req.query);
  if (!validation.success) {
    throw new ApiError('Invalid query parameters', StatusCodes.BAD_REQUEST, validation.error.errors);
  }

  const { startDate, endDate } = getDateRange(req.query);
  const { affiliateId } = req.query;

  const performanceData = await AnalyticsService.getAffiliatePerformanceAnalytics(startDate, endDate, affiliateId);

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Affiliate performance analytics retrieved successfully',
    data: {
      ...performanceData,
      dateRange: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      filters: {
        affiliateId: affiliateId || 'all',
      },
    },
  });
});

/**
 * @route GET /api/v1/analytics/affiliates/revenue
 * @description Get affiliate revenue analytics
 * @access Manager+
 */
const getAffiliateRevenueAnalytics = asyncHandler(async (req, res) => {
  const validation = dateRangeSchema.safeParse(req.query);
  if (!validation.success) {
    throw new ApiError('Invalid query parameters', StatusCodes.BAD_REQUEST, validation.error.errors);
  }

  const { startDate, endDate } = getDateRange(req.query);

  const revenueData = await AnalyticsService.getAffiliateRevenueAnalytics(startDate, endDate);

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Affiliate revenue analytics retrieved successfully',
    data: {
      ...revenueData,
      dateRange: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    },
  });
});

/**
 * @route GET /api/v1/analytics/affiliates/conversions
 * @description Get affiliate conversion rate and referral performance metrics
 * @access Manager+
 */
const getAffiliateConversionAnalytics = asyncHandler(async (req, res) => {
  const validation = dateRangeSchema.safeParse(req.query);
  if (!validation.success) {
    throw new ApiError('Invalid query parameters', StatusCodes.BAD_REQUEST, validation.error.errors);
  }

  const { startDate, endDate } = getDateRange(req.query);

  const conversionData = await AnalyticsService.getAffiliateConversionMetrics(startDate, endDate);

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Affiliate conversion analytics retrieved successfully',
    data: {
      ...conversionData,
      dateRange: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    },
  });
});

/**
 * @route GET /api/v1/analytics/affiliates/dashboard
 * @description Get comprehensive affiliate dashboard analytics
 * @access Manager+
 */
const getAffiliateDashboardAnalytics = asyncHandler(async (req, res) => {
  const validation = dashboardQuerySchema.safeParse(req.query);
  if (!validation.success) {
    throw new ApiError('Invalid query parameters', StatusCodes.BAD_REQUEST, validation.error.errors);
  }

  const { startDate, endDate } = getDateRange(req.query);

  const dashboardData = await AnalyticsService.getAffiliateDashboardAnalytics(startDate, endDate);

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Affiliate dashboard analytics retrieved successfully',
    data: {
      ...dashboardData,
      dateRange: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    },
  });
});

/**
 * @route DELETE /api/v1/analytics/cache
 * @description Clear analytics cache
 * @access Executive+
 */
const clearAnalyticsCache = asyncHandler(async (req, res) => {
  const { category } = req.query;

  const result = await AnalyticsService.clearCache(category);

  res.status(StatusCodes.OK).json({
    success: true,
    message: `Analytics cache ${category ? `for category '${category}'` : ''} cleared successfully`,
    data: {
      deletedCount: result.deletedCount || 0,
      category: category || 'all',
    },
  });
});

module.exports = {
  getRevenueAnalytics,
  getRevenueTrend,
  getCustomerAnalytics,
  getProductAnalytics,
  getProfitMarginAnalytics,
  getDashboardAnalytics,
  getRealTimeMetrics,
  getAnalyticsSummary,
  getAffiliatePerformanceAnalytics,
  getAffiliateRevenueAnalytics,
  getAffiliateConversionAnalytics,
  getAffiliateDashboardAnalytics,
  clearAnalyticsCache,
};