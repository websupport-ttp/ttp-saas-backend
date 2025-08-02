// v1/routes/healthDashboardRoutes.js
const express = require('express');
const {
  getHealthDashboard,
  getAlertHistory,
  updateAlertThresholds,
  clearAlertHistory
} = require('../controllers/healthDashboardController');
const { authenticateUser, authorizeRoles } = require('../middleware/authMiddleware');
const rateLimit = require('express-rate-limit');
const { UserRoles } = require('../utils/constants');

const router = express.Router();

// Rate limiting for dashboard endpoints
const dashboardRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: {
    status: 'error',
    message: 'Too many dashboard requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const adminRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 requests per 5 minutes
  message: {
    status: 'error',
    message: 'Too many admin requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * @swagger
 * components:
 *   schemas:
 *     HealthDashboard:
 *       type: object
 *       properties:
 *         overview:
 *           type: object
 *           properties:
 *             status:
 *               type: string
 *               enum: [healthy, degraded, unhealthy]
 *               description: Overall system health status
 *             timestamp:
 *               type: string
 *               format: date-time
 *               description: Timestamp of health check
 *             uptime:
 *               type: integer
 *               description: System uptime in seconds
 *             environment:
 *               type: string
 *               description: Current environment
 *         healthSummary:
 *           type: object
 *           properties:
 *             total:
 *               type: integer
 *               description: Total number of services checked
 *             healthy:
 *               type: integer
 *               description: Number of healthy services
 *             degraded:
 *               type: integer
 *               description: Number of degraded services
 *             unhealthy:
 *               type: integer
 *               description: Number of unhealthy services
 *             criticalIssues:
 *               type: integer
 *               description: Number of critical issues
 *             warnings:
 *               type: integer
 *               description: Number of warnings
 *         services:
 *           type: object
 *           description: Individual service health statuses
 *         performance:
 *           type: object
 *           properties:
 *             summary:
 *               type: object
 *               properties:
 *                 totalEndpoints:
 *                   type: integer
 *                   description: Total number of monitored endpoints
 *                 avgResponseTime:
 *                   type: integer
 *                   description: Average response time across all endpoints
 *                 totalRequests:
 *                   type: integer
 *                   description: Total number of requests processed
 *                 avgErrorRate:
 *                   type: number
 *                   description: Average error rate percentage
 *             endpoints:
 *               type: object
 *               description: Performance metrics for individual endpoints
 *         systemResources:
 *           type: object
 *           properties:
 *             memory:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                   description: Total memory in MB
 *                 free:
 *                   type: integer
 *                   description: Free memory in MB
 *                 used:
 *                   type: integer
 *                   description: Used memory in MB
 *                 usagePercent:
 *                   type: integer
 *                   description: Memory usage percentage
 *             cpu:
 *               type: object
 *               properties:
 *                 cores:
 *                   type: integer
 *                   description: Number of CPU cores
 *                 loadAverage:
 *                   type: array
 *                   items:
 *                     type: number
 *                   description: System load average
 *         alerts:
 *           type: object
 *           properties:
 *             recent:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Alert'
 *             summary:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                   description: Total number of recent alerts
 *                 critical:
 *                   type: integer
 *                   description: Number of critical alerts
 *                 warnings:
 *                   type: integer
 *                   description: Number of warning alerts
 *     
 *     Alert:
 *       type: object
 *       properties:
 *         alertType:
 *           type: string
 *           description: Type of alert
 *         alertData:
 *           type: object
 *           description: Alert-specific data
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: When the alert was triggered
 *     
 *     AlertThresholds:
 *       type: object
 *       properties:
 *         responseTime:
 *           type: integer
 *           description: Response time threshold in milliseconds
 *         errorRate:
 *           type: number
 *           description: Error rate threshold (0-1)
 *         memoryUsage:
 *           type: number
 *           description: Memory usage threshold (0-1)
 *         cpuUsage:
 *           type: number
 *           description: CPU usage threshold (0-1)
 *         diskUsage:
 *           type: number
 *           description: Disk usage threshold (0-1)
 *         consecutiveFailures:
 *           type: integer
 *           description: Consecutive failures threshold
 */

/**
 * @swagger
 * /health/dashboard:
 *   get:
 *     summary: Get comprehensive health dashboard
 *     description: Returns comprehensive health dashboard with system status, performance metrics, alerts, and resource usage
 *     tags: [Health Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Health dashboard retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/HealthDashboard'
 *       206:
 *         description: System is degraded but dashboard retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/HealthDashboard'
 *       401:
 *         description: Unauthorized - Authentication required
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       503:
 *         description: System is unhealthy but dashboard retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/HealthDashboard'
 *       500:
 *         description: Failed to get health dashboard
 */
router.get('/dashboard', 
  dashboardRateLimit, 
  authenticateUser, 
  authorizeRoles(UserRoles.MANAGER, UserRoles.EXECUTIVE, UserRoles.ADMIN), 
  getHealthDashboard
);

/**
 * @swagger
 * /health/alerts:
 *   get:
 *     summary: Get alert history
 *     description: Returns recent alert history with optional filtering by alert type
 *     tags: [Health Monitoring]
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
 *         description: Maximum number of alerts to return
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Filter alerts by type
 *     responses:
 *       200:
 *         description: Alert history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     alerts:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Alert'
 *                     total:
 *                       type: integer
 *                       description: Total number of alerts returned
 *                     availableTypes:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: Available alert types for filtering
 *       401:
 *         description: Unauthorized - Authentication required
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       500:
 *         description: Failed to get alert history
 */
router.get('/alerts', 
  dashboardRateLimit, 
  authenticateUser, 
  authorizeRoles(UserRoles.MANAGER, UserRoles.EXECUTIVE, UserRoles.ADMIN), 
  getAlertHistory
);

/**
 * @swagger
 * /health/alerts/thresholds:
 *   put:
 *     summary: Update alert thresholds
 *     description: Update alert thresholds for system monitoring (admin only)
 *     tags: [Health Monitoring]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               thresholds:
 *                 $ref: '#/components/schemas/AlertThresholds'
 *             required:
 *               - thresholds
 *     responses:
 *       200:
 *         description: Alert thresholds updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Alert thresholds updated successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     updatedThresholds:
 *                       $ref: '#/components/schemas/AlertThresholds'
 *       400:
 *         description: Invalid threshold data
 *       401:
 *         description: Unauthorized - Authentication required
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Failed to update alert thresholds
 */
router.put('/alerts/thresholds', 
  adminRateLimit, 
  authenticateUser, 
  authorizeRoles(UserRoles.ADMIN), 
  updateAlertThresholds
);

/**
 * @swagger
 * /health/alerts/clear:
 *   delete:
 *     summary: Clear alert history
 *     description: Clear all alert history (admin only)
 *     tags: [Health Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Alert history cleared successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Alert history cleared successfully
 *       401:
 *         description: Unauthorized - Authentication required
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Failed to clear alert history
 */
router.delete('/alerts/clear', 
  adminRateLimit, 
  authenticateUser, 
  authorizeRoles(UserRoles.ADMIN), 
  clearAlertHistory
);

module.exports = router;