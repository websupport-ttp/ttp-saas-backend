const express = require('express');
const router = express.Router();
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
const { cacheMiddleware } = require('../middleware/cacheMiddleware');
const { UserRoles } = require('../utils/constants');

const managerPlus = authorizeRoles(UserRoles.ADMIN, UserRoles.MANAGER);

router.use(authenticateUser, managerPlus);

router.get('/revenue', cacheMiddleware(900, 'analytics'), getRevenueAnalytics);
router.get('/revenue/trend', cacheMiddleware(900, 'analytics'), getRevenueTrend);
router.get('/customers', cacheMiddleware(900, 'analytics'), getCustomerAnalytics);
router.get('/products', cacheMiddleware(900, 'analytics'), getProductAnalytics);
router.get('/profit-margins', cacheMiddleware(900, 'analytics'), getProfitMarginAnalytics);
router.get('/dashboard', cacheMiddleware(1800, 'analytics'), getDashboardAnalytics);
router.get('/realtime', getRealTimeMetrics); // no cache - real-time
router.get('/summary', cacheMiddleware(900, 'analytics'), getAnalyticsSummary);

router.get('/affiliates/performance', cacheMiddleware(900, 'analytics'), getAffiliatePerformanceAnalytics);
router.get('/affiliates/revenue', cacheMiddleware(900, 'analytics'), getAffiliateRevenueAnalytics);
router.get('/affiliates/conversions', cacheMiddleware(900, 'analytics'), getAffiliateConversionAnalytics);
router.get('/affiliates/dashboard', cacheMiddleware(1800, 'analytics'), getAffiliateDashboardAnalytics);

router.delete('/cache', authorizeRoles(UserRoles.ADMIN), clearAnalyticsCache);

module.exports = router;
