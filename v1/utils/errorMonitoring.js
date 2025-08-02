// v1/utils/errorMonitoring.js
const logger = require('./logger');
const { 
  AffiliateError, 
  WalletError, 
  CommissionError, 
  WithdrawalError,
  QRCodeError 
} = require('./affiliateErrors');

/**
 * @class ErrorMonitor
 * @description Comprehensive error monitoring and alerting for affiliate system
 */
class ErrorMonitor {
  constructor() {
    this.errorCounts = new Map();
    this.errorPatterns = new Map();
    this.alertThresholds = {
      error: 10, // Alert after 10 errors in monitoring window
      warning: 5, // Alert after 5 warnings in monitoring window
      critical: 3 // Alert after 3 critical errors in monitoring window
    };
    this.monitoringWindow = 5 * 60 * 1000; // 5 minutes
    this.cleanupInterval = 60 * 1000; // 1 minute
    
    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Log and monitor affiliate-specific errors
   * @param {Error} error - Error to log and monitor
   * @param {object} context - Additional context information
   * @param {string} operation - Operation that failed
   * @param {object} metadata - Additional metadata
   */
  logError(error, context = {}, operation = 'unknown', metadata = {}) {
    const errorInfo = this.extractErrorInfo(error, context, operation, metadata);
    
    // Log the error
    this.writeErrorLog(errorInfo);
    
    // Track error patterns
    this.trackErrorPattern(errorInfo);
    
    // Check for alert conditions
    this.checkAlertConditions(errorInfo);
    
    // Store error for analysis
    this.storeErrorForAnalysis(errorInfo);
  }

  /**
   * Extract comprehensive error information
   * @param {Error} error - Error object
   * @param {object} context - Context information
   * @param {string} operation - Operation name
   * @param {object} metadata - Additional metadata
   * @returns {object} Comprehensive error information
   */
  extractErrorInfo(error, context, operation, metadata) {
    const timestamp = new Date().toISOString();
    const errorId = this.generateErrorId();
    
    const baseInfo = {
      errorId,
      timestamp,
      operation,
      message: error.message,
      name: error.name,
      stack: error.stack,
      context,
      metadata
    };

    // Add specific information based on error type
    if (error instanceof AffiliateError) {
      return {
        ...baseInfo,
        category: 'affiliate',
        severity: this.determineSeverity(error),
        affiliateId: context.affiliateId || metadata.affiliateId,
        statusCode: error.statusCode,
        errorCode: error.code,
        isOperational: error.isOperational,
        additionalErrors: error.errors
      };
    }

    if (error instanceof WalletError) {
      return {
        ...baseInfo,
        category: 'wallet',
        severity: this.determineSeverity(error),
        affiliateId: context.affiliateId || metadata.affiliateId,
        walletId: context.walletId || metadata.walletId,
        amount: context.amount || metadata.amount,
        statusCode: error.statusCode,
        errorCode: error.code,
        isOperational: error.isOperational
      };
    }

    if (error instanceof CommissionError) {
      return {
        ...baseInfo,
        category: 'commission',
        severity: this.determineSeverity(error),
        affiliateId: context.affiliateId || metadata.affiliateId,
        commissionId: context.commissionId || metadata.commissionId,
        bookingReference: context.bookingReference || metadata.bookingReference,
        statusCode: error.statusCode,
        errorCode: error.code,
        isOperational: error.isOperational
      };
    }

    if (error instanceof WithdrawalError) {
      return {
        ...baseInfo,
        category: 'withdrawal',
        severity: this.determineSeverity(error),
        affiliateId: context.affiliateId || metadata.affiliateId,
        withdrawalId: context.withdrawalId || metadata.withdrawalId,
        amount: context.amount || metadata.amount,
        statusCode: error.statusCode,
        errorCode: error.code,
        isOperational: error.isOperational
      };
    }

    if (error instanceof QRCodeError) {
      return {
        ...baseInfo,
        category: 'qrcode',
        severity: this.determineSeverity(error),
        qrType: context.qrType || metadata.qrType,
        statusCode: error.statusCode,
        errorCode: error.code,
        isOperational: error.isOperational
      };
    }

    // Generic error handling
    return {
      ...baseInfo,
      category: 'general',
      severity: error.statusCode >= 500 ? 'critical' : 'error',
      statusCode: error.statusCode || 500,
      errorCode: error.code || 'UNKNOWN_ERROR',
      isOperational: error.isOperational || false
    };
  }

  /**
   * Determine error severity based on error type and context
   * @param {Error} error - Error object
   * @returns {string} Severity level
   */
  determineSeverity(error) {
    // Critical errors that require immediate attention
    if (error.statusCode >= 500) {
      return 'critical';
    }

    // High priority errors
    if (error instanceof WalletError && error.code === 'WALLET_ERROR') {
      if (error.context?.operation === 'credit' || error.context?.operation === 'debit') {
        return 'high';
      }
    }

    if (error instanceof CommissionError && error.code === 'COMMISSION_ERROR') {
      if (error.context?.operation === 'calculate' || error.context?.operation === 'process') {
        return 'high';
      }
    }

    if (error instanceof WithdrawalError && error.code === 'WITHDRAWAL_ERROR') {
      if (error.context?.operation === 'process') {
        return 'high';
      }
    }

    // Medium priority errors
    if (error.statusCode >= 400 && error.statusCode < 500) {
      return 'medium';
    }

    // Default to error level
    return 'error';
  }

  /**
   * Write error log with appropriate level
   * @param {object} errorInfo - Error information
   */
  writeErrorLog(errorInfo) {
    const logData = {
      errorId: errorInfo.errorId,
      category: errorInfo.category,
      operation: errorInfo.operation,
      message: errorInfo.message,
      severity: errorInfo.severity,
      statusCode: errorInfo.statusCode,
      errorCode: errorInfo.errorCode,
      context: errorInfo.context,
      metadata: errorInfo.metadata,
      timestamp: errorInfo.timestamp
    };

    switch (errorInfo.severity) {
      case 'critical':
        logger.error('CRITICAL ERROR in affiliate system', logData);
        break;
      case 'high':
        logger.error('HIGH PRIORITY ERROR in affiliate system', logData);
        break;
      case 'medium':
        logger.warn('MEDIUM PRIORITY ERROR in affiliate system', logData);
        break;
      default:
        logger.error('ERROR in affiliate system', logData);
    }

    // Also log stack trace for debugging
    if (errorInfo.stack) {
      logger.debug('Error stack trace', {
        errorId: errorInfo.errorId,
        stack: errorInfo.stack
      });
    }
  }

  /**
   * Track error patterns for analysis
   * @param {object} errorInfo - Error information
   */
  trackErrorPattern(errorInfo) {
    const patternKey = `${errorInfo.category}:${errorInfo.errorCode}:${errorInfo.operation}`;
    const now = Date.now();
    
    if (!this.errorPatterns.has(patternKey)) {
      this.errorPatterns.set(patternKey, {
        count: 0,
        firstOccurrence: now,
        lastOccurrence: now,
        errors: []
      });
    }

    const pattern = this.errorPatterns.get(patternKey);
    pattern.count++;
    pattern.lastOccurrence = now;
    pattern.errors.push({
      errorId: errorInfo.errorId,
      timestamp: errorInfo.timestamp,
      context: errorInfo.context
    });

    // Keep only recent errors (last 100)
    if (pattern.errors.length > 100) {
      pattern.errors = pattern.errors.slice(-100);
    }

    this.errorPatterns.set(patternKey, pattern);
  }

  /**
   * Check if error patterns meet alert conditions
   * @param {object} errorInfo - Error information
   */
  checkAlertConditions(errorInfo) {
    const patternKey = `${errorInfo.category}:${errorInfo.errorCode}:${errorInfo.operation}`;
    const pattern = this.errorPatterns.get(patternKey);
    
    if (!pattern) return;

    const recentErrors = pattern.errors.filter(
      e => Date.now() - new Date(e.timestamp).getTime() < this.monitoringWindow
    );

    const threshold = this.alertThresholds[errorInfo.severity] || this.alertThresholds.error;

    if (recentErrors.length >= threshold) {
      this.triggerAlert(errorInfo, pattern, recentErrors);
    }
  }

  /**
   * Trigger alert for error pattern
   * @param {object} errorInfo - Error information
   * @param {object} pattern - Error pattern
   * @param {Array} recentErrors - Recent errors
   */
  triggerAlert(errorInfo, pattern, recentErrors) {
    const alertData = {
      alertId: this.generateErrorId(),
      timestamp: new Date().toISOString(),
      severity: errorInfo.severity,
      category: errorInfo.category,
      errorCode: errorInfo.errorCode,
      operation: errorInfo.operation,
      message: `High frequency of ${errorInfo.category} errors detected`,
      errorCount: recentErrors.length,
      timeWindow: this.monitoringWindow / 1000 / 60, // minutes
      pattern: {
        totalCount: pattern.count,
        firstOccurrence: new Date(pattern.firstOccurrence).toISOString(),
        lastOccurrence: new Date(pattern.lastOccurrence).toISOString()
      },
      recentErrors: recentErrors.map(e => ({
        errorId: e.errorId,
        timestamp: e.timestamp
      }))
    };

    logger.error('ALERT: High frequency error pattern detected', alertData);

    // Here you could integrate with external alerting systems
    // this.sendToAlertingSystem(alertData);
  }

  /**
   * Store error for analysis and reporting
   * @param {object} errorInfo - Error information
   */
  storeErrorForAnalysis(errorInfo) {
    // In a production system, you might want to store this in a database
    // or send to an analytics service for further analysis
    
    const analysisData = {
      errorId: errorInfo.errorId,
      timestamp: errorInfo.timestamp,
      category: errorInfo.category,
      severity: errorInfo.severity,
      operation: errorInfo.operation,
      errorCode: errorInfo.errorCode,
      message: errorInfo.message,
      context: this.sanitizeContext(errorInfo.context),
      metadata: this.sanitizeContext(errorInfo.metadata)
    };

    // Log for analysis (in production, send to analytics service)
    logger.info('Error stored for analysis', { analysisData });
  }

  /**
   * Sanitize context data for storage (remove sensitive information)
   * @param {object} context - Context to sanitize
   * @returns {object} Sanitized context
   */
  sanitizeContext(context) {
    if (!context || typeof context !== 'object') {
      return context;
    }

    const sanitized = { ...context };
    
    // Remove sensitive fields
    const sensitiveFields = [
      'password', 'token', 'secret', 'key', 'authorization',
      'accountNumber', 'bankDetails', 'personalInfo'
    ];

    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  /**
   * Generate unique error ID
   * @returns {string} Unique error ID
   */
  generateErrorId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 8);
    return `ERR_${timestamp}_${random}`.toUpperCase();
  }

