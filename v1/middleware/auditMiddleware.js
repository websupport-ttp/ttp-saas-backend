// v1/middleware/auditMiddleware.js
const asyncHandler = require('./asyncHandler');
const logger = require('../utils/logger');
const AuditLog = require('../models/auditLogModel');

/**
 * @function auditLog
 * @description Middleware to log sensitive operations for audit purposes
 * @param {string} operation - The operation being performed
 * @param {object} options - Additional options for audit logging
 * @returns {Function} Express middleware function
 */
const auditLog = (operation, options = {}) => {
  const {
    includeRequestBody = false,
    includeResponseBody = false,
    sensitiveFields = ['password', 'token', 'secret', 'key'],
    category = 'GENERAL',
  } = options;

  return asyncHandler(async (req, res, next) => {
    const startTime = Date.now();
    
    // Store original response methods
    const originalSend = res.send;
    const originalJson = res.json;
    let responseBody = null;

    // Intercept response to capture response data
    res.send = function(data) {
      if (includeResponseBody) {
        responseBody = data;
      }
      return originalSend.call(this, data);
    };

    res.json = function(data) {
      if (includeResponseBody) {
        responseBody = data;
      }
      return originalJson.call(this, data);
    };

    // Continue with the request
    next();

    // Log after response is sent
    res.on('finish', async () => {
      try {
        const duration = Date.now() - startTime;
        
        // Prepare audit log data
        const auditData = {
          operation,
          category,
          userId: req.user?.userId || null,
          userRole: req.user?.role || 'anonymous',
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          method: req.method,
          endpoint: req.originalUrl,
          statusCode: res.statusCode,
          duration,
          timestamp: new Date(),
          success: res.statusCode < 400,
        };

        // Add request body if requested (sanitized)
        if (includeRequestBody && req.body) {
          auditData.requestData = sanitizeAuditData(req.body, sensitiveFields);
        }

        // Add response body if requested (sanitized)
        if (includeResponseBody && responseBody) {
          auditData.responseData = sanitizeAuditData(responseBody, sensitiveFields);
        }

        // Add additional context based on operation type
        switch (category) {
          case 'AUTH':
            auditData.email = req.body?.email || req.body?.emailOrPhone;
            auditData.phoneNumber = req.body?.phoneNumber || req.body?.emailOrPhone;
            break;
          case 'USER_MANAGEMENT':
            auditData.targetUserId = req.params?.userId || req.body?.userId;
            auditData.roleChange = req.body?.role;
            break;
          case 'FINANCIAL':
            auditData.amount = req.body?.amount || req.body?.totalAmount;
            auditData.currency = req.body?.currency || 'NGN';
            auditData.transactionType = req.body?.itemType;
            break;
          case 'CONTENT':
            auditData.contentId = req.params?.id || req.body?.id;
            auditData.contentType = req.body?.postType;
            break;
        }

        // Save to database
        await AuditLog.create(auditData);

        // Also log to Winston for immediate visibility
        const logLevel = res.statusCode >= 400 ? 'warn' : 'info';
        logger[logLevel](`Audit: ${operation}`, {
          ...auditData,
          audit: true,
        });

      } catch (error) {
        logger.error('Failed to create audit log:', {
          error: error.message,
          operation,
          userId: req.user?.userId,
          endpoint: req.originalUrl,
        });
      }
    });
  });
};

/**
 * @function sanitizeAuditData
 * @description Remove sensitive information from audit data
 * @param {any} data - Data to sanitize
 * @param {Array} sensitiveFields - Fields to remove or mask
 * @returns {any} Sanitized data
 */
const sanitizeAuditData = (data, sensitiveFields = []) => {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeAuditData(item, sensitiveFields));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    
    // Check if this is a sensitive field
    const isSensitive = sensitiveFields.some(field => 
      lowerKey.includes(field.toLowerCase())
    );

    if (isSensitive) {
      // Mask sensitive data
      if (typeof value === 'string') {
        sanitized[key] = value.length > 0 ? '*'.repeat(Math.min(value.length, 8)) : '';
      } else {
        sanitized[key] = '[REDACTED]';
      }
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeAuditData(value, sensitiveFields);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
};

