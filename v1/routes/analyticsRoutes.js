// v1/routes/analyticsRoutes.js
const express = require('express');
const {
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
} = require('../controllers/analyticsController');
const { authenticateUser, authorizeRoles } = require('../middleware/authMiddleware');
const { 
  cacheMiddleware, 
  rateLimitByRole, 
  invalidateCache,
  getCacheStats 
} = require('../middleware/cacheMiddleware');
const { UserRoles } = require('../utils/constants');

const router = express.Router();

/**
 * @description Analytics routes for business intelligence dashboard
 * All routes require authentication and Manager+ role access
 * Cache clearing requires Executive+ role access
 */

// Apply authentication and rate limiting middleware to all analytics routes
router.use(authenticateUser);
router.use(rateLimitByRole({
  Manager: 60,    // 60 requests per minute for Managers
  Executive: 120, // 120 requests per minute for Executives  
  Admin: 300      // 300 requests per minute for Admins
}));

/**
 * @openapi
 * /analytics/summary:
 *   get:
 *     summary: Get analytics summary with KPIs and period comparisons
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/DateRangeStartParam'
 *       - $ref: '#/components/parameters/DateRangeEndParam'
 *       - in: query
 *         name: itemType
 *         schema:
 *           type: string
 *           enum: [Flight, Hotel, Insurance, Visa, Package]
 *         description: Filter by specific service type
 *       - in: query
 *         name: customerSegment
 *         schema:
 *           type: string
 *           enum: [Individual, Business, Group, Corporate]
 *         description: Filter by customer segment
 *     responses:
 *       200:
 *         description: Analytics summary retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Analytics summary retrieved successfully"
 *                 data:
 *                   $ref: '#/components/schemas/AnalyticsSummary'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/summary', 
  authorizeRoles(UserRoles.MANAGER, UserRoles.EXECUTIVE, UserRoles.ADMIN),
  cacheMiddleware(1800, 'analytics_summary'), // Cache for 30 minutes
  getAnalyticsSummary
);

/**
 * @openapi
 * /analytics/dashboard:
 *   get:
 *     summary: Get comprehensive dashboard analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/DateRangeStartParam'
 *       - $ref: '#/components/parameters/DateRangeEndParam'
 *     responses:
 *       200:
 *         description: Dashboard analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Dashboard analytics retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     summary:
 *                       $ref: '#/components/schemas/AnalyticsSummary'
 *                     revenue:
 *                       $ref: '#/components/schemas/RevenueAnalytics'
 *                     customers:
 *                       $ref: '#/components/schemas/CustomerAnalytics'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/dashboard', 
  authorizeRoles(UserRoles.MANAGER, UserRoles.EXECUTIVE, UserRoles.ADMIN),
  cacheMiddleware(1800, 'analytics_dashboard'), // Cache for 30 minutes
  getDashboardAnalytics
);

/**
 * @openapi
 * /analytics/revenue:
 *   get:
 *     summary: Get revenue analytics with optional filtering
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/DateRangeStartParam'
 *       - $ref: '#/components/parameters/DateRangeEndParam'
 *       - in: query
 *         name: itemType
 *         schema:
 *           type: string
 *           enum: [Flight, Hotel, Insurance, Visa, Package]
 *         description: Filter by specific service type
 *       - in: query
 *         name: groupBy
 *         schema:
 *           type: string
 *           enum: [day, week, month, quarter, year]
 *           default: month
 *         description: Group revenue data by time period
 *     responses:
 *       200:
 *         description: Revenue analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Revenue analytics retrieved successfully"
 *                 data:
 *                   $ref: '#/components/schemas/RevenueAnalytics'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/revenue', 
  authorizeRoles(UserRoles.MANAGER, UserRoles.EXECUTIVE, UserRoles.ADMIN),
  cacheMiddleware(3600, 'analytics_revenue'), // Cache for 1 hour
  getRevenueAnalytics
);

/**
 * @openapi
 * /analytics/revenue/trend:
 *   get:
 *     summary: Get daily revenue trend for specified date range
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/DateRangeStartParam'
 *       - $ref: '#/components/parameters/DateRangeEndParam'
 *       - in: query
 *         name: itemType
 *         schema:
 *           type: string
 *           enum: [Flight, Hotel, Insurance, Visa, Package]
 *         description: Filter by specific service type
 *     responses:
 *       200:
 *         description: Revenue trend retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Revenue trend retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     trend:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                             format: date
 *                             example: "2024-01-15"
 *                           revenue:
 *                             type: number
 *                             example: 125000
 *                           transactions:
 *                             type: integer
 *                             example: 8
 *                     totalRevenue:
 *                       type: number
 *                       example: 2500000
 *                     averageDailyRevenue:
 *                       type: number
 *                       example: 83333
 *                     dateRange:
 *                       type: object
 *                       properties:
 *                         startDate:
 *                           type: string
 *                           format: date
 *                         endDate:
 *                           type: string
 *                           format: date
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/revenue/trend', 
  authorizeRoles(UserRoles.MANAGER, UserRoles.EXECUTIVE, UserRoles.ADMIN),
  cacheMiddleware(3600, 'analytics_revenue_trend'), // Cache for 1 hour
  getRevenueTrend
);

/**
 * @openapi
 * /analytics/customers:
 *   get:
 *     summary: Get customer behavior analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/DateRangeStartParam'
 *       - $ref: '#/components/parameters/DateRangeEndParam'
 *       - in: query
 *         name: segment
 *         schema:
 *           type: string
 *           enum: [Individual, Business, Group, Corporate]
 *         description: Filter by customer segment
 *     responses:
 *       200:
 *         description: Customer analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Customer analytics retrieved successfully"
 *                 data:
 *                   $ref: '#/components/schemas/CustomerAnalytics'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/customers', 
  authorizeRoles(UserRoles.MANAGER, UserRoles.EXECUTIVE, UserRoles.ADMIN),
  cacheMiddleware(3600, 'analytics_customers'), // Cache for 1 hour
  getCustomerAnalytics
);

/**
 * @openapi
 * /analytics/products:
 *   get:
 *     summary: Get product performance analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/DateRangeStartParam'
 *       - $ref: '#/components/parameters/DateRangeEndParam'
 *       - in: query
 *         name: itemType
 *         schema:
 *           type: string
 *           enum: [Flight, Hotel, Insurance, Visa, Package]
 *         description: Filter by specific service type
 *     responses:
 *       200:
 *         description: Product analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Product analytics retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     productPerformance:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           itemType:
 *                             type: string
 *                             example: "Flight"
 *                           revenue:
 *                             type: number
 *                             example: 8500000
 *                           transactions:
 *                             type: integer
 *                             example: 450
 *                           averageValue:
 *                             type: number
 *                             example: 18889
 *                           profitMargin:
 *                             type: number
 *                             example: 1700000
 *                           profitPercentage:
 *                             type: number
 *                             example: 20.0
 *                     topPackages:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           packageId:
 *                             type: string
 *                             example: "60d5ec49f8c6a7001c8a1b2d"
 *                           title:
 *                             type: string
 *                             example: "Kenya Safari Package"
 *                           revenue:
 *                             type: number
 *                             example: 750000
 *                           bookings:
 *                             type: integer
 *                             example: 3
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/products', 
  authorizeRoles(UserRoles.MANAGER, UserRoles.EXECUTIVE, UserRoles.ADMIN),
  cacheMiddleware(3600, 'analytics_products'), // Cache for 1 hour
  getProductAnalytics
);

/**
 * @openapi
 * /analytics/profit-margins:
 *   get:
 *     summary: Get detailed profit margin analysis by service type
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/DateRangeStartParam'
 *       - $ref: '#/components/parameters/DateRangeEndParam'
 *       - in: query
 *         name: itemType
 *         schema:
 *           type: string
 *           enum: [Flight, Hotel, Insurance, Visa, Package]
 *         description: Filter by specific service type
 *     responses:
 *       200:
 *         description: Profit margin analysis retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Profit margin analysis retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     overallProfitMargin:
 *                       type: object
 *                       properties:
 *                         totalRevenue:
 *                           type: number
 *                           example: 15750000
 *                         totalProfit:
 *                           type: number
 *                           example: 3150000
 *                         profitPercentage:
 *                           type: number
 *                           example: 20.0
 *                     profitByService:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           itemType:
 *                             type: string
 *                             example: "Flight"
 *                           revenue:
 *                             type: number
 *                             example: 8500000
 *                           profit:
 *                             type: number
 *                             example: 1700000
 *                           profitPercentage:
 *                             type: number
 *                             example: 20.0
 *                           transactions:
 *                             type: integer
 *                             example: 450
 *                     profitTrend:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           period:
 *                             type: string
 *                             example: "2024-01"
 *                           profit:
 *                             type: number
 *                             example: 250000
 *                           profitPercentage:
 *                             type: number
 *                             example: 18.5
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/profit-margins', 
  authorizeRoles(UserRoles.MANAGER, UserRoles.EXECUTIVE, UserRoles.ADMIN),
  cacheMiddleware(3600, 'analytics_profit_margins'), // Cache for 1 hour
  getProfitMarginAnalytics
);

/**
 * @openapi
 * /analytics/realtime:
 *   get:
 *     summary: Get real-time metrics (not cached)
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Real-time metrics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Real-time metrics retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     currentHour:
 *                       type: object
 *                       properties:
 *                         revenue:
 *                           type: number
 *                           example: 45000
 *                         transactions:
 *                           type: integer
 *                           example: 3
 *                     today:
 *                       type: object
 *                       properties:
 *                         revenue:
 *                           type: number
 *                           example: 125000
 *                         transactions:
 *                           type: integer
 *                           example: 8
 *                         profit:
 *                           type: number
 *                           example: 25000
 *                     activeUsers:
 *                       type: integer
 *                       description: Number of active users in the last hour
 *                       example: 15
 *                     pendingTransactions:
 *                       type: integer
 *                       description: Number of pending transactions
 *                       example: 2
 *                     lastUpdated:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-15T14:30:00Z"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/realtime', 
  authorizeRoles(UserRoles.MANAGER, UserRoles.EXECUTIVE, UserRoles.ADMIN),
  getRealTimeMetrics
);

/**
 * @openapi
 * /analytics/realtime/transactions:
 *   get:
 *     summary: Get real-time transaction stream (last 24 hours)
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Maximum number of transactions to return
 *     responses:
 *       200:
 *         description: Real-time transactions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Real-time transactions retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     transactions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: "60d5ec49f8c6a7001c8a1b30"
 *                           itemType:
 *                             type: string
 *                             example: "Flight"
 *                           totalAmountPaid:
 *                             type: number
 *                             example: 505000
 *                           profitMargin:
 *                             type: number
 *                             example: 25000
 *                           transactionReference:
 *                             type: string
 *                             example: "TTP-FL-1678888888888"
 *                           customerSegment:
 *                             type: string
 *                             example: "Individual"
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                     count:
 *                       type: integer
 *                       example: 15
 *                     timeRange:
 *                       type: string
 *                       example: "24 hours"
 *                     lastUpdated:
 *                       type: string
 *                       format: date-time
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/realtime/transactions', 
  authorizeRoles(UserRoles.MANAGER, UserRoles.EXECUTIVE, UserRoles.ADMIN),
  async (req, res) => {
    try {
      const { limit = 50 } = req.query;
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const recentTransactions = await require('../models/ledgerModel')
        .find({ 
          createdAt: { $gte: last24Hours },
          status: 'Completed'
        })
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .select('itemType totalAmountPaid profitMargin createdAt transactionReference customerSegment')
        .lean();

      res.status(200).json({
        success: true,
        message: 'Real-time transactions retrieved successfully',
        data: {
          transactions: recentTransactions,
          count: recentTransactions.length,
          timeRange: '24 hours',
          lastUpdated: new Date().toISOString()
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve real-time transactions',
        error: error.message
      });
    }
  }
);

/**
 * @openapi
 * /analytics/realtime/kpis:
 *   get:
 *     summary: Get real-time key performance indicators
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Real-time KPIs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Real-time KPIs retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     today:
 *                       type: object
 *                       properties:
 *                         revenue:
 *                           type: number
 *                           example: 125000
 *                         transactions:
 *                           type: integer
 *                           example: 8
 *                         profit:
 *                           type: number
 *                           example: 25000
 *                     thisWeek:
 *                       type: object
 *                       properties:
 *                         revenue:
 *                           type: number
 *                           example: 875000
 *                         transactions:
 *                           type: integer
 *                           example: 56
 *                         profit:
 *                           type: number
 *                           example: 175000
 *                     lastUpdated:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-15T14:30:00Z"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/realtime/kpis', 
  authorizeRoles(UserRoles.MANAGER, UserRoles.EXECUTIVE, UserRoles.ADMIN),
  async (req, res) => {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const startOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
      
      // Get today's metrics
      const todayMetrics = await require('../models/ledgerModel').aggregate([
        {
          $match: {
            createdAt: { $gte: startOfDay },
            status: 'Completed'
          }
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: '$totalAmountPaid' },
            transactions: { $sum: 1 },
            profit: { $sum: '$profitMargin' }
          }
        }
      ]);

      // Get this week's metrics
      const weekMetrics = await require('../models/ledgerModel').aggregate([
        {
          $match: {
            createdAt: { $gte: startOfWeek },
            status: 'Completed'
          }
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: '$totalAmountPaid' },
            transactions: { $sum: 1 },
            profit: { $sum: '$profitMargin' }
          }
        }
      ]);

      res.status(200).json({
        success: true,
        message: 'Real-time KPIs retrieved successfully',
        data: {
          today: todayMetrics[0] || { revenue: 0, transactions: 0, profit: 0 },
          thisWeek: weekMetrics[0] || { revenue: 0, transactions: 0, profit: 0 },
          lastUpdated: new Date().toISOString()
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve real-time KPIs',
        error: error.message
      });
    }
  }
);

/**
 * @openapi
 * /analytics/affiliates/performance:
 *   get:
 *     summary: Get affiliate performance analytics
 *     tags: [Analytics, Affiliates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/DateRangeStartParam'
 *       - $ref: '#/components/parameters/DateRangeEndParam'
 *       - in: query
 *         name: affiliateId
 *         schema:
 *           type: string
 *         description: Filter by specific affiliate ID
 *     responses:
 *       200:
 *         description: Affiliate performance analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Affiliate performance analytics retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     topAffiliates:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           affiliateName:
 *                             type: string
 *                             example: "Travel Partners Ltd"
 *                           totalReferrals:
 *                             type: integer
 *                             example: 45
 *                           totalCommissionsEarned:
 *                             type: number
 *                             example: 125000
 *                           conversionRate:
 *                             type: number
 *                             example: 68.9
 *                     commissionStats:
 *                       type: object
 *                       properties:
 *                         totalCommissions:
 *                           type: number
 *                           example: 500000
 *                         totalApprovedCommissions:
 *                           type: number
 *                           example: 450000
 *                         averageCommissionAmount:
 *                           type: number
 *                           example: 2500
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/affiliates/performance', 
  authorizeRoles(UserRoles.MANAGER, UserRoles.EXECUTIVE, UserRoles.ADMIN),
  cacheMiddleware(3600, 'analytics_affiliate_performance'), // Cache for 1 hour
  getAffiliatePerformanceAnalytics
);

/**
 * @openapi
 * /analytics/affiliates/revenue:
 *   get:
 *     summary: Get affiliate revenue analytics
 *     tags: [Analytics, Affiliates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/DateRangeStartParam'
 *       - $ref: '#/components/parameters/DateRangeEndParam'
 *     responses:
 *       200:
 *         description: Affiliate revenue analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Affiliate revenue analytics retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     affiliateRevenue:
 *                       type: object
 *                       properties:
 *                         totalAffiliateRevenue:
 *                           type: number
 *                           example: 2500000
 *                         totalAffiliateBookings:
 *                           type: integer
 *                           example: 150
 *                         averageAffiliateBookingValue:
 *                           type: number
 *                           example: 16667
 *                     affiliateContribution:
 *                       type: object
 *                       properties:
 *                         revenuePercentage:
 *                           type: string
 *                           example: "15.5"
 *                         bookingPercentage:
 *                           type: string
 *                           example: "12.3"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/affiliates/revenue', 
  authorizeRoles(UserRoles.MANAGER, UserRoles.EXECUTIVE, UserRoles.ADMIN),
  cacheMiddleware(3600, 'analytics_affiliate_revenue'), // Cache for 1 hour
  getAffiliateRevenueAnalytics
);

/**
 * @openapi
 * /analytics/affiliates/conversions:
 *   get:
 *     summary: Get affiliate conversion rate and referral performance metrics
 *     tags: [Analytics, Affiliates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/DateRangeStartParam'
 *       - $ref: '#/components/parameters/DateRangeEndParam'
 *     responses:
 *       200:
 *         description: Affiliate conversion analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Affiliate conversion analytics retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     overallMetrics:
 *                       type: object
 *                       properties:
 *                         totalReferrals:
 *                           type: integer
 *                           example: 250
 *                         overallConversionRate:
 *                           type: number
 *                           example: 64.5
 *                         activeAffiliateCount:
 *                           type: integer
 *                           example: 15
 *                     affiliateConversions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           affiliateName:
 *                             type: string
 *                             example: "Travel Partners Ltd"
 *                           conversionRate:
 *                             type: number
 *                             example: 72.5
 *                           totalReferrals:
 *                             type: integer
 *                             example: 40
 *                     referralSources:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           source:
 *                             type: string
 *                             example: "qr_code"
 *                           conversionRate:
 *                             type: number
 *                             example: 85.2
 *                           referralCount:
 *                             type: integer
 *                             example: 120
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/affiliates/conversions', 
  authorizeRoles(UserRoles.MANAGER, UserRoles.EXECUTIVE, UserRoles.ADMIN),
  cacheMiddleware(3600, 'analytics_affiliate_conversions'), // Cache for 1 hour
  getAffiliateConversionAnalytics
);

/**
 * @openapi
 * /analytics/affiliates/dashboard:
 *   get:
 *     summary: Get comprehensive affiliate dashboard analytics
 *     tags: [Analytics, Affiliates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/DateRangeStartParam'
 *       - $ref: '#/components/parameters/DateRangeEndParam'
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *         description: Predefined time period
 *     responses:
 *       200:
 *         description: Affiliate dashboard analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Affiliate dashboard analytics retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     overview:
 *                       type: object
 *                       properties:
 *                         totalAffiliates:
 *                           type: integer
 *                           example: 15
 *                         totalReferrals:
 *                           type: integer
 *                           example: 250
 *                         totalCommissions:
 *                           type: number
 *                           example: 450000
 *                         overallConversionRate:
 *                           type: number
 *                           example: 64.5
 *                     performance:
 *                       $ref: '#/components/schemas/AffiliatePerformanceData'
 *                     revenue:
 *                       $ref: '#/components/schemas/AffiliateRevenueData'
 *                     conversions:
 *                       $ref: '#/components/schemas/AffiliateConversionData'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/affiliates/dashboard', 
  authorizeRoles(UserRoles.MANAGER, UserRoles.EXECUTIVE, UserRoles.ADMIN),
  cacheMiddleware(1800, 'analytics_affiliate_dashboard'), // Cache for 30 minutes
  getAffiliateDashboardAnalytics
);

router.delete('/cache', 
  authorizeRoles(UserRoles.EXECUTIVE, UserRoles.ADMIN),
  invalidateCache(['analytics:*']), // Clear Redis cache
  clearAnalyticsCache // Clear MongoDB cache
);

/**
 * @openapi
 * /analytics/cache:
 *   delete:
 *     summary: Clear analytics cache (Executive+ only)
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [revenue, customers, products, dashboard, summary, all]
 *         description: Specific cache category to clear (optional)
 *     responses:
 *       200:
 *         description: Cache cleared successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Analytics cache cleared successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     deletedCount:
 *                       type: integer
 *                       example: 5
 *                     category:
 *                       type: string
 *                       example: "revenue"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.delete('/cache', 
  authorizeRoles(UserRoles.EXECUTIVE, UserRoles.ADMIN),
  invalidateCache(['analytics:*']), // Clear Redis cache
  clearAnalyticsCache // Clear MongoDB cache
);

/**
 * @route GET /api/v1/analytics/cache/stats
 * @description Get cache statistics and performance metrics
 * @access Executive+
 */
router.get('/cache/stats', 
  authorizeRoles(UserRoles.EXECUTIVE, UserRoles.ADMIN),
  async (req, res) => {
    try {
      const cacheStats = await getCacheStats();
      res.status(200).json({
        success: true,
        message: 'Cache statistics retrieved successfully',
        data: cacheStats
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve cache statistics',
        error: error.message
      });
    }
  }
);

module.exports = router;