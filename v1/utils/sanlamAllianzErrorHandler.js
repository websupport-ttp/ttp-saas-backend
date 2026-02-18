// v1/utils/sanlamAllianzErrorHandler.js
const logger = require('./logger');
const { ApiError } = require('./apiError');

/**
 * @class SanlamAllianzErrorHandler
 * @description Specialized error handler for SanlamAllianz API integration
 */
class SanlamAllianzErrorHandler {
  constructor() {
    this.errorCounts = new Map(); // Track error frequencies
    this.alertThresholds = {
      authentication: { count: 5, timeWindow: 300000 }, // 5 errors in 5 minutes
      server: { count: 10, timeWindow: 600000 }, // 10 errors in 10 minutes
      network: { count: 15, timeWindow: 900000 }, // 15 errors in 15 minutes
      rate_limit: { count: 3, timeWindow: 300000 }, // 3 rate limits in 5 minutes
    };
    this.alertCooldowns = new Map(); // Prevent alert spam
    this.alertCooldownDuration = 1800000; // 30 minutes
  }

  /**
   * @method trackError
   * @description Track error occurrences for alerting
   * @param {string} errorType - Type of error
   * @param {string} baseUrl - API base URL
   * @param {object} errorDetails - Error details
   */
  trackError(errorType, baseUrl, errorDetails) {
    const key = `${errorType}:${baseUrl}`;
    const now = Date.now();
    
    if (!this.errorCounts.has(key)) {
      this.errorCounts.set(key, []);
    }
    
    const errors = this.errorCounts.get(key);
    errors.push({ timestamp: now, details: errorDetails });
    
    // Clean up old errors outside the time window
    const threshold = this.alertThresholds[errorType];
    if (threshold) {
      const cutoff = now - threshold.timeWindow;
      const recentErrors = errors.filter(error => error.timestamp > cutoff);
      this.errorCounts.set(key, recentErrors);
      
      // Check if we should trigger an alert
      if (recentErrors.length >= threshold.count) {
        this.triggerAlert(errorType, baseUrl, recentErrors);
      }
    }
  }

  /**
   * @method triggerAlert
   * @description Trigger alert for critical error patterns
   * @param {string} errorType - Type of error
   * @param {string} baseUrl - API base URL
   * @param {Array} recentErrors - Recent error occurrences
   */
  triggerAlert(errorType, baseUrl, recentErrors) {
    const alertKey = `${errorType}:${baseUrl}`;
    const now = Date.now();
    
    // Check cooldown to prevent alert spam
    const lastAlert = this.alertCooldowns.get(alertKey);
    if (lastAlert && (now - lastAlert) < this.alertCooldownDuration) {
      return; // Still in cooldown period
    }
    
    this.alertCooldowns.set(alertKey, now);
    
    const alertSeverity = this.getAlertSeverity(errorType, recentErrors.length);
    const timeWindow = this.alertThresholds[errorType].timeWindow / 1000 / 60; // Convert to minutes
    
    logger.error(`ALERT: SanlamAllianz API ${errorType} error pattern detected`, {
      alert: true,
      severity: alertSeverity,
      errorType,
      baseUrl,
      errorCount: recentErrors.length,
      timeWindowMinutes: timeWindow,
      recentErrors: recentErrors.slice(-5), // Include last 5 errors
      alertId: this.generateAlertId(),
      timestamp: new Date().toISOString(),
      service: 'SanlamAllianz',
      requiresImmedateAttention: alertSeverity === 'critical',
    });

    // Log security event for authentication issues
    if (errorType === 'authentication') {
      logger.logSecurityEvent('sanlam_auth_failure_pattern', {
        service: 'SanlamAllianz',
        baseUrl,
        errorCount: recentErrors.length,
        timeWindowMinutes: timeWindow,
        possibleCause: 'Invalid credentials, token expiry, or API changes',
      }, alertSeverity);
    }
  }

