// v1/models/auditLogModel.js
const mongoose = require('mongoose');

/**
 * @description Mongoose schema for the AuditLog model.
 * Stores audit logs for sensitive operations and security events.
 */
const AuditLogSchema = new mongoose.Schema({
  operation: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  category: {
    type: String,
    required: true,
    enum: ['AUTH', 'USER_MANAGEMENT', 'FINANCIAL', 'CONTENT', 'ADMIN', 'GENERAL'],
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
  },
  userRole: {
    type: String,
    required: true,
    default: 'anonymous',
  },
  ip: {
    type: String,
    required: true,
    index: true,
  },
  userAgent: {
    type: String,
    required: true,
  },
  method: {
    type: String,
    required: true,
    enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  },
  endpoint: {
    type: String,
    required: true,
    index: true,
  },
  statusCode: {
    type: Number,
    required: true,
    index: true,
  },
  duration: {
    type: Number,
    required: true,
    min: 0,
  },
  success: {
    type: Boolean,
    required: true,
    index: true,
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
    index: true,
  },
  
  // Request/Response data (sanitized)
  requestData: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  responseData: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  
  // Operation-specific fields
  email: {
    type: String,
    sparse: true,
    index: true,
  },
  phoneNumber: {
    type: String,
    sparse: true,
    index: true,
  },
  targetUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    sparse: true,
    index: true,
  },
  roleChange: {
    type: String,
    sparse: true,
  },
  amount: {
    type: Number,
    sparse: true,
    index: true,
  },
  currency: {
    type: String,
    sparse: true,
    default: 'NGN',
  },
  transactionType: {
    type: String,
    sparse: true,
    enum: ['Flight', 'Hotel', 'Insurance', 'Visa', 'Package'],
  },
  contentId: {
    type: mongoose.Schema.Types.ObjectId,
    sparse: true,
    index: true,
  },
  contentType: {
    type: String,
    sparse: true,
    enum: ['Articles', 'Packages'],
  },
  
  // Additional metadata
  sessionId: {
    type: String,
    sparse: true,
  },
  correlationId: {
    type: String,
    sparse: true,
    index: true,
  },
  tags: [{
    type: String,
    trim: true,
  }],
  
  // Risk assessment
  riskLevel: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    default: 'LOW',
    index: true,
  },
  
  // Geolocation data (if available)
  location: {
    country: String,
    region: String,
    city: String,
    coordinates: {
      latitude: Number,
      longitude: Number,
    },
  },
}, {
  timestamps: false, // We use our own timestamp field
  collection: 'auditlogs',
});

// Compound indexes for common queries
AuditLogSchema.index({ userId: 1, timestamp: -1 });
AuditLogSchema.index({ category: 1, timestamp: -1 });
AuditLogSchema.index({ operation: 1, timestamp: -1 });
AuditLogSchema.index({ success: 1, timestamp: -1 });
AuditLogSchema.index({ ip: 1, timestamp: -1 });
AuditLogSchema.index({ riskLevel: 1, timestamp: -1 });

// TTL index to automatically delete old audit logs (optional)
// Uncomment if you want to automatically delete logs older than 2 years
// AuditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 63072000 }); // 2 years

/**
 * @method findByUser
 * @description Find audit logs for a specific user
 * @param {string} userId - User ID
 * @param {object} options - Query options
 * @returns {Promise<Array>} Audit logs
 */
AuditLogSchema.statics.findByUser = function(userId, options = {}) {
  const { limit = 50, skip = 0, category, startDate, endDate } = options;
  
  const query = { userId };
  
  if (category) {
    query.category = category;
  }
  
  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) query.timestamp.$gte = new Date(startDate);
    if (endDate) query.timestamp.$lte = new Date(endDate);
  }
  
  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(limit)
    .skip(skip)
    .lean();
};

/**
 * @method findSuspiciousActivity
 * @description Find potentially suspicious activities
 * @param {object} criteria - Search criteria
 * @returns {Promise<Array>} Suspicious activities
 */
AuditLogSchema.statics.findSuspiciousActivity = function(criteria = {}) {
  const {
    timeWindow = 24, // hours
    failureThreshold = 10,
    ipAddress,
    userId,
  } = criteria;
  
  const startTime = new Date(Date.now() - (timeWindow * 60 * 60 * 1000));
  
  const pipeline = [
    {
      $match: {
        timestamp: { $gte: startTime },
        success: false,
        ...(ipAddress && { ip: ipAddress }),
        ...(userId && { userId: new mongoose.Types.ObjectId(userId) }),
      },
    },
    {
      $group: {
        _id: {
          ip: '$ip',
          userId: '$userId',
        },
        failureCount: { $sum: 1 },
        operations: { $addToSet: '$operation' },
        lastFailure: { $max: '$timestamp' },
        endpoints: { $addToSet: '$endpoint' },
      },
    },
    {
      $match: {
        failureCount: { $gte: failureThreshold },
      },
    },
    {
      $sort: { failureCount: -1 },
    },
  ];
  
  return this.aggregate(pipeline);
};

/**
 * @method getOperationStats
 * @description Get statistics for operations within a time period
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Array>} Operation statistics
 */
AuditLogSchema.statics.getOperationStats = function(startDate, endDate) {
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
          date: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$timestamp',
            },
          },
        },
        totalCount: { $sum: 1 },
        successCount: {
          $sum: { $cond: [{ $eq: ['$success', true] }, 1, 0] },
        },
        failureCount: {
          $sum: { $cond: [{ $eq: ['$success', false] }, 1, 0] },
        },
        avgDuration: { $avg: '$duration' },
        uniqueUsers: { $addToSet: '$userId' },
        uniqueIPs: { $addToSet: '$ip' },
      },
    },
    {
      $addFields: {
        successRate: {
          $multiply: [
            { $divide: ['$successCount', '$totalCount'] },
            100,
          ],
        },
        uniqueUserCount: { $size: '$uniqueUsers' },
        uniqueIPCount: { $size: '$uniqueIPs' },
      },
    },
    {
      $sort: { '_id.date': -1, totalCount: -1 },
    },
  ];
  
  return this.aggregate(pipeline);
};

/**
 * @method cleanup
 * @description Clean up old audit logs
 * @param {number} daysToKeep - Number of days to keep logs
 * @returns {Promise<object>} Cleanup result
 */
AuditLogSchema.statics.cleanup = function(daysToKeep = 365) {
  const cutoffDate = new Date(Date.now() - (daysToKeep * 24 * 60 * 60 * 1000));
  
  return this.deleteMany({
    timestamp: { $lt: cutoffDate },
    riskLevel: { $in: ['LOW', 'MEDIUM'] }, // Keep high and critical risk logs longer
  });
};

module.exports = mongoose.model('AuditLog', AuditLogSchema);