/**
 * @function createAuditMiddleware
 * @description Factory function to create specific audit middleware
 */
const createAuditMiddleware = {
  // Authentication operations
  auth: (operation) => auditLog(operation, {
    category: 'AUTH',
    includeRequestBody: true,
    sensitiveFields: ['password', 'token', 'otp', 'newPassword'],
  }),

  // User management operations
  userManagement: (operation) => auditLog(operation, {
    category: 'USER_MANAGEMENT',
    includeRequestBody: true,
    includeResponseBody: false,
    sensitiveFields: ['password', 'token'],
  }),

  // Financial transactions
  financial: (operation) => auditLog(operation, {
    category: 'FINANCIAL',
    includeRequestBody: true,
    includeResponseBody: true,
    sensitiveFields: ['cardNumber', 'cvv', 'pin', 'accountNumber'],
  }),

  // Content management
  content: (operation) => auditLog(operation, {
    category: 'CONTENT',
    includeRequestBody: true,
    includeResponseBody: false,
  }),

  // System administration
  admin: (operation) => auditLog(operation, {
    category: 'ADMIN',
    includeRequestBody: true,
    includeResponseBody: true,
    sensitiveFields: ['password', 'token', 'secret', 'key', 'config'],
  }),
};

/**
 * @function getAuditLogs
 * @description Retrieve audit logs with filtering
 * @param {object} filters - Filters to apply
 * @returns {Promise<Array>} Audit logs
 */
const getAuditLogs = async (filters = {}) => {
  const {
    userId,
    operation,
    category,
    startDate,
    endDate,
    success,
    limit = 100,
    skip = 0,
  } = filters;

  const query = {};

  if (userId) query.userId = userId;
  if (operation) query.operation = new RegExp(operation, 'i');
  if (category) query.category = category;
  if (success !== undefined) query.success = success;

  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) query.timestamp.$gte = new Date(startDate);
    if (endDate) query.timestamp.$lte = new Date(endDate);
  }

  return await AuditLog.find(query)
    .sort({ timestamp: -1 })
    .limit(limit)
    .skip(skip)
    .lean();
};

/**
 * @function generateAuditReport
 * @description Generate audit report for a specific time period
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<object>} Audit report
 */
const generateAuditReport = async (startDate, endDate) => {
  const pipeline = [
    {
      $match: {
        timestamp: {
          $gte: startDate,
          $lte: endDate,
        },
      },
    },
    {
      $group: {
        _id: {
          category: '$category',
          operation: '$operation',
          success: '$success',
        },
        count: { $sum: 1 },
        avgDuration: { $avg: '$duration' },
        users: { $addToSet: '$userId' },
      },
    },
    {
      $group: {
        _id: {
          category: '$_id.category',
          operation: '$_id.operation',
        },
        totalCount: { $sum: '$count' },
        successCount: {
          $sum: {
            $cond: [{ $eq: ['$_id.success', true] }, '$count', 0],
          },
        },
        failureCount: {
          $sum: {
            $cond: [{ $eq: ['$_id.success', false] }, '$count', 0],
          },
        },
        avgDuration: { $avg: '$avgDuration' },
        uniqueUsers: { $sum: { $size: '$users' } },
      },
    },
    {
      $sort: { totalCount: -1 },
    },
  ];

  const results = await AuditLog.aggregate(pipeline);
  
  return {
    period: { startDate, endDate },
    summary: results,
    totalOperations: results.reduce((sum, item) => sum + item.totalCount, 0),
    totalUsers: [...new Set(results.flatMap(item => item.uniqueUsers))].length,
  };
};

module.exports = {
  auditLog,
  createAuditMiddleware,
  getAuditLogs,
  generateAuditReport,
  sanitizeAuditData,
};