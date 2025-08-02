// v1/models/errorLogModel.js
const mongoose = require('mongoose');

/**
 * @schema ErrorLogSchema
 * @description Schema for tracking and analyzing application errors
 */
const ErrorLogSchema = new mongoose.Schema({
  errorId: {
    type: String,
    unique: true,
    required: true,
    index: true
  },
  level: {
    type: String,
    enum: ['error', 'warn', 'info', 'debug'],
    required: true,
    index: true
  },
  message: {
    type: String,
    required: true
  },
  stack: {
    type: String
  },
  errorCode: {
    type: String,
    index: true
  },
  statusCode: {
    type: Number,
    index: true
  },
  context: {
    userId: { 
      type: mongoose.Schema.Types.Mixed, // Allow both ObjectId and string
      index: true
    },
    endpoint: String,
    method: String,
    userAgent: String,
    ip: String,
    requestId: String,
    sessionId: String
  },
  classification: {
    category: {
      type: String,
      enum: ['database', 'validation', 'auth', 'external_service', 'rate_limit', 'filesystem', 'unknown'],
      default: 'unknown',
      index: true
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
      index: true
    }
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  resolved: {
    type: Boolean,
    default: false,
    index: true
  },
  resolvedAt: {
    type: Date
  },
  resolvedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  resolutionNotes: {
    type: String
  },
  occurrenceCount: {
    type: Number,
    default: 1
  },
  firstOccurrence: {
    type: Date,
    default: Date.now
  },
  lastOccurrence: {
    type: Date,
    default: Date.now
  },
  environment: {
    type: String,
    default: process.env.NODE_ENV || 'development'
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
ErrorLogSchema.index({ createdAt: -1 });
ErrorLogSchema.index({ 'classification.category': 1, 'classification.severity': 1 });
ErrorLogSchema.index({ resolved: 1, 'classification.severity': 1 });
ErrorLogSchema.index({ errorCode: 1, resolved: 1 });

/**
 * Static method to log an error
 * @param {Error} error - The error object
 * @param {object} context - Request context
 * @param {object} classification - Error classification
 * @returns {Promise<ErrorLog>} The created error log
 */
ErrorLogSchema.statics.logError = async function(error, context = {}, classification = {}) {
  try {
    const errorId = error.errorId || `ERR_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`.toUpperCase();
    
    // Check if this error already exists (for duplicate tracking)
    const existingError = await this.findOne({
      message: error.message,
      errorCode: error.code,
      'context.endpoint': context.endpoint,
      resolved: false
    });

    if (existingError) {
      // Update existing error occurrence
      existingError.occurrenceCount += 1;
      existingError.lastOccurrence = new Date();
      existingError.context = { ...existingError.context, ...context };
      return await existingError.save();
    }

    // Create new error log
    const errorLog = new this({
      errorId,
      level: this.determineLogLevel(error, classification),
      message: error.message,
      stack: error.stack,
      errorCode: error.code,
      statusCode: error.statusCode,
      context,
      classification: {
        category: classification.category || 'unknown',
        severity: classification.severity || this.determineSeverity(error)
      },
      metadata: {
        name: error.name,
        isOperational: error.isOperational,
        originalError: error.originalError?.message,
        ...error.context
      }
    });

    return await errorLog.save();
  } catch (logError) {
    // Fallback logging if database save fails
    console.error('Failed to log error to database:', logError.message);
    console.error('Original error:', error.message);
    return null;
  }
};

/**
 * Determine log level based on error type and classification
 * @param {Error} error - The error object
 * @param {object} classification - Error classification
 * @returns {string} Log level
 */
ErrorLogSchema.statics.determineLogLevel = function(error, classification) {
  if (classification.severity === 'critical' || classification.severity === 'high') {
    return 'error';
  }
  
  if (error.statusCode >= 500) {
    return 'error';
  }
  
  if (error.statusCode >= 400) {
    return 'warn';
  }
  
  return 'info';
};

/**
 * Determine severity based on error characteristics
 * @param {Error} error - The error object
 * @returns {string} Severity level
 */
ErrorLogSchema.statics.determineSeverity = function(error) {
  // Critical errors
  if (error.name === 'MongoNetworkError' || error.code === 'ECONNREFUSED') {
    return 'critical';
  }
  
  // High severity errors
  if (error.statusCode >= 500 || error.name === 'DatabaseError') {
    return 'high';
  }
  
  // Medium severity errors
  if (error.statusCode === 401 || error.statusCode === 403 || error.statusCode === 429) {
    return 'medium';
  }
  
  // Low severity errors (client errors)
  if (error.statusCode >= 400 && error.statusCode < 500) {
    return 'low';
  }
  
  return 'medium';
};

/**
 * Get error statistics
 * @param {object} filters - Filter criteria
 * @returns {Promise<object>} Error statistics
 */
ErrorLogSchema.statics.getErrorStats = async function(filters = {}) {
  const pipeline = [
    { $match: filters },
    {
      $group: {
        _id: null,
        totalErrors: { $sum: 1 },
        unresolvedErrors: {
          $sum: { $cond: [{ $eq: ['$resolved', false] }, 1, 0] }
        },
        criticalErrors: {
          $sum: { $cond: [{ $eq: ['$classification.severity', 'critical'] }, 1, 0] }
        },
        highSeverityErrors: {
          $sum: { $cond: [{ $eq: ['$classification.severity', 'high'] }, 1, 0] }
        },
        averageOccurrenceCount: { $avg: '$occurrenceCount' }
      }
    }
  ];

  const result = await this.aggregate(pipeline);
  return result[0] || {
    totalErrors: 0,
    unresolvedErrors: 0,
    criticalErrors: 0,
    highSeverityErrors: 0,
    averageOccurrenceCount: 0
  };
};

/**
 * Mark error as resolved
 * @param {string} errorId - Error ID
 * @param {string} userId - User ID who resolved the error
 * @param {string} notes - Resolution notes
 * @returns {Promise<ErrorLog>} Updated error log
 */
ErrorLogSchema.methods.markResolved = async function(userId, notes = '') {
  this.resolved = true;
  this.resolvedAt = new Date();
  this.resolvedBy = userId;
  this.resolutionNotes = notes;
  return await this.save();
};

const ErrorLog = mongoose.model('ErrorLog', ErrorLogSchema);

module.exports = ErrorLog;