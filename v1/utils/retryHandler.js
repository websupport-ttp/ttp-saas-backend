// v1/utils/retryHandler.js
const logger = require('./logger');

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryableErrors: ['ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'NETWORK_ERROR'],
  retryableStatusCodes: [408, 429, 500, 502, 503, 504]
};

/**
 * @function sleep
 * @description Utility function to pause execution
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} Promise that resolves after the specified time
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * @function isRetryableError
 * @description Check if an error is retryable
 * @param {Error} error - The error to check
 * @param {Array} retryableErrors - List of retryable error codes
 * @param {Array} retryableStatusCodes - List of retryable HTTP status codes
 * @returns {boolean} True if error is retryable
 */
const isRetryableError = (error, retryableErrors, retryableStatusCodes) => {
  // Check error code
  if (error.code && retryableErrors.includes(error.code)) {
    return true;
  }

  // Check HTTP status code
  if (error.response && error.response.status && retryableStatusCodes.includes(error.response.status)) {
    return true;
  }

  // Check for specific error types
  if (error.name === 'TimeoutError' || error.name === 'NetworkError') {
    return true;
  }

  // Check error message for common network issues
  const errorMessage = error.message.toLowerCase();
  const networkErrorKeywords = ['timeout', 'network', 'connection', 'econnreset', 'enotfound'];
  return networkErrorKeywords.some(keyword => errorMessage.includes(keyword));
};

/**
 * @function calculateDelay
 * @description Calculate delay for next retry using exponential backoff with jitter
 * @param {number} attempt - Current attempt number (0-based)
 * @param {Object} config - Retry configuration
 * @returns {number} Delay in milliseconds
 */
const calculateDelay = (attempt, config) => {
  const exponentialDelay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt);
  const cappedDelay = Math.min(exponentialDelay, config.maxDelay);
  
  // Add jitter to prevent thundering herd
  const jitter = Math.random() * 0.1 * cappedDelay;
  return Math.floor(cappedDelay + jitter);
};

/**
 * @function retryWithBackoff
 * @description Execute a function with retry logic and exponential backoff
 * @param {Function} fn - The async function to execute
 * @param {Object} options - Retry configuration options
 * @param {string} context - Context for logging (e.g., service name)
 * @returns {Promise} Result of function execution
 */
const retryWithBackoff = async (fn, options = {}, context = 'Unknown') => {
  const config = { ...DEFAULT_RETRY_CONFIG, ...options };
  let lastError;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const result = await fn();
      
      if (attempt > 0) {
        logger.info(`${context}: Retry successful on attempt ${attempt + 1}`);
      }
      
      return result;
    } catch (error) {
      lastError = error;
      
      // Don't retry on the last attempt
      if (attempt === config.maxRetries) {
        break;
      }

      // Check if error is retryable
      if (!isRetryableError(error, config.retryableErrors, config.retryableStatusCodes)) {
        logger.warn(`${context}: Non-retryable error encountered: ${error.message}`);
        throw error;
      }

      const delay = calculateDelay(attempt, config);
      logger.warn(`${context}: Attempt ${attempt + 1} failed: ${error.message}. Retrying in ${delay}ms...`);
      
      await sleep(delay);
    }
  }

  logger.error(`${context}: All retry attempts exhausted. Last error: ${lastError.message}`);
  throw lastError;
};

/**
 * @function createRetryableFunction
 * @description Create a retryable version of a function with predefined configuration
 * @param {Function} fn - The function to make retryable
 * @param {Object} config - Retry configuration
 * @param {string} context - Context for logging
 * @returns {Function} Retryable function
 */
const createRetryableFunction = (fn, config = {}, context = 'Unknown') => {
  return async (...args) => {
    return retryWithBackoff(() => fn(...args), config, context);
  };
};

module.exports = {
  retryWithBackoff,
  createRetryableFunction,
  isRetryableError,
  calculateDelay,
  DEFAULT_RETRY_CONFIG
};