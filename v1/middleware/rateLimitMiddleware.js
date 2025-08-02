// v1/middleware/rateLimitMiddleware.js
const rateLimit = require('express-rate-limit');
const { StatusCodes } = require('http-status-codes');
const ApiResponse = require('../utils/apiResponse');
const redisClient = require('../config/redis');
const logger = require('../utils/logger');

/**
 * @function createAdvancedRateLimiter
 * @description Creates an advanced rate limiter with user-specific and IP-based limits
 * @param {object} options - Rate limiting options
 * @returns {Function} Express middleware function
 */
const createAdvancedRateLimiter = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    maxPerIP = 100,
    maxPerUser = 200, // Authenticated users get higher limits
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    keyPrefix = 'rl',
    message = 'Too many requests, please try again later',
  } = options;

  return rateLimit({
    windowMs,
    max: (req) => {
      // Higher limits for authenticated users
      if (req.user && req.user.userId) {
        return maxPerUser;
      }
      return maxPerIP;
    },
    keyGenerator: (req) => {
      // Use user ID for authenticated requests, IP for anonymous
      if (req.user && req.user.userId) {
        return `${keyPrefix}:user:${req.user.userId}`;
      }
      return `${keyPrefix}:ip:${req.ip}`;
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    skipFailedRequests,
    store: redisClient.isReady ? undefined : undefined, // Use default memory store if Redis unavailable
    message: (req, res) => {
      const isUser = req.user && req.user.userId;
      const identifier = isUser ? `user ${req.user.userId}` : `IP ${req.ip}`;
      
      // Log rate limit exceeded
      logger.logSecurityEvent('RATE_LIMIT_EXCEEDED', {
        identifier,
        userAgent: req.get('User-Agent'),
        endpoint: req.originalUrl,
        method: req.method,
        isAuthenticated: !!isUser,
      }, 'medium');

      ApiResponse.error(res, StatusCodes.TOO_MANY_REQUESTS, message);
    },
  });
};

/**
 * @constant apiLimiter
 * @description General API rate limiting with user-specific limits
 */
const apiLimiter = createAdvancedRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxPerIP: 100,
  maxPerUser: 200,
  keyPrefix: 'api',
  message: 'Too many API requests, please try again after 15 minutes',
});

/**
 * @constant authLimiter
 * @description Stricter rate limiting for authentication routes
 */
const authLimiter = createAdvancedRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxPerIP: 10,
  maxPerUser: 15, // Slightly higher for authenticated users
  keyPrefix: 'auth',
  message: 'Too many authentication attempts, please try again after 15 minutes',
  skipSuccessfulRequests: false, // Count all auth attempts
});

/**
 * @constant strictAuthLimiter
 * @description Very strict rate limiting for sensitive auth operations (password reset, etc.)
 */
const strictAuthLimiter = createAdvancedRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxPerIP: 3,
  maxPerUser: 5,
  keyPrefix: 'strict_auth',
  message: 'Too many sensitive authentication attempts, please try again after 1 hour',
});

/**
 * @constant paymentLimiter
 * @description Rate limiting for payment-related endpoints
 */
const paymentLimiter = createAdvancedRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  maxPerIP: 5,
  maxPerUser: 10,
  keyPrefix: 'payment',
  message: 'Too many payment attempts, please try again after 10 minutes',
});

/**
 * @constant uploadLimiter
 * @description Rate limiting for file upload endpoints
 */
const uploadLimiter = createAdvancedRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxPerIP: 10,
  maxPerUser: 20,
  keyPrefix: 'upload',
  message: 'Too many file upload attempts, please try again after 5 minutes',
});

/**
 * @function createUserSpecificLimiter
 * @description Creates a rate limiter that applies different limits based on user role
 * @param {object} roleLimits - Object mapping roles to their limits
 * @returns {Function} Express middleware function
 */
const createUserSpecificLimiter = (roleLimits = {}) => {
  const defaultLimits = {
    admin: 1000,
    manager: 500,
    staff: 200,
    user: 100,
    guest: 50,
  };

  const limits = { ...defaultLimits, ...roleLimits };

  return createAdvancedRateLimiter({
    windowMs: 15 * 60 * 1000,
    maxPerIP: limits.guest,
    maxPerUser: (req) => {
      const userRole = req.user?.role || 'guest';
      return limits[userRole] || limits.guest;
    },
    keyPrefix: 'role_based',
    message: 'Rate limit exceeded for your user role',
  });
};

