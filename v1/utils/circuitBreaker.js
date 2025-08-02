// v1/utils/circuitBreaker.js
const logger = require('./logger');

/**
 * @class CircuitBreaker
 * @description Implementation of circuit breaker pattern for external service calls
 */
class CircuitBreaker {
  constructor(options = {}) {
    this.name = options.name || 'default';
    this.failureThreshold = options.failureThreshold || 5;
    this.recoveryTimeout = options.recoveryTimeout || 60000; // 1 minute
    this.monitoringPeriod = options.monitoringPeriod || 10000; // 10 seconds
    this.expectedErrors = options.expectedErrors || [];
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
    this.totalRequests = 0;
    
    // Statistics
    this.stats = {
      totalRequests: 0,
      totalFailures: 0,
      totalSuccesses: 0,
      totalTimeouts: 0,
      averageResponseTime: 0,
      lastResetTime: Date.now()
    };
  }

  /**
   * Execute a function with circuit breaker protection
   * @param {Function} fn - Function to execute
   * @param {...any} args - Arguments to pass to the function
   * @returns {Promise<any>} Result of the function execution
   */
  async execute(fn, ...args) {
    this.stats.totalRequests++;
    this.totalRequests++;

    // Check circuit breaker state
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN';
        logger.info(`Circuit breaker ${this.name} transitioning to HALF_OPEN`);
      } else {
        const error = new Error(`Circuit breaker ${this.name} is OPEN`);
        error.circuitBreakerOpen = true;
        error.nextRetryTime = this.lastFailureTime + this.recoveryTimeout;
        throw error;
      }
    }

    const startTime = Date.now();
    
    try {
      const result = await fn(...args);
      this.onSuccess(Date.now() - startTime);
      return result;
    } catch (error) {
      this.onFailure(error, Date.now() - startTime);
      throw error;
    }
  }

  /**
   * Handle successful execution
   * @param {number} responseTime - Response time in milliseconds
   */
  onSuccess(responseTime) {
    this.stats.totalSuccesses++;
    this.successCount++;
    
    // Update average response time
    this.updateAverageResponseTime(responseTime);
    
    if (this.state === 'HALF_OPEN') {
      logger.info(`Circuit breaker ${this.name} transitioning to CLOSED after successful request`);
      this.reset();
    } else {
      // Reset failure count on success in CLOSED state
      this.failureCount = 0;
    }
  }

  /**
   * Handle failed execution
   * @param {Error} error - The error that occurred
   * @param {number} responseTime - Response time in milliseconds
   */
  onFailure(error, responseTime) {
    this.stats.totalFailures++;
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    // Update average response time
    this.updateAverageResponseTime(responseTime);
    
    // Check if error should trigger circuit breaker
    if (this.shouldTriggerOnError(error)) {
      if (this.state === 'HALF_OPEN') {
        logger.warn(`Circuit breaker ${this.name} transitioning back to OPEN from HALF_OPEN`);
        this.state = 'OPEN';
      } else if (this.failureCount >= this.failureThreshold) {
        logger.error(`Circuit breaker ${this.name} transitioning to OPEN after ${this.failureCount} failures`);
        this.state = 'OPEN';
      }
    }
  }

  /**
   * Check if the circuit breaker should attempt to reset
   * @returns {boolean} Whether to attempt reset
   */
  shouldAttemptReset() {
    return Date.now() - this.lastFailureTime >= this.recoveryTimeout;
  }

  /**
   * Check if an error should trigger the circuit breaker
   * @param {Error} error - The error to check
   * @returns {boolean} Whether the error should trigger the circuit breaker
   */
  shouldTriggerOnError(error) {
    // Don't trigger on expected errors (like 4xx HTTP errors)
    if (this.expectedErrors.some(expectedError => 
      error.name === expectedError || 
      error.code === expectedError ||
      error.statusCode === expectedError
    )) {
      return false;
    }

    // Trigger on network errors, timeouts, and 5xx errors
    const triggerErrors = [
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ECONNRESET',
      'MongoNetworkError',
      'MongoTimeoutError'
    ];

    return triggerErrors.includes(error.code) || 
           triggerErrors.includes(error.name) ||
           (error.statusCode >= 500);
  }

  /**
   * Reset the circuit breaker to CLOSED state
   */
  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    logger.info(`Circuit breaker ${this.name} reset to CLOSED state`);
  }

  /**
   * Update average response time
   * @param {number} responseTime - Response time in milliseconds
   */
  updateAverageResponseTime(responseTime) {
    const totalTime = this.stats.averageResponseTime * (this.stats.totalRequests - 1);
    this.stats.averageResponseTime = (totalTime + responseTime) / this.stats.totalRequests;
  }

  /**
   * Get current circuit breaker status
   * @returns {object} Circuit breaker status
   */
  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalRequests: this.totalRequests,
      lastFailureTime: this.lastFailureTime,
      nextRetryTime: this.lastFailureTime ? this.lastFailureTime + this.recoveryTimeout : null,
      stats: {
        ...this.stats,
        successRate: this.stats.totalRequests > 0 ? 
          (this.stats.totalSuccesses / this.stats.totalRequests * 100).toFixed(2) + '%' : '0%',
        failureRate: this.stats.totalRequests > 0 ? 
          (this.stats.totalFailures / this.stats.totalRequests * 100).toFixed(2) + '%' : '0%'
      }
    };
  }

  /**
   * Force open the circuit breaker
   */
  forceOpen() {
    this.state = 'OPEN';
    this.lastFailureTime = Date.now();
    logger.warn(`Circuit breaker ${this.name} forced to OPEN state`);
  }

  /**
   * Force close the circuit breaker
   */
  forceClose() {
    this.reset();
    logger.info(`Circuit breaker ${this.name} forced to CLOSED state`);
  }
}

