// v1/routes/healthRoutes.js
const express = require('express');
const {
  getHealthStatus,
  getServiceHealth,
  getPerformanceMetrics,
  getSystemInfo,
  clearPerformanceMetrics,
  getLivenessProbe,
  getReadinessProbe
} = require('../controllers/healthController');
const { authenticateUser, authorizeRoles } = require('../middleware/authMiddleware');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Rate limiting for health endpoints
const healthRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: {
    status: 'error',
    message: 'Too many health check requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const adminRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute for admin endpoints
  message: {
    status: 'error',
    message: 'Too many admin requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * @swagger
 * components:
 *   schemas:
 *     HealthStatus:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           enum: [healthy, degraded, unhealthy]
 *           description: Overall system health status
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: Timestamp of health check
 *         summary:
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
 *     
 *     ServiceHealth:
 *       type: object
 *       properties:
 *         service:
 *           type: string
 *           description: Service identifier
 *         name:
 *           type: string
 *           description: Service display name
 *         status:
 *           type: string
 *           enum: [healthy, degraded, unhealthy]
 *           description: Service health status
 *         responseTime:
 *           type: integer
 *           description: Health check response time in milliseconds
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: Timestamp of health check
 *         duration:
 *           type: integer
 *           description: Health check duration in milliseconds
 *         details:
 *           type: object
 *           description: Service-specific health details
 *         error:
 *           type: string
 *           description: Error message if service is unhealthy
 *     
 *     PerformanceMetrics:
 *       type: object
 *       properties:
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: Timestamp of metrics collection
 *         metrics:
 *           type: object
 *           description: Performance metrics by endpoint
 *           additionalProperties:
 *             type: object
 *             properties:
 *               endpoint:
 *                 type: string
 *                 description: API endpoint path
 *               method:
 *                 type: string
 *                 description: HTTP method
 *               totalRequests:
 *                 type: integer
 *                 description: Total number of requests
 *               avgResponseTime:
 *                 type: integer
 *                 description: Average response time in milliseconds
 *               errorRate:
 *                 type: number
 *                 description: Error rate percentage
 *               recentRequests:
 *                 type: integer
 *                 description: Number of requests in last 5 minutes
 *               lastActivity:
 *                 type: string
 *                 format: date-time
 *                 description: Timestamp of last activity
 *     
 *     SystemInfo:
 *       type: object
 *       properties:
 *         application:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *               description: Application name
 *             version:
 *               type: string
 *               description: Application version
 *             environment:
 *               type: string
 *               description: Runtime environment
 *             uptime:
 *               type: integer
 *               description: Application uptime in seconds
 *             startTime:
 *               type: string
 *               format: date-time
 *               description: Application start time
 *         system:
 *           type: object
 *           properties:
 *             platform:
 *               type: string
 *               description: Operating system platform
 *             architecture:
 *               type: string
 *               description: System architecture
 *             nodeVersion:
 *               type: string
 *               description: Node.js version
 *             totalMemory:
 *               type: integer
 *               description: Total system memory in MB
 *             freeMemory:
 *               type: integer
 *               description: Free system memory in MB
 *             cpuCores:
 *               type: integer
 *               description: Number of CPU cores
 *             loadAverage:
 *               type: array
 *               items:
 *                 type: number
 *               description: System load average
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: Timestamp of system info collection
 */

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Get overall system health status
 *     description: Returns comprehensive health status of all system components including database, Redis, third-party services, and system resources
 *     tags: [Health Monitoring]
 *     responses:
 *       200:
 *         description: System is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/HealthStatus'
 *       206:
 *         description: System is degraded (some non-critical services are down)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/HealthStatus'
 *       503:
 *         description: System is unhealthy (critical services are down)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/HealthStatus'
 *       500:
 *         description: Health check failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: error
 *                 message:
 *                   type: string
 *                   example: Health check failed
 *                 error:
 *                   type: string
 *                   example: Internal server error
 */
router.get('/', healthRateLimit, getHealthStatus);

/**
 * @swagger
 * /health/service/{serviceName}:
 *   get:
 *     summary: Get health status for a specific service
 *     description: Returns health status for a specific service (database, redis, paystack, amadeus, s3, allianz, ratehawk, system)
 *     tags: [Health Monitoring]
 *     parameters:
 *       - in: path
 *         name: serviceName
 *         required: true
 *         schema:
 *           type: string
 *           enum: [database, redis, paystack, amadeus, s3, allianz, ratehawk, system]
 *         description: Name of the service to check
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/ServiceHealth'
 *       206:
 *         description: Service is degraded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/ServiceHealth'
 *       404:
 *         description: Service not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: error
 *                 message:
 *                   type: string
 *                   example: Service 'unknown' not found
 *       503:
 *         description: Service is unhealthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/ServiceHealth'
 */
router.get('/service/:serviceName', healthRateLimit, getServiceHealth);

/**
 * @swagger
 * /health/metrics:
 *   get:
 *     summary: Get API performance metrics
 *     description: Returns performance metrics for all API endpoints including response times, error rates, and request counts
 *     tags: [Health Monitoring]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: detailed
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Return detailed metrics with percentiles and trends
 *       - in: query
 *         name: endpoint
 *         schema:
 *           type: string
 *         description: Get metrics for specific endpoint (requires detailed=true)
 *     responses:
 *       200:
 *         description: Performance metrics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/PerformanceMetrics'
 *       401:
 *         description: Unauthorized - Authentication required
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       500:
 *         description: Failed to get performance metrics
 */
router.get('/metrics', healthRateLimit, authenticateUser, authorizeRoles('manager', 'admin'), getPerformanceMetrics);

/**
 * @swagger
 * /health/system:
 *   get:
 *     summary: Get system information
 *     description: Returns basic system information including application details, system resources, and runtime environment
 *     tags: [Health Monitoring]
 *     responses:
 *       200:
 *         description: System information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/SystemInfo'
 *       500:
 *         description: Failed to get system info
 */
router.get('/system', healthRateLimit, getSystemInfo);

/**
 * @swagger
 * /health/metrics/clear:
 *   delete:
 *     summary: Clear performance metrics
 *     description: Clear all stored performance metrics (admin only)
 *     tags: [Health Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Performance metrics cleared successfully
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
 *                   example: Performance metrics cleared successfully
 *       401:
 *         description: Unauthorized - Authentication required
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Failed to clear performance metrics
 */
router.delete('/metrics/clear', adminRateLimit, authenticateUser, authorizeRoles('admin'), clearPerformanceMetrics);

/**
 * @swagger
 * /health/liveness:
 *   get:
 *     summary: Liveness probe
 *     description: Simple liveness probe for container orchestration systems (Kubernetes, Docker Swarm, etc.)
 *     tags: [Health Monitoring]
 *     responses:
 *       200:
 *         description: Application is alive
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: alive
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: 2024-01-15T10:30:00.000Z
 */
router.get('/liveness', getLivenessProbe);

/**
 * @swagger
 * /health/readiness:
 *   get:
 *     summary: Readiness probe
 *     description: Readiness probe that checks critical services for container orchestration systems
 *     tags: [Health Monitoring]
 *     responses:
 *       200:
 *         description: Application is ready to serve traffic
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ready
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: 2024-01-15T10:30:00.000Z
 *                 services:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ServiceHealth'
 *       503:
 *         description: Application is not ready to serve traffic
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: not_ready
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: 2024-01-15T10:30:00.000Z
 *                 services:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ServiceHealth'
 *                 error:
 *                   type: string
 *                   example: Critical services are not available
 */
router.get('/readiness', getReadinessProbe);

// Health dashboard routes
router.use('/', require('./healthDashboardRoutes'));

module.exports = router;