/**
 * @constant affiliateLimiter
 * @description Rate limiting for affiliate-related endpoints
 */
const affiliateLimiter = createAdvancedRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxPerIP: 50,
  maxPerUser: 100,
  keyPrefix: 'affiliate',
  message: 'Too many affiliate requests, please try again after 15 minutes',
});

/**
 * @constant affiliateRegistrationLimiter
 * @description Strict rate limiting for affiliate registration
 */
const affiliateRegistrationLimiter = createAdvancedRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxPerIP: 3,
  maxPerUser: 5,
  keyPrefix: 'affiliate_reg',
  message: 'Too many affiliate registration attempts, please try again after 1 hour',
});

/**
 * @constant affiliateWithdrawalLimiter
 * @description Rate limiting for withdrawal requests
 */
const affiliateWithdrawalLimiter = createAdvancedRateLimiter({
  windowMs: 30 * 60 * 1000, // 30 minutes
  maxPerIP: 5,
  maxPerUser: 10,
  keyPrefix: 'affiliate_withdrawal',
  message: 'Too many withdrawal requests, please try again after 30 minutes',
});

/**
 * @constant affiliateAdminLimiter
 * @description Rate limiting for admin affiliate operations
 */
const affiliateAdminLimiter = createAdvancedRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxPerIP: 200,
  maxPerUser: 500,
  keyPrefix: 'affiliate_admin',
  message: 'Too many admin affiliate requests, please try again after 15 minutes',
});

/**
 * @constant affiliateNotificationLimiter
 * @description Rate limiting for affiliate notification endpoints
 */
const affiliateNotificationLimiter = createAdvancedRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxPerIP: 30,
  maxPerUser: 60,
  keyPrefix: 'affiliate_notification',
  message: 'Too many notification requests, please try again after 15 minutes',
});

/**
 * @constant monthlyStatementLimiter
 * @description Strict rate limiting for monthly statement operations
 */
const monthlyStatementLimiter = createAdvancedRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxPerIP: 10,
  maxPerUser: 20,
  keyPrefix: 'monthly_statement',
  message: 'Too many monthly statement requests, please try again after 1 hour',
});

/**
 * @constant qrCodeGenerationLimiter
 * @description Rate limiting for QR code generation endpoints (most resource intensive)
 */
const qrCodeGenerationLimiter = createAdvancedRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxPerIP: 20, // Lower limit due to resource intensity
  maxPerUser: 50, // Higher for authenticated users
  keyPrefix: 'qr_generation',
  message: 'Too many QR code generation requests, please try again after 15 minutes',
  skipSuccessfulRequests: false, // Count all generation attempts
});

/**
 * @constant qrCodeValidationLimiter
 * @description Rate limiting for QR code validation endpoints (moderate sensitivity)
 */
const qrCodeValidationLimiter = createAdvancedRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  maxPerIP: 50,
  maxPerUser: 100,
  keyPrefix: 'qr_validation',
  message: 'Too many QR code validation requests, please try again after 10 minutes',
});

/**
 * @constant qrCodeMetadataLimiter
 * @description Rate limiting for QR code metadata retrieval (low sensitivity)
 */
const qrCodeMetadataLimiter = createAdvancedRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxPerIP: 100,
  maxPerUser: 200,
  keyPrefix: 'qr_metadata',
  message: 'Too many QR code metadata requests, please try again after 15 minutes',
});

/**
 * @constant qrCodeDownloadLimiter
 * @description Rate limiting for QR code image downloads (bandwidth intensive)
 */
const qrCodeDownloadLimiter = createAdvancedRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxPerIP: 30, // Lower due to bandwidth usage
  maxPerUser: 60,
  keyPrefix: 'qr_download',
  message: 'Too many QR code download requests, please try again after 5 minutes',
});

/**
 * @constant qrCodeHealthLimiter
 * @description Rate limiting for QR code health check endpoints (public endpoint)
 */
const qrCodeHealthLimiter = createAdvancedRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  maxPerIP: 10, // Frequent health checks allowed
  maxPerUser: 20,
  keyPrefix: 'qr_health',
  message: 'Too many health check requests, please try again after 1 minute',
});

