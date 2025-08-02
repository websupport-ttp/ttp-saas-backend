// v1/middleware/requestLogger.js
const logger = require('../utils/logger');
const crypto = require('crypto');

/**
 * @function generateRequestId
 * @description Generate unique request ID
 * @returns {string} Unique request ID
 */
const generateRequestId = () => {
  return crypto.randomUUID().split('-')[0]; // Use first part of UUID for shorter ID
};

/**
 * @function requestLogger
 * @description Middleware to log HTTP requests with performance metrics
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Next middleware function
 */
const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Add request ID for tracing
  req.id = generateRequestId();
  
  // Log incoming request
  logger.http(`Incoming ${req.method} ${req.originalUrl}`, {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.id,
    timestamp: new Date().toISOString(),
  });

  // Override res.end to capture response details
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const duration = Date.now() - startTime;
    
    // Log API request completion
    logger.logApiRequest(req, res, duration);
    
    // Log slow requests
    if (duration > 2000) {
      logger.warn(`Slow request detected: ${req.method} ${req.originalUrl} took ${duration}ms`, {
        method: req.method,
        url: req.originalUrl,
        duration,
        statusCode: res.statusCode,
        requestId: req.id,
        slowRequest: true
      });
    }
    
    // Call original end method
    originalEnd.call(this, chunk, encoding);
  };

  next();
};

module.exports = requestLogger;