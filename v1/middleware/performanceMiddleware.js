// v1/middleware/performanceMiddleware.js
const healthCheckService = require('../services/healthCheckService');
const performanceTracker = require('../utils/performanceTracker');
const logger = require('../utils/logger');

/**
 * @function performanceMonitoringMiddleware
 * @description Enhanced middleware to track API performance metrics
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Next middleware function
 */
const performanceMonitoringMiddleware = (req, res, next) => {
  const startTime = Date.now();
  
  // Override res.end to capture response details
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const duration = Date.now() - startTime;
    
    try {
      // Record performance metric in health check service (existing functionality)
      healthCheckService.recordPerformanceMetric(
        req.originalUrl,
        duration,
        res.statusCode,
        req.method
      );

      // Record detailed performance metrics in enhanced tracker
      performanceTracker.trackRequest({
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        responseTime: duration,
        userAgent: req.get('User-Agent'),
        ip: req.ip || req.connection.remoteAddress,
        userId: req.user?.userId,
        contentLength: res.get('Content-Length')
      });

      // Log slow requests
      if (duration > 5000) { // 5 seconds
        logger.warn('Slow request detected', {
          method: req.method,
          url: req.originalUrl,
          duration,
          statusCode: res.statusCode,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
          userId: req.user?.userId
        });
      }

      // Log error responses
      if (res.statusCode >= 500) {
        logger.error('Server error response', {
          method: req.method,
          url: req.originalUrl,
          statusCode: res.statusCode,
          duration,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
          userId: req.user?.userId
        });
      }
    } catch (error) {
      logger.error('Failed to record performance metrics:', error.message);
    }
    
    // Call original end method
    originalEnd.call(this, chunk, encoding);
  };

  next();
};

module.exports = performanceMonitoringMiddleware;