/**
 * @constant qrCodeSensitiveLimiter
 * @description Strict rate limiting for sensitive QR operations (withdrawal, commission)
 */
const qrCodeSensitiveLimiter = createAdvancedRateLimiter({
  windowMs: 30 * 60 * 1000, // 30 minutes
  maxPerIP: 10, // Very strict for sensitive operations
  maxPerUser: 20,
  keyPrefix: 'qr_sensitive',
  message: 'Too many sensitive QR code requests, please try again after 30 minutes',
  skipSuccessfulRequests: false,
});

/**
 * @function createQRCodeRateLimiter
 * @description Creates a QR code specific rate limiter with monitoring and logging
 * @param {string} qrType - Type of QR code operation (generation, validation, etc.)
 * @param {object} options - Rate limiting options
 * @returns {Function} Express middleware function
 */
const createQRCodeRateLimiter = (qrType, options = {}) => {
  const {
    windowMs = 15 * 60 * 1000,
    maxPerIP = 50,
    maxPerUser = 100,
    message = `Too many QR code ${qrType} requests, please try again later`,
  } = options;

  return rateLimit({
    windowMs,
    max: (req) => {
      // Higher limits for authenticated users
      if (req.user && req.user.userId) {
        return maxPerUser;
      }
      return maxPerIP;
    },
    keyGenerator: (req) => {
      // Use user ID for authenticated requests, IP for anonymous
      if (req.user && req.user.userId) {
        return `qr_${qrType}:user:${req.user.userId}`;
      }
      return `qr_${qrType}:ip:${req.ip}`;
    },
    standardHeaders: true,
    legacyHeaders: false,
    message: (req, res) => {
      const isUser = req.user && req.user.userId;
      const identifier = isUser ? `user ${req.user.userId}` : `IP ${req.ip}`;
      
      // Log QR code rate limit violation with additional context
      logger.logSecurityEvent('QR_CODE_RATE_LIMIT_EXCEEDED', {
        qrType,
        identifier,
        userAgent: req.get('User-Agent'),
        endpoint: req.originalUrl,
        method: req.method,
        isAuthenticated: !!isUser,
        requestBody: req.body ? Object.keys(req.body) : [],
        timestamp: new Date().toISOString(),
      }, 'medium');

      // Additional monitoring for QR code abuse patterns
      if (req.body && req.body.type) {
        logger.logSecurityEvent('QR_CODE_TYPE_RATE_LIMIT', {
          qrCodeType: req.body.type,
          operationType: qrType,
          identifier,
          endpoint: req.originalUrl,
        }, 'low');
      }

      ApiResponse.error(res, StatusCodes.TOO_MANY_REQUESTS, message);
    },
  });
};

/**
 * @function suspiciousActivityLimiter
 * @description Extremely strict limiter for detecting suspicious activity
 */
const suspiciousActivityLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // Very low limit
  keyGenerator: (req) => `suspicious:${req.ip}`,
  standardHeaders: false,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Only count failed requests
  skipFailedRequests: false,
  message: (req, res) => {
    // Log suspicious activity
    logger.logSecurityEvent('SUSPICIOUS_ACTIVITY_DETECTED', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.originalUrl,
      method: req.method,
      userId: req.user?.userId,
    }, 'critical');

    ApiResponse.error(res, StatusCodes.TOO_MANY_REQUESTS, 'Suspicious activity detected');
  },
});

module.exports = {
  apiLimiter,
  authLimiter,
  strictAuthLimiter,
  paymentLimiter,
  uploadLimiter,
  affiliateLimiter,
  affiliateRegistrationLimiter,
  affiliateWithdrawalLimiter,
  affiliateAdminLimiter,
  affiliateNotificationLimiter,
  monthlyStatementLimiter,
  qrCodeGenerationLimiter,
  qrCodeValidationLimiter,
  qrCodeMetadataLimiter,
  qrCodeDownloadLimiter,
  qrCodeHealthLimiter,
  qrCodeSensitiveLimiter,
  createAdvancedRateLimiter,
  createUserSpecificLimiter,
  createQRCodeRateLimiter,
  suspiciousActivityLimiter,
};