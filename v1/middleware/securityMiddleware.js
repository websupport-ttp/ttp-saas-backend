// v1/middleware/securityMiddleware.js
const { StatusCodes } = require('http-status-codes');
const { ApiError } = require('../utils/apiError');
const asyncHandler = require('./asyncHandler');
const logger = require('../utils/logger');
const validator = require('validator');
// Use xss-clean instead of xss for consistency with existing app.js
const xssClean = require('xss-clean');

/**
 * @function sanitizeInput
 * @description Comprehensive input sanitization middleware
 */
const sanitizeInput = asyncHandler(async (req, res, next) => {
  // Sanitize request body
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }

  // Sanitize URL parameters
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params);
  }

  next();
});

/**
 * @function sanitizeObject
 * @description Recursively sanitize an object
 * @param {object} obj - Object to sanitize
 * @returns {object} Sanitized object
 */
const sanitizeObject = (obj) => {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  if (typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize key names
      const cleanKey = sanitizeString(key);
      sanitized[cleanKey] = sanitizeObject(value);
    }
    return sanitized;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  return obj;
};

/**
 * @function sanitizeString
 * @description Sanitize a string value
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
const sanitizeString = (str) => {
  if (typeof str !== 'string') {
    return str;
  }

  // Remove XSS attempts - use basic string cleaning since xss-clean is applied globally
  let sanitized = str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/javascript:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/on\w+\s*=/gi, ''); // Remove event handlers

  // Remove SQL injection patterns
  sanitized = sanitized.replace(/('|(\\')|(;)|(\\;)|(\|)|(\*)|(%)|(<)|(>)|(\{)|(\})|(\[)|(\])|(\\))/g, '');

  // Remove NoSQL injection patterns
  sanitized = sanitized.replace(/(\$where|\$ne|\$in|\$nin|\$gt|\$gte|\$lt|\$lte|\$exists|\$regex)/gi, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  return sanitized;
};

/**
 * @function validateCommonInputs
 * @description Validate common input patterns
 */
const validateCommonInputs = asyncHandler(async (req, res, next) => {
  const errors = [];

  // Validate email if present
  if (req.body.email && !validator.isEmail(req.body.email)) {
    errors.push('Invalid email format');
  }

  // Validate phone number if present
  if (req.body.phoneNumber && !validator.isMobilePhone(req.body.phoneNumber, 'any', { strictMode: false })) {
    errors.push('Invalid phone number format');
  }

  // Validate URLs if present
  const urlFields = ['website', 'profileUrl', 'imageUrl', 'documentUrl'];
  urlFields.forEach(field => {
    if (req.body[field] && !validator.isURL(req.body[field], { require_protocol: true })) {
      errors.push(`Invalid ${field} format`);
    }
  });

  // Validate numeric fields
  const numericFields = ['price', 'amount', 'quantity', 'serviceCharge'];
  numericFields.forEach(field => {
    if (req.body[field] !== undefined && !validator.isNumeric(String(req.body[field]))) {
      errors.push(`${field} must be a valid number`);
    }
  });

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /script\s*:/i,
    /javascript\s*:/i,
    /vbscript\s*:/i,
    /onload\s*=/i,
    /onerror\s*=/i,
    /onclick\s*=/i,
    /<\s*iframe/i,
    /<\s*object/i,
    /<\s*embed/i,
    /eval\s*\(/i,
    /expression\s*\(/i,
  ];

  const checkForSuspiciousContent = (obj, path = '') => {
    if (typeof obj === 'string') {
      suspiciousPatterns.forEach(pattern => {
        if (pattern.test(obj)) {
          logger.logSecurityEvent('SUSPICIOUS_INPUT_DETECTED', {
            pattern: pattern.toString(),
            content: obj.substring(0, 100),
            field: path,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            userId: req.user?.userId,
          }, 'high');
          errors.push(`Suspicious content detected in ${path || 'input'}`);
        }
      });
    } else if (typeof obj === 'object' && obj !== null) {
      Object.entries(obj).forEach(([key, value]) => {
        checkForSuspiciousContent(value, path ? `${path}.${key}` : key);
      });
    }
  };

  // Check all input for suspicious content
  checkForSuspiciousContent(req.body, 'body');
  checkForSuspiciousContent(req.query, 'query');
  checkForSuspiciousContent(req.params, 'params');

  if (errors.length > 0) {
    throw new ApiError(`Input validation failed: ${errors.join(', ')}`, StatusCodes.BAD_REQUEST);
  }

  next();
});

/**
 * @function preventParameterPollution
 * @description Enhanced parameter pollution prevention
 */
const preventParameterPollution = asyncHandler(async (req, res, next) => {
  // Check for duplicate parameters in query string
  const queryKeys = Object.keys(req.query);
  const duplicateKeys = queryKeys.filter((key, index) => queryKeys.indexOf(key) !== index);
  
  if (duplicateKeys.length > 0) {
    logger.logSecurityEvent('PARAMETER_POLLUTION_DETECTED', {
      duplicateKeys,
      query: req.query,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.userId,
    }, 'medium');
    
    throw new ApiError('Duplicate parameters detected', StatusCodes.BAD_REQUEST);
  }

  // Limit the number of parameters
  const maxParams = 50;
  if (queryKeys.length > maxParams) {
    logger.logSecurityEvent('EXCESSIVE_PARAMETERS_DETECTED', {
      paramCount: queryKeys.length,
      maxAllowed: maxParams,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.userId,
    }, 'medium');
    
    throw new ApiError('Too many parameters', StatusCodes.BAD_REQUEST);
  }

  next();
});

/**
 * @function validateFileUpload
 * @description Validate file uploads for security
 */
const validateFileUpload = (allowedTypes = [], maxSize = 5 * 1024 * 1024) => {
  return asyncHandler(async (req, res, next) => {
    if (!req.file && !req.files) {
      return next();
    }

    const files = req.files || [req.file];
    const filesToCheck = Array.isArray(files) ? files : Object.values(files).flat();

    for (const file of filesToCheck) {
      if (!file) continue;

      // Check file size
      if (file.size > maxSize) {
        throw new ApiError(`File size exceeds limit of ${maxSize / (1024 * 1024)}MB`, StatusCodes.BAD_REQUEST);
      }

      // Check file type
      if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
        throw new ApiError(`File type ${file.mimetype} not allowed`, StatusCodes.BAD_REQUEST);
      }

      // Check for suspicious file names
      const suspiciousExtensions = ['.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar', '.php', '.asp', '.jsp'];
      const fileName = file.originalname.toLowerCase();
      
      if (suspiciousExtensions.some(ext => fileName.endsWith(ext))) {
        logger.logSecurityEvent('SUSPICIOUS_FILE_UPLOAD', {
          fileName: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          userId: req.user?.userId,
        }, 'high');
        
        throw new ApiError('File type not allowed for security reasons', StatusCodes.BAD_REQUEST);
      }

      // Check for null bytes in filename (path traversal attempt)
      if (file.originalname.includes('\0')) {
        logger.logSecurityEvent('PATH_TRAVERSAL_ATTEMPT', {
          fileName: file.originalname,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          userId: req.user?.userId,
        }, 'critical');
        
        throw new ApiError('Invalid file name', StatusCodes.BAD_REQUEST);
      }
    }

    next();
  });
};

