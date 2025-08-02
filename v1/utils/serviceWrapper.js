// v1/utils/serviceWrapper.js
const { CircuitBreaker } = require('./circuitBreaker');
const { retryWithBackoff } = require('./retryHandler');
const logger = require('./logger');
const { ApiError } = require('./apiError');
const { StatusCodes } = require('http-status-codes');

/**
 * @class ServiceWrapper
 * @description Wrapper for third-party services with circuit breaker, retry logic, and fallbacks
 */
class ServiceWrapper {
  constructor(serviceName, options = {}) {
    this.serviceName = serviceName;
    this.circuitBreaker = new CircuitBreaker({
      serviceName,
      failureThreshold: options.failureThreshold || 5,
      recoveryTimeout: options.recoveryTimeout || 60000,
      ...options.circuitBreakerOptions
    });
    
    this.retryConfig = {
      maxRetries: options.maxRetries || 3,
      initialDelay: options.initialDelay || 1000,
      maxDelay: options.maxDelay || 10000,
      backoffMultiplier: options.backoffMultiplier || 2,
      ...options.retryOptions
    };

    this.fallbackStrategies = options.fallbackStrategies || {};
    this.healthCheckInterval = options.healthCheckInterval || 300000; // 5 minutes
    this.lastHealthCheck = null;
    this.isHealthy = true;
  }

