// v1/routes/monitoring.js
const express = require('express');
const router = express.Router();
const xmlMonitoring = require('../utils/xmlMonitoring');
const { ApiError } = require('../utils/apiError');

/**
 * @swagger
 * /v1/monitoring/xml/metrics:
 *   get:
 *     summary: Get XML processing performance metrics
 *     tags: [Monitoring]
 *     responses:
 *       200:
 *         description: XML processing metrics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     averageProcessingTimes:
 *                       type: object
 *                     operationCounts:
 *                       type: object
 *                     errorCounts:
 *                       type: object
 *                     errorRate:
 *                       type: string
 */
router.get('/xml/metrics', async (req, res, next) => {
  try {
    const metrics = xmlMonitoring.getPerformanceMetrics();
    
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    next(ApiError.internalServerError('Failed to retrieve XML metrics', {
      originalError: error.message
    }));
  }
});

/**
 * @swagger
 * /v1/monitoring/cloudflare/metrics:
 *   get:
 *     summary: Get Cloudflare performance metrics
 *     tags: [Monitoring]
 *     responses:
 *       200:
 *         description: Cloudflare performance metrics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     averageOperationTimes:
 *                       type: object
 *                     operationCounts:
 *                       type: object
 *                     errorCounts:
 *                       type: object
 *                     cdnPerformance:
 *                       type: object
 *                     migrationStatus:
 *                       type: object
 */
// Cloudflare metrics endpoint removed - migrated to S3

/**
 * @swagger
 * /v1/monitoring/health:
 *   get:
 *     summary: Get overall system health status
 *     tags: [Monitoring]
 *     responses:
 *       200:
 *         description: System health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                     xml:
 *                       type: object
 *                     cloudflare:
 *                       type: object
 *                     timestamp:
 *                       type: string
 */
router.get('/health', async (req, res, next) => {
  try {
    const xmlMetrics = xmlMonitoring.getPerformanceMetrics();
    
    // Determine overall health status
    const xmlHealthy = parseFloat(xmlMetrics.errorRate) < 0.1; // Less than 10% error rate
    const overallHealthy = xmlHealthy;
    
    const healthStatus = {
      status: overallHealthy ? 'healthy' : 'degraded',
      xml: {
        status: xmlHealthy ? 'healthy' : 'degraded',
        errorRate: xmlMetrics.errorRate,
        consecutiveFailures: xmlMetrics.consecutiveFailures,
        totalOperations: Object.values(xmlMetrics.operationCounts).reduce((sum, count) => sum + count, 0)
      },
      cloudflare: {
        status: cloudflareHealthy ? 'healthy' : 'degraded',
        errorRate: cloudflareMetrics.errorRate,
        consecutiveFailures: cloudflareMetrics.consecutiveFailures,
        totalOperations: Object.values(cloudflareMetrics.operationCounts).reduce((sum, count) => sum + count, 0),
        migrationStatus: cloudflareMetrics.migrationStatus
      },
      timestamp: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: healthStatus
    });
  } catch (error) {
    next(ApiError.internalServerError('Failed to retrieve health status', {
      originalError: error.message
    }));
  }
});

/**
 * @swagger
 * /v1/monitoring/performance/comparison:
 *   get:
 *     summary: Get XML vs JSON performance comparison
 *     tags: [Monitoring]
 *     responses:
 *       200:
 *         description: Performance comparison data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     xmlVsJsonRatio:
 *                       type: string
 *                     averageXmlTime:
 *                       type: number
 *                     averageJsonTime:
 *                       type: number
 *                     recommendation:
 *                       type: string
 */
router.get('/performance/comparison', async (req, res, next) => {
  try {
    const xmlMetrics = xmlMonitoring.getPerformanceMetrics();
    
    const comparison = {
      xmlVsJsonRatio: xmlMetrics.averageProcessingTimes.xmlVsJsonRatio,
      averageXmlTime: xmlMetrics.averageProcessingTimes.xml,
      averageJsonTime: xmlMetrics.averageProcessingTimes.json,
      averageSoapTime: xmlMetrics.averageProcessingTimes.soap,
      averageParsingTime: xmlMetrics.averageProcessingTimes.parsing,
      recommendation: xmlMetrics.averageProcessingTimes.xmlVsJsonRatio !== 'N/A' && 
                     parseFloat(xmlMetrics.averageProcessingTimes.xmlVsJsonRatio) > 2 
                     ? 'Consider optimizing XML processing or caching' 
                     : 'Performance is acceptable'
    };
    
    res.json({
      success: true,
      data: comparison
    });
  } catch (error) {
    next(ApiError.internalServerError('Failed to retrieve performance comparison', {
      originalError: error.message
    }));
  }
});

/**
 * @swagger
 * /v1/monitoring/reset:
 *   post:
 *     summary: Reset monitoring metrics (for testing/maintenance)
 *     tags: [Monitoring]
 *     responses:
 *       200:
 *         description: Metrics reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 */
router.post('/reset', async (req, res, next) => {
  try {
    xmlMonitoring.resetMetrics();
    
    res.json({
      success: true,
      message: 'Monitoring metrics reset successfully'
    });
  } catch (error) {
    next(ApiError.internalServerError('Failed to reset metrics', {
      originalError: error.message
    }));
  }
});

/**
 * @swagger
 * /v1/monitoring/migration/status:
 *   get:
 *     summary: Get current migration status
 *     tags: [Monitoring]
 *     responses:
 *       200:
 *         description: Migration status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                     progress:
 *                       type: object
 */
router.get('/migration/status', async (req, res, next) => {
  try {
    // Migration status endpoint - S3 migration completed
    
    res.json({
      success: true,
      data: cloudflareMetrics.migrationStatus
    });
  } catch (error) {
    next(ApiError.internalServerError('Failed to retrieve migration status', {
      originalError: error.message
    }));
  }
});

module.exports = router;