  /**
   * Get error statistics for monitoring dashboard
   * @param {object} options - Query options
   * @returns {object} Error statistics
   */
  getErrorStatistics(options = {}) {
    const {
      timeWindow = this.monitoringWindow,
      category = null
    } = options;

    const now = Date.now();
    const cutoff = now - timeWindow;
    
    const stats = {
      totalErrors: 0,
      errorsByCategory: {},
      errorsBySeverity: {},
      errorsByOperation: {},
      topErrorPatterns: [],
      timeWindow: timeWindow / 1000 / 60 // minutes
    };

    for (const [patternKey, pattern] of this.errorPatterns.entries()) {
      const [cat, errorCode, operation] = patternKey.split(':');
      
      if (category && cat !== category) continue;

      const recentErrors = pattern.errors.filter(
        e => new Date(e.timestamp).getTime() > cutoff
      );

      if (recentErrors.length === 0) continue;

      stats.totalErrors += recentErrors.length;
      
      stats.errorsByCategory[cat] = (stats.errorsByCategory[cat] || 0) + recentErrors.length;
      stats.errorsByOperation[operation] = (stats.errorsByOperation[operation] || 0) + recentErrors.length;
      
      stats.topErrorPatterns.push({
        pattern: patternKey,
        category: cat,
        errorCode,
        operation,
        count: recentErrors.length,
        totalCount: pattern.count
      });
    }

    // Sort top patterns by count
    stats.topErrorPatterns.sort((a, b) => b.count - a.count);
    stats.topErrorPatterns = stats.topErrorPatterns.slice(0, 10);

    return stats;
  }