/**
 * @function detectBruteForce
 * @description Detect potential brute force attacks
 */
const detectBruteForce = asyncHandler(async (req, res, next) => {
  const key = `brute_force:${req.ip}`;
  const redisClient = require('../config/redis');
  
  if (redisClient.isReady) {
    try {
      const attempts = await redisClient.get(key);
      const attemptCount = parseInt(attempts) || 0;
      
      if (attemptCount > 20) { // More than 20 failed attempts
        logger.logSecurityEvent('BRUTE_FORCE_DETECTED', {
          ip: req.ip,
          attempts: attemptCount,
          userAgent: req.get('User-Agent'),
          endpoint: req.originalUrl,
        }, 'critical');
        
        throw new ApiError('Too many failed attempts. Account temporarily locked.', StatusCodes.TOO_MANY_REQUESTS);
      }
    } catch (error) {
      logger.warn('Error checking brute force attempts:', error.message);
    }
  }
  
  next();
});

/**
 * @function logFailedAttempt
 * @description Log failed authentication attempts
 */
const logFailedAttempt = asyncHandler(async (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Check if this was a failed authentication attempt
    if (res.statusCode === 401 || res.statusCode === 403) {
      const key = `brute_force:${req.ip}`;
      const redisClient = require('../config/redis');
      
      if (redisClient.isReady) {
        redisClient.incr(key).then(() => {
          redisClient.expire(key, 3600); // Expire after 1 hour
        }).catch(error => {
          logger.warn('Error logging failed attempt:', error.message);
        });
      }
      
      logger.logSecurityEvent('AUTHENTICATION_FAILED', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.originalUrl,
        method: req.method,
        statusCode: res.statusCode,
      }, 'medium');
    }
    
    originalSend.call(this, data);
  };
  
  next();
});

module.exports = {
  sanitizeInput,
  validateCommonInputs,
  preventParameterPollution,
  validateFileUpload,
  detectBruteForce,
  logFailedAttempt,
  sanitizeObject,
  sanitizeString,
};