  /**
   * @method getAlertSeverity
   * @description Determine alert severity based on error type and frequency
   * @param {string} errorType - Type of error
   * @param {number} errorCount - Number of errors
   * @returns {string} Alert severity level
   */
  getAlertSeverity(errorType, errorCount) {
    const threshold = this.alertThresholds[errorType];
    if (!threshold) return 'medium';
    
    const ratio = errorCount / threshold.count;
    
    if (errorType === 'authentication' || errorType === 'server') {
      return ratio >= 2 ? 'critical' : 'high';
    }
    
    if (errorType === 'network') {
      return ratio >= 1.5 ? 'high' : 'medium';
    }
    
    return ratio >= 2 ? 'high' : 'medium';
  }

  /**
   * @method generateAlertId
   * @description Generate unique alert ID
   * @returns {string} Unique alert ID
   */
  generateAlertId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `SANLAM_ALERT_${timestamp}_${random}`.toUpperCase();
  }

  /**
   * @method logDetailedError
   * @description Log detailed error information with context
   * @param {object} error - Error object
   * @param {string} operation - Operation that failed
   * @param {string} baseUrl - API base URL
   * @param {number} attempt - Attempt number
   * @param {object} context - Additional context
   */
  logDetailedError(error, operation, baseUrl, attempt, context = {}) {
    const errorInfo = this.parseError(error);
    
    // Track error for alerting
    this.trackError(errorInfo.type, baseUrl, {
      operation,
      attempt,
      statusCode: errorInfo.statusCode,
      message: errorInfo.message,
      timestamp: Date.now(),
    });

    // Log with appropriate level
    const logLevel = this.getLogLevel(errorInfo.type, errorInfo.statusCode, attempt);
    
    logger[logLevel](`SanlamAllianz API error: ${operation}`, {
      service: 'SanlamAllianz',
      operation,
      baseUrl,
      attempt,
      errorType: errorInfo.type,
      statusCode: errorInfo.statusCode,
      message: errorInfo.message,
      isRetryable: errorInfo.isRetryable,
      details: errorInfo.details,
      context,
      timestamp: new Date().toISOString(),
    });

    // Log performance impact for slow failures
    if (context.duration && context.duration > 10000) {
      logger.warn('SanlamAllianz API slow failure detected', {
        operation,
        baseUrl,
        duration: context.duration,
        errorType: errorInfo.type,
        performanceImpact: true,
      });
    }
  }

  /**
   * @method parseError
   * @description Parse error object into structured information
   * @param {object} error - Error object
   * @returns {object} Parsed error information
   */
  parseError(error) {
    // This method is similar to parseSanlamAllianzError but focused on logging
    const errorInfo = {
      type: 'unknown',
      message: 'Unknown error occurred',
      statusCode: 500,
      isRetryable: false,
      details: {},
    };

    if (!error.response) {
      errorInfo.type = 'network';
      errorInfo.message = error.message || 'Network error';
      errorInfo.statusCode = 503;
      errorInfo.isRetryable = true;
      errorInfo.details = { code: error.code, errno: error.errno };
    } else {
      const { status, statusText, data } = error.response;
      errorInfo.statusCode = status;
      
      if (status === 401) {
        errorInfo.type = 'authentication';
        errorInfo.message = 'Authentication failed';
        errorInfo.isRetryable = true;
      } else if (status === 403) {
        errorInfo.type = 'authorization';
        errorInfo.message = 'Authorization failed';
        errorInfo.isRetryable = false;
      } else if (status === 429) {
        errorInfo.type = 'rate_limit';
        errorInfo.message = 'Rate limit exceeded';
        errorInfo.isRetryable = true;
      } else if (status >= 500) {
        errorInfo.type = 'server';
        errorInfo.message = data?.message || statusText || 'Server error';
        errorInfo.isRetryable = true;
      } else if (status >= 400) {
        errorInfo.type = 'client';
        errorInfo.message = data?.message || statusText || 'Client error';
        errorInfo.isRetryable = false;
      }
      
      errorInfo.details = { statusText, data };
    }

    return errorInfo;
  }

  /**
   * @method getLogLevel
   * @description Determine appropriate log level for error
   * @param {string} errorType - Type of error
   * @param {number} statusCode - HTTP status code
   * @param {number} attempt - Attempt number
   * @returns {string} Log level
   */
  getLogLevel(errorType, statusCode, attempt) {
    // Critical errors that need immediate attention
    if (errorType === 'authentication' && attempt > 2) return 'error';
    if (errorType === 'server' && statusCode >= 500) return 'error';
    if (errorType === 'network' && attempt > 2) return 'error';
    
    // Warning level for retryable issues
    if (errorType === 'rate_limit') return 'warn';
    if (errorType === 'server' && attempt <= 2) return 'warn';
    if (errorType === 'network' && attempt <= 2) return 'warn';
    
    // Info level for client errors (usually user/data issues)
    if (errorType === 'client') return 'info';
    
    return 'warn';
  }

  /**
   * @method logSuccessfulRecovery
   * @description Log when API call succeeds after failures
   * @param {string} operation - Operation that succeeded
   * @param {string} baseUrl - API base URL
   * @param {number} totalAttempts - Total attempts made
   * @param {number} totalDuration - Total duration including retries
   */
  logSuccessfulRecovery(operation, baseUrl, totalAttempts, totalDuration) {
    if (totalAttempts > 1) {
      logger.info('SanlamAllianz API recovered after retries', {
        service: 'SanlamAllianz',
        operation,
        baseUrl,
        totalAttempts,
        totalDuration,
        recovery: true,
        resilience: 'successful_retry',
      });
    }
  }

  /**
   * @method getErrorStatistics
   * @description Get error statistics for monitoring
   * @returns {object} Error statistics
   */
  getErrorStatistics() {
    const stats = {
      totalErrors: 0,
      errorsByType: {},
      errorsByBaseUrl: {},
      recentErrors: [],
    };

    const now = Date.now();
    const last24Hours = now - (24 * 60 * 60 * 1000);

    for (const [key, errors] of this.errorCounts.entries()) {
      const [errorType, baseUrl] = key.split(':');
      const recentErrors = errors.filter(error => error.timestamp > last24Hours);
      
      stats.totalErrors += recentErrors.length;
      stats.errorsByType[errorType] = (stats.errorsByType[errorType] || 0) + recentErrors.length;
      stats.errorsByBaseUrl[baseUrl] = (stats.errorsByBaseUrl[baseUrl] || 0) + recentErrors.length;
      
      recentErrors.forEach(error => {
        stats.recentErrors.push({
          type: errorType,
          baseUrl,
          timestamp: error.timestamp,
          details: error.details,
        });
      });
    }

    // Sort recent errors by timestamp
    stats.recentErrors.sort((a, b) => b.timestamp - a.timestamp);
    stats.recentErrors = stats.recentErrors.slice(0, 50); // Keep last 50 errors

    return stats;
  }

  /**
   * @method clearOldErrors
   * @description Clean up old error tracking data
   */
  clearOldErrors() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const cutoff = now - maxAge;

    for (const [key, errors] of this.errorCounts.entries()) {
      const recentErrors = errors.filter(error => error.timestamp > cutoff);
      if (recentErrors.length === 0) {
        this.errorCounts.delete(key);
      } else {
        this.errorCounts.set(key, recentErrors);
      }
    }

    // Clear old alert cooldowns
    for (const [key, timestamp] of this.alertCooldowns.entries()) {
      if (now - timestamp > this.alertCooldownDuration) {
        this.alertCooldowns.delete(key);
      }
    }
  }
}

// Create singleton instance
const sanlamAllianzErrorHandler = new SanlamAllianzErrorHandler();

// Clean up old errors every hour
setInterval(() => {
  sanlamAllianzErrorHandler.clearOldErrors();
}, 60 * 60 * 1000);

module.exports = sanlamAllianzErrorHandler;