  /**
   * Start cleanup interval to remove old error data
   */
  startCleanupInterval() {
    setInterval(() => {
      this.cleanupOldErrors();
    }, this.cleanupInterval);
  }

  /**
   * Clean up old error data to prevent memory leaks
   */
  cleanupOldErrors() {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
    let cleanedPatterns = 0;

    for (const [patternKey, pattern] of this.errorPatterns.entries()) {
      // Remove old errors from pattern
      const originalLength = pattern.errors.length;
      pattern.errors = pattern.errors.filter(
        e => new Date(e.timestamp).getTime() > cutoff
      );

      // If no recent errors, remove the pattern entirely
      if (pattern.errors.length === 0) {
        this.errorPatterns.delete(patternKey);
        cleanedPatterns++;
      } else if (pattern.errors.length !== originalLength) {
        this.errorPatterns.set(patternKey, pattern);
      }
    }

    if (cleanedPatterns > 0) {
      logger.debug('Cleaned up old error patterns', {
        cleanedPatterns,
        remainingPatterns: this.errorPatterns.size
      });
    }
  }

  /**
   * Create error context for operations
   * @param {string} operation - Operation name
   * @param {object} data - Operation data
   * @returns {object} Error context
   */
  createErrorContext(operation, data = {}) {
    return {
      operation,
      timestamp: new Date().toISOString(),
      requestId: data.requestId || this.generateErrorId(),
      userId: data.userId,
      affiliateId: data.affiliateId,
      ...data
    };
  }
}

// Export singleton instance
module.exports = new ErrorMonitor();