// v1/test/utils/testRetryLogic.minimal.js
// Minimal test retry logic

const RETRY_CONFIG = {
  rateLimitRetry: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    jitter: true,
  }
};

function withRetry(fn, options = {}) {
  return fn();
}

module.exports = {
  RETRY_CONFIG,
  withRetry
};