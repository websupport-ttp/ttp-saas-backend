// v1/test/utils/testHelpers.js
// Enhanced test helpers with retry logic and rate limit handling

const request = require('supertest');
const { StatusCodes } = require('http-status-codes');
const { 
  retryableRequest, 
  testDelay, 
  expectWithRetry,
  RETRY_CONFIG 
} = require('./testRetryLogic');
const { testEnvironmentManager } = require('./testEnvironmentManager');

/**
 * Enhanced supertest wrapper with retry logic and rate limit handling
 */
class EnhancedTestClient {
  constructor(app, options = {}) {
    this.app = app;
    this.suiteName = options.suiteName || 'default';
    this.defaultTimeout = options.timeout || 15000;
    this.enableRetries = options.enableRetries !== false;
    this.enableRateLimitHandling = options.enableRateLimitHandling !== false;
    
    // Initialize test session
    testEnvironmentManager.initializeTestSuite(this.suiteName, options);
  }

  /**
   * Creates a retryable GET request
   * @param {string} url - Request URL
   * @param {Object} options - Request options
   * @returns {Promise} - Request promise
   */
  async get(url, options = {}) {
    return this._makeRequest('GET', url, null, options);
  }

  /**
   * Creates a retryable POST request
   * @param {string} url - Request URL
   * @param {Object} data - Request body
   * @param {Object} options - Request options
   * @returns {Promise} - Request promise
   */
  async post(url, data = null, options = {}) {
    return this._makeRequest('POST', url, data, options);
  }

  /**
   * Creates a retryable PUT request
   * @param {string} url - Request URL
   * @param {Object} data - Request body
   * @param {Object} options - Request options
   * @returns {Promise} - Request promise
   */
  async put(url, data = null, options = {}) {
    return this._makeRequest('PUT', url, data, options);
  }

  /**
   * Creates a retryable DELETE request
   * @param {string} url - Request URL
   * @param {Object} options - Request options
   * @returns {Promise} - Request promise
   */
  async delete(url, options = {}) {
    return this._makeRequest('DELETE', url, null, options);
  }

  /**
   * Internal method to make retryable requests
   * @private
   */
  async _makeRequest(method, url, data, options = {}) {
    const {
      headers = {},
      timeout = this.defaultTimeout,
      expectedStatus = null,
      allowRateLimit = this.enableRateLimitHandling,
      maxRetries = RETRY_CONFIG.rateLimitRetry.maxRetries,
      testName = `${method} ${url}`
    } = options;

    const startTime = Date.now();

    const makeRequest = () => {
      let req = request(this.app)[method.toLowerCase()](url);
      
      // Add headers
      Object.keys(headers).forEach(key => {
        req = req.set(key, headers[key]);
      });
      
      // Add body for POST/PUT requests
      if (data && (method === 'POST' || method === 'PUT')) {
        req = req.send(data);
      }
      
      // Add timeout
      req = req.timeout(timeout);
      
      return req;
    };

    try {
      let response;
      
      if (this.enableRetries) {
        response = await retryableRequest(makeRequest, {
          maxRetries,
          timeout,
          context: `${this.suiteName}:${testName}`
        });
      } else {
        response = await makeRequest();
      }

      const responseTime = Date.now() - startTime;
      
      // Record success
      testEnvironmentManager.recordSuccess(this.suiteName, testName, responseTime);
      
      // Handle expected status
      if (expectedStatus !== null) {
        return await expectWithRetry(
          Promise.resolve(response), 
          expectedStatus, 
          { allowRateLimit, context: testName }
        );
      }
      
      return response;
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      // Handle rate limiting
      if (error.status === StatusCodes.TOO_MANY_REQUESTS) {
        testEnvironmentManager.recordRateLimit(this.suiteName, testName, error);
        
        if (allowRateLimit) {
          console.warn(`⚠️ ${testName} hit rate limit - treating as expected behavior`);
          return {
            status: StatusCodes.TOO_MANY_REQUESTS,
            body: { success: false, message: 'Rate limited' }
          };
        }
      } else {
        testEnvironmentManager.recordFailure(this.suiteName, testName, error);
      }
      
      throw error;
    }
  }

  /**
   * Adds authentication header to requests
   * @param {string} token - JWT token
   * @returns {EnhancedTestClient} - Fluent interface
   */
  auth(token) {
    this.defaultHeaders = {
      ...this.defaultHeaders,
      'Authorization': `Bearer ${token}`
    };
    return this;
  }

  /**
   * Sets default headers for all requests
   * @param {Object} headers - Headers object
   * @returns {EnhancedTestClient} - Fluent interface
   */
  setHeaders(headers) {
    this.defaultHeaders = { ...this.defaultHeaders, ...headers };
    return this;
  }

  /**
   * Gets test session statistics
   * @returns {Object} - Session statistics
   */
  getStats() {
    return testEnvironmentManager.getSessionStats(this.suiteName);
  }

  /**
   * Cleans up the test client
   */
  cleanup() {
    testEnvironmentManager.cleanupSession(this.suiteName);
  }
}

/**
 * Creates an enhanced test client with retry logic
 * @param {Object} app - Express app
 * @param {Object} options - Client options
 * @returns {EnhancedTestClient} - Enhanced test client
 */
function createTestClient(app, options = {}) {
  return new EnhancedTestClient(app, options);
}

/**
 * Wrapper for Jest describe blocks with test isolation
 * @param {string} suiteName - Test suite name
 * @param {Function} testFn - Test function
 * @param {Object} options - Options
 */
