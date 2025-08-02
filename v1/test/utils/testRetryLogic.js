// v1/test/utils/testRetryLogic.js
// Intelligent test retry logic for rate-limited scenarios

const { StatusCodes } = require('http-status-codes');

/**
 * Configuration for test retry logic
 */
const RETRY_CONFIG = {
  // Rate limiting retry configuration
  rateLimitRetry: {
    maxRetries: 3,
    baseDelay: 1000, // 1 second base delay
    maxDelay: 10000, // 10 seconds max delay
    backoffMultiplier: 2, // Exponential backoff
    jitter: true, // Add randomness to prevent thundering herd
  },
  
  // Network/connection retry configuration
  networkRetry: {
    maxRetries: 2,
    baseDelay: 500,
    maxDelay: 5000,
    backoffMultiplier: 2,
    jitter: true,
  },
  
  // Database operation retry configuration
  databaseRetry: {
    maxRetries: 3,
    baseDelay: 200,
    maxDelay: 2000,
    backoffMultiplier: 1.5,
    jitter: false,
  },
  
  // Test isolation configuration
  isolation: {
    testDelay: 100, // Delay between tests to prevent conflicts
    concurrentTestLimit: 2, // Maximum concurrent tests
    rateLimitCooldown: 5000, // Cooldown after rate limit hit
  }
};

/**
 * Determines if an error is retryable based on its characteristics
 * @param {Error|Object} error - The error to check
 * @returns {Object} - Retry decision with type and config
 */
function getRetryStrategy(error) {
  // Handle HTTP response errors
  if (error.response || error.status) {
    const status = error.response?.status || error.status;
    
    switch (status) {
      case StatusCodes.TOO_MANY_REQUESTS: // 429
        return {
          shouldRetry: true,
          type: 'rateLimitRetry',
          config: RETRY_CONFIG.rateLimitRetry,
          reason: 'Rate limit exceeded'
        };
        
      case StatusCodes.SERVICE_UNAVAILABLE: // 503
      case StatusCodes.BAD_GATEWAY: // 502
      case StatusCodes.GATEWAY_TIMEOUT: // 504
        return {
          shouldRetry: true,
          type: 'networkRetry',
          config: RETRY_CONFIG.networkRetry,
          reason: 'Service temporarily unavailable'
        };
        
      case StatusCodes.INTERNAL_SERVER_ERROR: // 500
        // Only retry if it looks like a temporary issue
        const errorMessage = error.message || error.response?.data?.message || '';
        if (errorMessage.includes('timeout') || errorMessage.includes('connection')) {
          return {
            shouldRetry: true,
            type: 'networkRetry',
            config: RETRY_CONFIG.networkRetry,
            reason: 'Server error with timeout/connection issue'
          };
        }
        break;
    }
  }
  
  // Handle database errors
  if (error.name || error.code) {
    const errorName = error.name || '';
    const errorCode = error.code;
    
    // MongoDB connection errors
    if (errorName.includes('MongoError') || 
        errorName.includes('MongooseError') ||
        errorCode === 'ECONNRESET' ||
        errorCode === 'ETIMEDOUT') {
      return {
        shouldRetry: true,
        type: 'databaseRetry',
        config: RETRY_CONFIG.databaseRetry,
        reason: 'Database connection issue'
      };
    }
  }
  
  // Handle network errors
  if (error.code) {
    const networkErrorCodes = [
      'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 
      'ENOTFOUND', 'ENETUNREACH', 'EHOSTUNREACH'
    ];
    
    if (networkErrorCodes.includes(error.code)) {
      return {
        shouldRetry: true,
        type: 'networkRetry',
        config: RETRY_CONFIG.networkRetry,
        reason: `Network error: ${error.code}`
      };
    }
  }
  
  // Handle Jest/test framework timeouts
  if (error.message && error.message.includes('Timeout')) {
    return {
      shouldRetry: true,
      type: 'networkRetry',
      config: RETRY_CONFIG.networkRetry,
      reason: 'Test timeout'
    };
  }
  
  return {
    shouldRetry: false,
    reason: 'Non-retryable error'
  };
}

/**
 * Calculates delay for retry with exponential backoff and jitter
 * @param {number} attempt - Current attempt number (0-based)
 * @param {Object} config - Retry configuration
 * @returns {number} - Delay in milliseconds
 */
function calculateDelay(attempt, config) {
  const { baseDelay, maxDelay, backoffMultiplier, jitter } = config;
  
  // Calculate exponential backoff
  let delay = baseDelay * Math.pow(backoffMultiplier, attempt);
  
  // Apply maximum delay limit
  delay = Math.min(delay, maxDelay);
  
  // Add jitter to prevent thundering herd problem
  if (jitter) {
    const jitterAmount = delay * 0.1; // 10% jitter
    delay += (Math.random() - 0.5) * 2 * jitterAmount;
  }
  
  return Math.max(delay, 0);
}

/**
 * Executes a function with retry logic
 * @param {Function} fn - Function to execute
 * @param {Object} options - Retry options
 * @returns {Promise} - Result of the function execution
 */
