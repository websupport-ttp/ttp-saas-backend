// v1/routes/affiliateNotificationRoutes.js
const express = require('express');
const AffiliateNotificationController = require('../controllers/affiliateNotificationController');
const { authenticateUser, authorizeRoles } = require('../middleware/authMiddleware');
const validate = require('../middleware/validationMiddleware');
const { mongoIdParamSchema } = require('../utils/validationSchemas');
const { 
  affiliateNotificationLimiter, 
  monthlyStatementLimiter,
  affiliateAdminLimiter 
} = require('../middleware/rateLimitMiddleware');

const router = express.Router();

/**
 * @route GET /api/v1/affiliate-notifications/:affiliateId/preferences
 * @description Get notification preferences for an affiliate
 * @access Private (Affiliate or Admin)
 */
router.get(
  '/:affiliateId/preferences',
  affiliateNotificationLimiter,
  authenticateUser,
  validate(mongoIdParamSchema),
  AffiliateNotificationController.getNotificationPreferences
);

/**
 * @route PUT /api/v1/affiliate-notifications/:affiliateId/preferences
 * @description Update notification preferences for an affiliate
 * @access Private (Affiliate or Admin)
 */
router.put(
  '/:affiliateId/preferences',
  affiliateNotificationLimiter,
  authenticateUser,
  validate(mongoIdParamSchema),
  AffiliateNotificationController.updateNotificationPreferences
);

/**
 * @route GET /api/v1/affiliate-notifications/:affiliateId/statements
 * @description Get monthly statement for an affiliate
 * @access Private (Affiliate or Admin)
 */
router.get(
  '/:affiliateId/statements',
  monthlyStatementLimiter,
  authenticateUser,
  validate(mongoIdParamSchema),
  AffiliateNotificationController.getMonthlyStatement
);

/**
 * @route GET /api/v1/affiliate-notifications/:affiliateId/statements/available
 * @description Get available statement months for an affiliate
 * @access Private (Affiliate or Admin)
 */
router.get(
  '/:affiliateId/statements/available',
  affiliateNotificationLimiter,
  authenticateUser,
  validate(mongoIdParamSchema),
  AffiliateNotificationController.getAvailableStatementMonths
);

/**
 * @route POST /api/v1/affiliate-notifications/:affiliateId/statements/send
 * @description Send monthly statement manually (admin only)
 * @access Private (Admin only)
 */
router.post(
  '/:affiliateId/statements/send',
  affiliateAdminLimiter,
  authenticateUser,
  authorizeRoles(['Admin']),
  validate(mongoIdParamSchema),
  AffiliateNotificationController.sendMonthlyStatement
);

/**
 * @route POST /api/v1/affiliate-notifications/statements/send-all
 * @description Send monthly statements to all affiliates (admin only)
 * @access Private (Admin only)
 */
router.post(
  '/statements/send-all',
  affiliateAdminLimiter,
  authenticateUser,
  authorizeRoles(['Admin']),
  AffiliateNotificationController.sendAllMonthlyStatements
);

module.exports = router;