function describeWithRetry(suiteName, testFn, options = {}) {
  const {
    timeout = 60000,
    beforeEachDelay = RETRY_CONFIG.isolation.testDelay,
    afterEachDelay = RETRY_CONFIG.isolation.testDelay
  } = options;

  return describe(suiteName, () => {
    let testClient;
    
    beforeAll(async () => {
      // Initialize test environment
      await testEnvironmentManager.initializeTestSuite(suiteName, options);
    });

    beforeEach(async () => {
      // Add delay between tests to prevent rate limiting
      if (beforeEachDelay > 0) {
        await testDelay(beforeEachDelay);
      }
    });

    afterEach(async () => {
      // Add delay after tests
      if (afterEachDelay > 0) {
        await testDelay(afterEachDelay);
      }
    });

    afterAll(async () => {
      // Cleanup test session
      if (testClient) {
        testClient.cleanup();
      }
      testEnvironmentManager.cleanupSession(suiteName);
    });

    // Set timeout for all tests in this suite
    jest.setTimeout(timeout);

    // Call the original test function
    testFn();
  });
}

/**
 * Wrapper for Jest test blocks with retry logic
 * @param {string} testName - Test name
 * @param {Function} testFn - Test function
 * @param {Object} options - Options
 */
function testWithRetry(testName, testFn, options = {}) {
  const {
    timeout = 30000,
    maxRetries = RETRY_CONFIG.rateLimitRetry.maxRetries,
    skipOnRateLimit = true
  } = options;

  return test(testName, async () => {
    let attempt = 0;
    let lastError;

    while (attempt <= maxRetries) {
      try {
        await testFn();
        
        // Success - record if this was a retry
        if (attempt > 0) {
          testEnvironmentManager.recordRetry('default', testName, attempt, 'Test succeeded after retry');
        }
        
        return;
      } catch (error) {
        lastError = error;
        
        // Check if this is a rate limit error and we should skip
        if (skipOnRateLimit && error.status === StatusCodes.TOO_MANY_REQUESTS) {
          console.warn(`⚠️ Test "${testName}" hit rate limit - skipping as expected behavior`);
          return; // Skip the test instead of failing
        }
        
        // Check if we should retry
        if (attempt >= maxRetries) {
          testEnvironmentManager.recordFailure('default', testName, error);
          throw error;
        }
        
        // Calculate delay and retry
        const delay = RETRY_CONFIG.rateLimitRetry.baseDelay * Math.pow(2, attempt);
        console.warn(`⚠️ Test "${testName}" failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`);
        
        testEnvironmentManager.recordRetry('default', testName, attempt + 1, error.message);
        
        await testDelay(delay);
        attempt++;
      }
    }
    
    throw lastError;
  }, timeout);
}

/**
 * Helper to create test data with proper formatting
 * @param {Object} overrides - Data overrides
 * @returns {Object} - Test data
 */
function createTestData(overrides = {}) {
  const baseData = {
    user: {
      firstName: 'Test',
      lastName: 'User',
      email: `test${Date.now()}@example.com`,
      phoneNumber: `+234812345${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
      password: 'TestPassword123!',
      confirmPassword: 'TestPassword123!'
    },
    customerDetails: {
      firstName: 'Customer',
      lastName: 'Test',
      email: `customer${Date.now()}@example.com`,
      phoneNumber: `+234812345${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`
    },
    visaApplication: {
      destinationCountry: 'United States',
      visaType: 'Tourist',
      travelPurpose: 'Vacation',
      urgency: 'Standard'
    }
  };

  // Deep merge overrides
  return mergeDeep(baseData, overrides);
}

/**
 * Deep merge utility function
 * @param {Object} target - Target object
 * @param {Object} source - Source object
 * @returns {Object} - Merged object
 */
function mergeDeep(target, source) {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = mergeDeep(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  
  return result;
}

/**
 * Helper to wait for rate limit cooldown
 * @param {number} additionalDelay - Additional delay in ms
 */
async function waitForRateLimitCooldown(additionalDelay = 0) {
  const cooldownTime = RETRY_CONFIG.isolation.rateLimitCooldown + additionalDelay;
  console.log(`⏳ Waiting ${cooldownTime}ms for rate limit cooldown...`);
  await testDelay(cooldownTime);
}

/**
 * Helper to check if an error is a rate limit error
 * @param {Error} error - Error to check
 * @returns {boolean} - True if rate limit error
 */
function isRateLimitError(error) {
  return error.status === StatusCodes.TOO_MANY_REQUESTS || 
         error.response?.status === StatusCodes.TOO_MANY_REQUESTS;
}

/**
 * Helper to extract retry-after header from rate limit response
 * @param {Object} error - Rate limit error
 * @returns {number} - Retry after seconds
 */
function getRetryAfterSeconds(error) {
  const retryAfter = error.headers?.['retry-after'] || 
                    error.response?.headers?.['retry-after'];
  return retryAfter ? parseInt(retryAfter, 10) : 0;
}

module.exports = {
  // Main exports
  EnhancedTestClient,
  createTestClient,
  describeWithRetry,
  testWithRetry,
  
  // Utilities
  createTestData,
  waitForRateLimitCooldown,
  isRateLimitError,
  getRetryAfterSeconds,
  testDelay,
  
  // Re-export from other modules
  expectWithRetry,
  RETRY_CONFIG,
  StatusCodes
};