  /**
   * Execute a service call with full protection (circuit breaker + retry + fallback)
   * @param {Function} serviceCall - The service function to call
   * @param {string} operation - Operation name for logging and fallback lookup
   * @param {Object} options - Additional options
   * @returns {Promise} Service call result or fallback
   */
  async execute(serviceCall, operation, options = {}) {
    const startTime = Date.now();
    
    try {
      const result = await this.circuitBreaker.execute(
        () => retryWithBackoff(serviceCall, this.retryConfig, `${this.serviceName}:${operation}`),
        () => this.handleFallback(operation, options)
      );

      const duration = Date.now() - startTime;
      logger.info(`${this.serviceName}:${operation} completed successfully in ${duration}ms`);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`${this.serviceName}:${operation} failed after ${duration}ms: ${error.message}`);
      
      // If we have a fallback strategy, use it
      if (this.fallbackStrategies[operation]) {
        logger.info(`${this.serviceName}:${operation} using fallback strategy`);
        return await this.handleFallback(operation, options, error);
      }
      
      // Otherwise, throw a user-friendly error
      throw this.createUserFriendlyError(operation, error);
    }
  }

  /**
   * Handle fallback strategies
   * @param {string} operation - Operation name
   * @param {Object} options - Additional options
   * @param {Error} originalError - Original error that triggered fallback
   * @returns {*} Fallback result
   */
  async handleFallback(operation, options = {}, originalError = null) {
    const fallbackStrategy = this.fallbackStrategies[operation];
    
    if (!fallbackStrategy) {
      if (originalError) {
        throw originalError;
      }
      throw new ApiError(`${this.serviceName} service is currently unavailable`, StatusCodes.SERVICE_UNAVAILABLE);
    }

    try {
      if (typeof fallbackStrategy === 'function') {
        return await fallbackStrategy(options, originalError);
      } else if (typeof fallbackStrategy === 'object' && fallbackStrategy.type) {
        return await this.executeFallbackStrategy(fallbackStrategy, options, originalError);
      } else {
        return fallbackStrategy; // Static fallback value
      }
    } catch (fallbackError) {
      logger.error(`${this.serviceName}:${operation} fallback failed: ${fallbackError.message}`);
      throw this.createUserFriendlyError(operation, originalError || fallbackError);
    }
  }

  /**
   * Execute different types of fallback strategies
   * @param {Object} strategy - Fallback strategy configuration
   * @param {Object} options - Additional options
   * @param {Error} originalError - Original error
   * @returns {*} Fallback result
   */
  async executeFallbackStrategy(strategy, options, originalError) {
    switch (strategy.type) {
      case 'cache':
        return await this.getCachedResponse(strategy.key || options.cacheKey);
      
      case 'mock':
        return strategy.data || this.getMockResponse(options);
      
      case 'alternative_service':
        return await this.callAlternativeService(strategy.service, options);
      
      case 'degraded_response':
        return this.getDegradedResponse(options);
      
      default:
        throw new Error(`Unknown fallback strategy type: ${strategy.type}`);
    }
  }

  /**
   * Get cached response (placeholder - would integrate with Redis)
   * @param {string} cacheKey - Cache key
   * @returns {*} Cached response or null
   */
  async getCachedResponse(cacheKey) {
    // This would integrate with Redis cache
    logger.info(`${this.serviceName}: Attempting to retrieve cached response for key: ${cacheKey}`);
    return null; // Placeholder
  }

  /**
   * Get mock response for testing/fallback
   * @param {Object} options - Request options
   * @returns {Object} Mock response
   */
  getMockResponse(options) {
    logger.info(`${this.serviceName}: Returning mock response`);
    return {
      status: 'success',
      message: `Mock response from ${this.serviceName}`,
      data: {},
      isMockResponse: true
    };
  }

  /**
   * Call alternative service
   * @param {string} alternativeService - Alternative service name
   * @param {Object} options - Request options
   * @returns {*} Alternative service response
   */
  async callAlternativeService(alternativeService, options) {
    logger.info(`${this.serviceName}: Calling alternative service: ${alternativeService}`);
    // This would call an alternative service
    throw new Error('Alternative service not implemented');
  }

  /**
   * Get degraded response with limited functionality
   * @param {Object} options - Request options
   * @returns {Object} Degraded response
   */
  getDegradedResponse(options) {
    logger.info(`${this.serviceName}: Returning degraded response`);
    return {
      status: 'partial_success',
      message: `${this.serviceName} is operating in degraded mode`,
      data: {},
      isDegradedResponse: true
    };
  }

  /**
   * Create user-friendly error messages
   * @param {string} operation - Operation name
   * @param {Error} error - Original error
   * @returns {ApiError} User-friendly error
   */
  createUserFriendlyError(operation, error) {
    const errorMessages = {
      'search': 'Search service is temporarily unavailable. Please try again later.',
      'book': 'Booking service is temporarily unavailable. Please try again later.',
      'quote': 'Quote service is temporarily unavailable. Please try again later.',
      'payment': 'Payment service is temporarily unavailable. Please try again later.',
      'default': `${this.serviceName} service is temporarily unavailable. Please try again later.`
    };

    const message = errorMessages[operation] || errorMessages.default;
    
    // Determine appropriate status code based on error type
    let statusCode = StatusCodes.SERVICE_UNAVAILABLE;
    if (error.response && error.response.status) {
      statusCode = error.response.status >= 400 && error.response.status < 500 
        ? StatusCodes.BAD_GATEWAY 
        : StatusCodes.SERVICE_UNAVAILABLE;
    }

    return new ApiError(message, statusCode);
  }

  /**
   * Get service health status
   * @returns {Object} Health status
   */
  getHealthStatus() {
    return {
      serviceName: this.serviceName,
      isHealthy: this.isHealthy,
      circuitBreakerStatus: this.circuitBreaker.getStatus(),
      lastHealthCheck: this.lastHealthCheck
    };
  }

  /**
   * Perform health check
   * @param {Function} healthCheckFn - Health check function
   * @returns {Promise<boolean>} Health status
   */
  async performHealthCheck(healthCheckFn) {
    try {
      await healthCheckFn();
      this.isHealthy = true;
      this.lastHealthCheck = new Date();
      logger.info(`${this.serviceName}: Health check passed`);
      return true;
    } catch (error) {
      this.isHealthy = false;
      this.lastHealthCheck = new Date();
      logger.error(`${this.serviceName}: Health check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Reset service wrapper state
   */
  reset() {
    this.circuitBreaker.reset();
    this.isHealthy = true;
    this.lastHealthCheck = null;
    logger.info(`${this.serviceName}: Service wrapper reset`);
  }
}

module.exports = ServiceWrapper;