/**
 * @class CircuitBreakerManager
 * @description Manages multiple circuit breakers
 */
class CircuitBreakerManager {
  constructor() {
    this.circuitBreakers = new Map();
  }

  /**
   * Get or create a circuit breaker
   * @param {string} name - Circuit breaker name
   * @param {object} options - Circuit breaker options
   * @returns {CircuitBreaker} Circuit breaker instance
   */
  getCircuitBreaker(name, options = {}) {
    if (!this.circuitBreakers.has(name)) {
      this.circuitBreakers.set(name, new CircuitBreaker({ name, ...options }));
    }
    return this.circuitBreakers.get(name);
  }

  /**
   * Get status of all circuit breakers
   * @returns {Array<object>} Status of all circuit breakers
   */
  getAllStatus() {
    return Array.from(this.circuitBreakers.values()).map(cb => cb.getStatus());
  }

  /**
   * Reset all circuit breakers
   */
  resetAll() {
    this.circuitBreakers.forEach(cb => cb.reset());
    logger.info('All circuit breakers reset');
  }

  /**
   * Get circuit breaker by name
   * @param {string} name - Circuit breaker name
   * @returns {CircuitBreaker|null} Circuit breaker instance or null
   */
  getByName(name) {
    return this.circuitBreakers.get(name) || null;
  }
}

// Global circuit breaker manager instance
const circuitBreakerManager = new CircuitBreakerManager();

/**
 * Decorator function to wrap functions with circuit breaker
 * @param {string} name - Circuit breaker name
 * @param {object} options - Circuit breaker options
 * @returns {Function} Decorator function
 */
const withCircuitBreaker = (name, options = {}) => {
  return (target, propertyKey, descriptor) => {
    const originalMethod = descriptor.value;
    const circuitBreaker = circuitBreakerManager.getCircuitBreaker(name, options);

    descriptor.value = async function(...args) {
      return await circuitBreaker.execute(originalMethod.bind(this), ...args);
    };

    return descriptor;
  };
};

module.exports = {
  CircuitBreaker,
  CircuitBreakerManager,
  circuitBreakerManager,
  withCircuitBreaker
};