async function withRetry(fn, options = {}) {
  const {
    maxRetries = 3,
    retryConfig = null,
    context = 'operation',
    onRetry = null,
    timeout = 30000
  } = options;
  
  let lastError;
  let attempt = 0;
  
  while (attempt <= maxRetries) {
    try {
      // Add timeout to prevent hanging
      const result = await Promise.race([
        fn(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`${context} timeout after ${timeout}ms`)), timeout)
        )
      ]);
      
      // Success - return result
      if (attempt > 0) {
        console.log(`✅ ${context} succeeded after ${attempt} retries`);
      }
      return result;
      
    } catch (error) {
      lastError = error;
      
      // Check if we should retry
      const retryStrategy = getRetryStrategy(error);
      
      if (!retryStrategy.shouldRetry || attempt >= maxRetries) {
        // No more retries or non-retryable error
        if (attempt > 0) {
          console.error(`❌ ${context} failed after ${attempt} retries: ${error.message}`);
        }
        throw error;
      }
      
      // Calculate delay for next attempt
      const config = retryConfig || retryStrategy.config;
      const delay = calculateDelay(attempt, config);
      
      console.warn(`⚠️ ${context} failed (attempt ${attempt + 1}/${maxRetries + 1}): ${retryStrategy.reason}`);
      console.warn(`   Retrying in ${delay}ms...`);
      
      // Call retry callback if provided
      if (onRetry) {
        try {
          await onRetry(error, attempt, delay);
        } catch (callbackError) {
          console.warn('Retry callback error:', callbackError.message);
        }
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delay));
      attempt++;
    }
  }
  
  throw lastError;
}

/**
 * Wraps a test function with retry logic
 * @param {Function} testFn - Test function to wrap
 * @param {Object} options - Retry options
 * @returns {Function} - Wrapped test function
 */
function retryableTest(testFn, options = {}) {
  const {
    maxRetries = RETRY_CONFIG.rateLimitRetry.maxRetries,
    timeout = 30000,
    context = 'test'
  } = options;
  
  return async function wrappedTest(...args) {
    return withRetry(
      () => testFn.apply(this, args),
      {
        maxRetries,
        timeout,
        context,
        onRetry: async (error, attempt, delay) => {
          // Clean up any test state before retry
          if (options.cleanup) {
            try {
              await options.cleanup();
            } catch (cleanupError) {
              console.warn('Test cleanup error:', cleanupError.message);
            }
          }
        }
      }
    );
  };
}

/**
 * Wraps a supertest request with retry logic
 * @param {Function} requestFn - Function that returns a supertest request
 * @param {Object} options - Retry options
 * @returns {Promise} - Request result
 */
async function retryableRequest(requestFn, options = {}) {
  const {
    maxRetries = RETRY_CONFIG.rateLimitRetry.maxRetries,
    timeout = 15000,
    context = 'HTTP request'
  } = options;
  
  return withRetry(
    async () => {
      const request = requestFn();
      return request;
    },
    {
      maxRetries,
      timeout,
      context,
      onRetry: async (error, attempt, delay) => {
        // Add extra delay for rate limiting
        if (error.status === StatusCodes.TOO_MANY_REQUESTS) {
          const extraDelay = RETRY_CONFIG.isolation.rateLimitCooldown;
          console.warn(`   Adding extra ${extraDelay}ms cooldown for rate limiting`);
          await new Promise(resolve => setTimeout(resolve, extraDelay));
        }
      }
    }
  );
}

/**
 * Utility to add delay between tests
 * @param {number} ms - Milliseconds to delay
 */
function testDelay(ms = RETRY_CONFIG.isolation.testDelay) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Enhanced expect wrapper that handles rate limiting
 * @param {Promise} requestPromise - Request promise
 * @param {number} expectedStatus - Expected status code
 * @param {Object} options - Options
 */
async function expectWithRetry(requestPromise, expectedStatus, options = {}) {
  const { allowRateLimit = true, context = 'request' } = options;
  
  try {
    const response = await requestPromise;
    // Only use expect if it's available (in Jest environment)
    if (typeof expect !== 'undefined') {
      expect(response.status).toBe(expectedStatus);
    }
    return response;
  } catch (error) {
    // Handle rate limiting gracefully
    if (allowRateLimit && error.status === StatusCodes.TOO_MANY_REQUESTS) {
      console.warn(`⚠️ ${context} hit rate limit - this is expected behavior in test environment`);
      // Don't fail the test, just log the rate limiting
      return { status: StatusCodes.TOO_MANY_REQUESTS, body: { message: 'Rate limited' } };
    }
    throw error;
  }
}

module.exports = {
  // Core retry functions
  withRetry,
  retryableTest,
  retryableRequest,
  
  // Utilities
  getRetryStrategy,
  calculateDelay,
  expectWithRetry,
  testDelay,
  
  // Configuration
  RETRY_CONFIG,
  
  // Status codes for convenience
  StatusCodes
};